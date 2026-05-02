import { NotificationChannel, NotificationEventStatus, NotificationSource } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SecretCryptoService } from '../../common/security/secret-crypto.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService idempotency', () => {
  it('returns existing event for duplicate eventKey', async () => {
    const events = new Map<string, { id: string; eventKey: string; userId: string }>();
    const deliveries = new Map<string, Array<{ id: string; status: string }>>();

    const tx = {
      notificationEvent: {
        create: jest.fn(async ({ data }: any) => {
          const id = `evt_${events.size + 1}`;
          const event = { id, eventKey: data.eventKey, userId: data.userId };
          events.set(data.eventKey, event);
          return {
            ...event,
            tenantId: data.tenantId,
            eventType: data.eventType,
            status: NotificationEventStatus.PENDING,
            title: data.title,
            body: data.body,
            channel: data.channel,
            source: data.source,
            payload: data.payload,
            metadata: data.metadata,
          };
        }),
      },
      notificationDelivery: {
        create: jest.fn(async ({ data }: any) => {
          const list = deliveries.get(data.eventId) ?? [];
          list.push({ id: `del_${list.length + 1}`, status: 'PENDING' });
          deliveries.set(data.eventId, list);
          return { id: `del_${list.length}` };
        }),
      },
    };

    const prisma: any = {
      user: {
        findMany: jest.fn(async () => [{ id: 'user_1' }]),
      },
      notificationEvent: {
        findUnique: jest.fn(async ({ where }: any) => events.get(where.tenantId_eventKey.eventKey) ?? null),
      },
      notificationDelivery: {
        findMany: jest.fn(async ({ where }: any) =>
          (deliveries.get(where.eventId) ?? []).map((entry) => ({
            id: entry.id,
          })),
        ),
      },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(tx);
        }
        return Promise.all(arg);
      }),
    };

    const auditService = {
      log: jest.fn(async () => undefined),
    };

    const queue = {
      add: jest.fn(async () => undefined),
    };

    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'APP_ENCRYPTION_KEY') {
          return 'test-key';
        }
        return fallback;
      }),
    } as unknown as ConfigService;

    const secretCrypto = new SecretCryptoService(config);

    const service = new NotificationsService(
      prisma,
      auditService as any,
      secretCrypto,
      config,
      queue as any,
    );

    const payload = {
      eventKey: 'github-confirm:abc123:T-101',
      eventType: 'GITHUB_COMMIT_CONFIRMATION',
      title: 'Commit mapped',
      body: 'Confirm hours',
      targetUserIds: ['user_1'],
      channels: [NotificationChannel.IN_APP],
      payload: { commitSha: 'abc123' },
      source: NotificationSource.GITHUB,
    };

    const actor = {
      sub: 'admin_1',
      tenantId: 'tenant_1',
    } as Express.User;

    const first = await service.send('tenant_1', actor, payload as any);
    const second = await service.send('tenant_1', actor, payload as any);

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);

    const firstEventId = first.items[0]?.eventId;
    const secondEventId = second.items[0]?.eventId;

    expect(firstEventId).toBeDefined();
    expect(firstEventId).toBe(secondEventId);
    expect(tx.notificationEvent.create).toHaveBeenCalledTimes(1);
  });
});
