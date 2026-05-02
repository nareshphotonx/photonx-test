import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationType,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventStatus,
  NotificationSource,
  Prisma,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client';
import { Queue } from 'bullmq';
import nodemailer from 'nodemailer';
import { SecretCryptoService } from '../../common/security/secret-crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

interface EmitUserInput {
  tenantId: string;
  actorId?: string;
  userId: string;
  eventKey: string;
  eventType: string;
  title?: string;
  body?: string;
  payload: Record<string, unknown>;
  channels: NotificationChannel[];
  source?: NotificationSource;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly secretCryptoService: SecretCryptoService,
    private readonly configService: ConfigService,
    @InjectQueue('notification-deliveries')
    private readonly deliveryQueue: Queue,
  ) {}

  async send(tenantId: string, actor: Express.User, dto: SendNotificationDto) {
    const userIds = Array.from(new Set(dto.targetUserIds));

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: userIds },
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more target users are invalid');
    }

    const createdOrExisting: Array<{ eventId: string; eventKey: string; userId: string }> = [];

    for (const userId of userIds) {
      const scopedEventKey = userIds.length === 1 ? dto.eventKey : `${dto.eventKey}:${userId}`;

      const event = await this.createOrGetEvent({
        tenantId,
        userId,
        eventKey: scopedEventKey,
        eventType: dto.eventType,
        title: dto.title,
        body: dto.body,
        payload: dto.payload,
        channels: dto.channels,
        source: dto.source ?? NotificationSource.SYSTEM,
        actorId: actor.sub,
      });

      createdOrExisting.push({
        eventId: event.id,
        eventKey: event.eventKey,
        userId,
      });

      await this.enqueueEventDeliveries(event.id);
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'NOTIFICATION_SEND',
      entityType: 'NotificationEvent',
      metadata: {
        eventKey: dto.eventKey,
        eventType: dto.eventType,
        channels: dto.channels,
        targetUserIds: userIds,
      },
    });

    return {
      items: createdOrExisting,
      total: createdOrExisting.length,
    };
  }

  async emitToUser(input: EmitUserInput) {
    const event = await this.createOrGetEvent({
      tenantId: input.tenantId,
      userId: input.userId,
      eventKey: input.eventKey,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      payload: input.payload,
      channels: input.channels,
      source: input.source ?? NotificationSource.SYSTEM,
      actorId: input.actorId,
    });

    await this.enqueueEventDeliveries(event.id);

    return {
      id: event.id,
      eventKey: event.eventKey,
      userId: event.userId,
    };
  }

  async listMine(tenantId: string, userId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.NotificationEventWhereInput = {
      tenantId,
      userId,
      ...(typeof query.isRead === 'boolean' ? { isRead: query.isRead } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.notificationEvent.count({ where }),
      this.prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async markRead(tenantId: string, userId: string, eventId: string) {
    const existing = await this.prisma.notificationEvent.findFirst({
      where: {
        tenantId,
        id: eventId,
        userId,
      },
      select: {
        id: true,
        isRead: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.isRead) {
      return { read: true };
    }

    await this.prisma.notificationEvent.update({
      where: { id: existing.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: 'NOTIFICATION_MARK_READ',
      entityType: 'NotificationEvent',
      entityId: eventId,
    });

    return { read: true };
  }

  async processDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        event: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      return;
    }

    if (
      delivery.status === NotificationDeliveryStatus.SENT ||
      delivery.status === NotificationDeliveryStatus.SKIPPED
    ) {
      return;
    }

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: delivery.userId },
      select: {
        whatsappEnabled: true,
        emailEnabled: true,
      },
    });

    if (!this.isChannelEnabled(delivery.channel, pref)) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.SKIPPED,
          errorMessage: 'Channel disabled by user preferences',
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
      await this.refreshEventStatus(delivery.eventId);
      return;
    }

    try {
      const result =
        delivery.channel === NotificationChannel.IN_APP
          ? { providerMessageId: null, providerResponse: null }
          : delivery.channel === NotificationChannel.SLACK
            ? await this.sendSlackDelivery(delivery)
            : delivery.channel === NotificationChannel.EMAIL
              ? await this.sendEmailDelivery(delivery)
              : await this.sendWhatsAppDelivery(delivery);

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          deliveredAt: new Date(),
          providerMessageId: result.providerMessageId,
          providerResponse: result.providerResponse as Prisma.InputJsonValue | undefined,
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown delivery failure',
        },
      });
      throw error;
    } finally {
      await this.refreshEventStatus(delivery.eventId);
    }
  }

  private async createOrGetEvent(input: {
    tenantId: string;
    userId: string;
    eventKey: string;
    eventType: string;
    title?: string;
    body?: string;
    payload: Record<string, unknown>;
    channels: NotificationChannel[];
    source: NotificationSource;
    actorId?: string;
  }) {
    const channel = input.channels[0] ?? NotificationChannel.IN_APP;

    const existing = await this.prisma.notificationEvent.findUnique({
      where: {
        tenantId_eventKey: {
          tenantId: input.tenantId,
          eventKey: input.eventKey,
        },
      },
      select: {
        id: true,
        tenantId: true,
        eventKey: true,
        userId: true,
      },
    });

    if (existing) {
      return existing;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const event = await tx.notificationEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          eventKey: input.eventKey,
          eventType: input.eventType,
          title: input.title,
          body: input.body,
          channel,
          source: input.source,
          payload: input.payload as Prisma.InputJsonValue,
          metadata: {
            channels: input.channels,
          } as Prisma.InputJsonValue,
          status: NotificationEventStatus.PENDING,
        },
      });

      for (const deliveryChannel of input.channels) {
        const dedupeKey = `${event.eventKey}:${deliveryChannel}`;
        await tx.notificationDelivery.create({
          data: {
            tenantId: input.tenantId,
            eventId: event.id,
            userId: input.userId,
            channel: deliveryChannel,
            dedupeKey,
            status: NotificationDeliveryStatus.PENDING,
          },
        });
      }

      return event;
    });

    if (input.actorId) {
      await this.auditService.log({
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: 'NOTIFICATION_EVENT_CREATE',
        entityType: 'NotificationEvent',
        entityId: created.id,
        metadata: {
          eventKey: created.eventKey,
          channels: input.channels,
        },
      });
    }

    return created;
  }

  private async enqueueEventDeliveries(eventId: string): Promise<void> {
    const rows = await this.prisma.notificationDelivery.findMany({
      where: {
        eventId,
        status: NotificationDeliveryStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    for (const row of rows) {
      await this.deliveryQueue.add(
        'notification-delivery',
        { deliveryId: row.id },
        {
          removeOnComplete: true,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1500,
          },
        },
      );
    }
  }

  private isChannelEnabled(
    channel: NotificationChannel,
    preference: { whatsappEnabled: boolean; emailEnabled: boolean } | null,
  ): boolean {
    if (channel === NotificationChannel.WHATSAPP) {
      return preference?.whatsappEnabled ?? true;
    }

    if (channel === NotificationChannel.EMAIL) {
      return preference?.emailEnabled ?? true;
    }

    return true;
  }

  private async refreshEventStatus(eventId: string): Promise<void> {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { eventId },
      select: { status: true },
    });

    if (deliveries.length === 0) {
      return;
    }

    const hasFailed = deliveries.some((entry) => entry.status === NotificationDeliveryStatus.FAILED);
    const hasPending = deliveries.some((entry) => entry.status === NotificationDeliveryStatus.PENDING);
    const allSkipped = deliveries.every((entry) => entry.status === NotificationDeliveryStatus.SKIPPED);

    const nextStatus = hasPending
      ? NotificationEventStatus.PENDING
      : hasFailed
        ? NotificationEventStatus.FAILED
        : NotificationEventStatus.SENT;

    await this.prisma.notificationEvent.update({
      where: { id: eventId },
      data: {
        status: nextStatus,
        processedAt: hasPending || allSkipped ? null : new Date(),
        attempts: {
          increment: 1,
        },
      },
    });
  }

  private async sendSlackDelivery(delivery: {
    id: string;
    tenantId: string;
    event: { title: string | null; body: string | null; eventType: string; payload: Prisma.JsonValue };
  }): Promise<{ providerMessageId: string | null; providerResponse: Record<string, unknown> | null }> {
    const setting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId: delivery.tenantId,
          type: IntegrationType.SLACK,
        },
      },
    });

    if (!setting?.enabled) {
      throw new BadRequestException('Slack integration is disabled');
    }

    const secrets = this.readSecretObject(setting.encryptedSecrets);
    const webhookUrl = secrets.webhookUrl;

    if (!webhookUrl) {
      throw new BadRequestException('Slack webhook URL is not configured');
    }

    const text = [delivery.event.title, delivery.event.body]
      .filter(Boolean)
      .join('\n')
      .trim() || `Notification: ${delivery.event.eventType}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new BadRequestException(`Slack delivery failed: HTTP ${response.status}`);
    }

    return {
      providerMessageId: null,
      providerResponse: {
        status: response.status,
      },
    };
  }

  private async sendEmailDelivery(delivery: {
    id: string;
    tenantId: string;
    user: { email: string | null; name: string | null };
    event: { title: string | null; body: string | null; eventType: string; payload: Prisma.JsonValue };
  }): Promise<{ providerMessageId: string | null; providerResponse: Record<string, unknown> | null }> {
    if (!delivery.user.email) {
      throw new BadRequestException('Target user email missing for EMAIL channel delivery');
    }

    const setting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId: delivery.tenantId,
          type: IntegrationType.EMAIL,
        },
      },
    });

    if (!setting?.enabled) {
      throw new BadRequestException('Email integration is disabled');
    }

    const config = this.readConfigObject(setting.config);
    const secrets = this.readSecretObject(setting.encryptedSecrets);

    const smtpHost = config.smtpHost;
    const smtpPort = Number(config.smtpPort ?? 587);
    const secure = Boolean(config.secure ?? false);
    const fromEmail = config.fromEmail;

    if (!smtpHost || !fromEmail || !secrets.smtpUser || !secrets.smtpPassword) {
      throw new BadRequestException('Email SMTP settings are incomplete');
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: secrets.smtpUser,
        pass: secrets.smtpPassword,
      },
    } as any);

    const info = (await transport.sendMail({
      from: String(fromEmail),
      to: delivery.user.email,
      subject: delivery.event.title ?? `Notification: ${delivery.event.eventType}`,
      text: delivery.event.body ?? JSON.stringify(delivery.event.payload),
    })) as any;

    return {
      providerMessageId: info.messageId ?? null,
      providerResponse: {
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  }

  private async sendWhatsAppDelivery(delivery: {
    id: string;
    tenantId: string;
    user: { id: string; phone: string | null };
    event: { title: string | null; body: string | null; eventType: string; payload: Prisma.JsonValue };
  }): Promise<{ providerMessageId: string | null; providerResponse: Record<string, unknown> | null }> {
    if (!delivery.user.phone) {
      throw new BadRequestException('Target user phone missing for WHATSAPP channel delivery');
    }

    const setting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId: delivery.tenantId,
          type: IntegrationType.WHATSAPP,
        },
      },
    });

    if (!setting?.enabled) {
      throw new BadRequestException('WhatsApp integration is disabled');
    }

    const config = this.readConfigObject(setting.config);
    const secrets = this.readSecretObject(setting.encryptedSecrets);

    const phoneNumberId = config.phoneNumberId;
    const apiVersion = config.apiVersion ?? 'v20.0';
    const accessToken = secrets.accessToken;

    if (!phoneNumberId || !accessToken) {
      throw new BadRequestException('WhatsApp access token or phoneNumberId missing');
    }

    const session = await this.prisma.whatsAppSession.findUnique({
      where: {
        tenantId_userId: {
          tenantId: delivery.tenantId,
          userId: delivery.user.id,
        },
      },
    });

    const now = new Date();
    const within24h = session ? now.getTime() - session.lastInboundAt.getTime() <= 24 * 60 * 60 * 1000 : false;

    const textBody = [delivery.event.title, delivery.event.body]
      .filter(Boolean)
      .join('\n')
      .trim() || `Notification: ${delivery.event.eventType}`;

    const requestBody = within24h
      ? {
          messaging_product: 'whatsapp',
          to: delivery.user.phone,
          type: 'text',
          text: { body: textBody },
        }
      : {
          messaging_product: 'whatsapp',
          to: delivery.user.phone,
          type: 'template',
          template: {
            name: config.utilityTemplateName ?? 'utility_notification',
            language: { code: 'en' },
          },
        };

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const responseJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new BadRequestException(`WhatsApp delivery failed: HTTP ${response.status}`);
    }

    const providerMessageId = this.extractWhatsAppMessageId(responseJson);

    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: delivery.tenantId,
        userId: delivery.user.id,
        sessionId: session?.id,
        waUserPhone: delivery.user.phone,
        direction: WhatsAppMessageDirection.OUTBOUND,
        messageType: within24h ? WhatsAppMessageType.TEXT : WhatsAppMessageType.TEMPLATE,
        textBody,
        commandName: null,
        rawPayload: requestBody as Prisma.InputJsonValue,
        parsedCommand: Prisma.JsonNull,
        status: WhatsAppMessageStatus.SENT,
        providerMessageId,
      },
    });

    if (session) {
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: {
          lastOutboundAt: now,
          isWithin24hWindow: within24h,
        },
      });
    }

    return {
      providerMessageId,
      providerResponse: responseJson,
    };
  }

  private readSecretObject(cipherText: string | null): Record<string, string> {
    const decrypted = this.secretCryptoService.decrypt(cipherText);
    if (!decrypted) {
      return {};
    }

    try {
      return JSON.parse(decrypted) as Record<string, string>;
    } catch {
      this.logger.warn('Failed to parse integration secrets JSON');
      return {};
    }
  }

  private readConfigObject(config: Prisma.JsonValue | null): Record<string, string | number | boolean> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {};
    }

    return config as Record<string, string | number | boolean>;
  }

  private extractWhatsAppMessageId(payload: Record<string, unknown>): string | null {
    const messages = payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const first = messages[0] as Record<string, unknown>;
    return typeof first.id === 'string' ? first.id : null;
  }
}
