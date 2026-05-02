import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IntegrationType,
  NotificationChannel,
  NotificationSource,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { IntegrationSettingsService } from '../integration-settings.service';
import { ListGithubUnmatchedCommitsDto } from './dto/list-github-unmatched-commits.dto';
import { MapUnmatchedCommitDto } from './dto/map-unmatched-commit.dto';
import { UpsertGithubSettingsDto } from './dto/upsert-github-settings.dto';
import { GithubSignatureService } from './github-signature.service';

interface MatchedTenantContext {
  tenantId: string;
  settingId: string;
  config: Record<string, unknown>;
}

@Injectable()
export class GithubIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly integrationSettingsService: IntegrationSettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly signatureService: GithubSignatureService,
  ) {}

  async upsertSettings(tenantId: string, actorId: string, dto: UpsertGithubSettingsDto) {
    const regex = dto.taskKeyRegex?.trim() || 'T-\\d+';

    try {
      // Validate regex early.
      new RegExp(regex, 'i');
    } catch {
      throw new BadRequestException('taskKeyRegex is invalid');
    }

    const setting = await this.integrationSettingsService.upsert(
      tenantId,
      IntegrationType.GITHUB,
      actorId,
      {
        taskKeyRegex: regex,
        botUsernames: dto.botUsernames ?? ['dependabot[bot]', 'github-actions[bot]'],
      },
      {
        webhookSecret: dto.webhookSecret,
      },
      dto.enabled ?? true,
    );

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'GITHUB_SETTINGS_UPSERT',
      entityType: 'IntegrationSetting',
      entityId: setting.id,
      metadata: {
        enabled: setting.enabled,
      },
    });

    return {
      id: setting.id,
      enabled: setting.enabled,
      type: setting.type,
    };
  }

  async getSettings(tenantId: string) {
    const setting = await this.integrationSettingsService.get(tenantId, IntegrationType.GITHUB);

    if (!setting) {
      return null;
    }

    const config = this.integrationSettingsService.readConfig(setting.config);

    return {
      id: setting.id,
      type: setting.type,
      enabled: setting.enabled,
      config,
      maskedSecrets: setting.maskedSecrets,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }

  async handleWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer, payload: unknown) {
    const deliveryId = this.readSingleHeader(headers['x-github-delivery']);
    const eventType = this.readSingleHeader(headers['x-github-event']);
    const signatureHeader = this.readSingleHeader(headers['x-hub-signature-256']);

    if (!deliveryId || !eventType) {
      throw new BadRequestException('Missing required GitHub webhook headers');
    }

    const tenantContext = await this.resolveTenantBySecretMatch(signatureHeader, rawBody);

    if (!tenantContext) {
      throw new BadRequestException('Unable to verify webhook signature for any tenant');
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    const existing = await this.prisma.gitHubWebhookEvent.findUnique({
      where: {
        tenantId_deliveryId: {
          tenantId: tenantContext.tenantId,
          deliveryId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return {
        duplicate: true,
        eventId: existing.id,
      };
    }

    const created = await this.prisma.gitHubWebhookEvent.create({
      data: {
        tenantId: tenantContext.tenantId,
        integrationSettingId: tenantContext.settingId,
        deliveryId,
        eventType,
        signatureHeader,
        payloadHash,
        headers: this.normalizeHeaders(headers) as Prisma.InputJsonValue,
        rawPayload: (payload ?? {}) as Prisma.InputJsonValue,
        verified: true,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    try {
      await this.processWebhookPayload(created.tenantId, created.id, eventType, payload, tenantContext.config);

      await this.prisma.gitHubWebhookEvent.update({
        where: { id: created.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.gitHubWebhookEvent.update({
        where: { id: created.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Webhook processing failed',
          processedAt: new Date(),
        },
      });
      throw error;
    }

    return {
      duplicate: false,
      eventId: created.id,
    };
  }

  async listUnmatchedCommits(tenantId: string, query: ListGithubUnmatchedCommitsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.gitHubUnmatchedCommit.count({
        where: {
          tenantId,
          mappedTaskId: null,
        },
      }),
      this.prisma.gitHubUnmatchedCommit.findMany({
        where: {
          tenantId,
          mappedTaskId: null,
        },
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

  async mapUnmatchedCommit(
    tenantId: string,
    actor: Express.User,
    unmatchedId: string,
    dto: MapUnmatchedCommitDto,
  ) {
    const unmatched = await this.prisma.gitHubUnmatchedCommit.findFirst({
      where: {
        tenantId,
        id: unmatchedId,
      },
    });

    if (!unmatched) {
      throw new NotFoundException('Unmatched commit not found');
    }

    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        key: dto.taskKey,
        deletedAt: null,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const userId = unmatched.authorUserId ?? (await this.resolveUserIdFromIdentity(tenantId, unmatched.authorLogin, unmatched.authorEmail));

    const mapping = await this.upsertCommitMapping({
      tenantId,
      taskId: task.id,
      userId,
      sourceEventId: unmatched.sourceEventId,
      commitSha: unmatched.commitSha,
      repository: unmatched.repository,
      branchName: unmatched.branchName,
      commitMessage: unmatched.commitMessage,
      authorLogin: unmatched.authorLogin,
      authorEmail: unmatched.authorEmail,
      commitUrl: null,
    });

    await this.prisma.gitHubUnmatchedCommit.update({
      where: { id: unmatched.id },
      data: {
        mappedTaskId: task.id,
        mappedById: actor.sub,
        mappedAt: new Date(),
        authorUserId: userId,
      },
    });

    if (userId) {
      await this.emitCommitConfirmationEvent(tenantId, userId, task.key, unmatched.commitSha);
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'GITHUB_UNMATCHED_COMMIT_MAP',
      entityType: 'GitHubUnmatchedCommit',
      entityId: unmatched.id,
      metadata: {
        taskId: task.id,
        taskKey: task.key,
        mappingId: mapping.id,
      },
    });

    return {
      mapped: true,
      mappingId: mapping.id,
      taskKey: task.key,
    };
  }

  async listWebhookEvents(tenantId: string, query: ListGithubUnmatchedCommitsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.gitHubWebhookEvent.count({ where: { tenantId } }),
      this.prisma.gitHubWebhookEvent.findMany({
        where: { tenantId },
        orderBy: { receivedAt: 'desc' },
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

  private async processWebhookPayload(
    tenantId: string,
    sourceEventId: string,
    eventType: string,
    payload: unknown,
    githubConfig: Record<string, unknown>,
  ): Promise<void> {
    const objectPayload = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    const taskRegexValue =
      typeof githubConfig.taskKeyRegex === 'string' && githubConfig.taskKeyRegex.length > 0
        ? githubConfig.taskKeyRegex
        : 'T-\\d+';

    const taskRegex = new RegExp(taskRegexValue, 'i');

    const ignoredBots = Array.isArray(githubConfig.botUsernames)
      ? githubConfig.botUsernames.filter((entry): entry is string => typeof entry === 'string')
      : [];

    const senderLogin = this.readNestedString(objectPayload, ['sender', 'login']);
    if (senderLogin && ignoredBots.includes(senderLogin)) {
      return;
    }

    if (eventType === 'push') {
      await this.processPushEvent(tenantId, sourceEventId, objectPayload, taskRegex, ignoredBots);
      return;
    }

    if (eventType === 'pull_request') {
      await this.processPullRequestEvent(tenantId, sourceEventId, objectPayload, taskRegex, ignoredBots);
      return;
    }

    if (eventType === 'issues') {
      await this.processIssueEvent(tenantId, sourceEventId, objectPayload, taskRegex, ignoredBots);
    }
  }

  private async processPushEvent(
    tenantId: string,
    sourceEventId: string,
    payload: Record<string, unknown>,
    taskRegex: RegExp,
    ignoredBots: string[],
  ): Promise<void> {
    const commits = Array.isArray(payload.commits) ? (payload.commits as Array<Record<string, unknown>>) : [];
    const branch = this.parseBranchName(this.readNestedString(payload, ['ref']));
    const repository = this.readNestedString(payload, ['repository', 'full_name']);

    for (const commit of commits) {
      const commitSha = this.readNestedString(commit, ['id']) ?? this.readNestedString(commit, ['sha']);
      if (!commitSha) {
        continue;
      }

      const authorLogin = this.readNestedString(commit, ['author', 'username']);
      if (authorLogin && ignoredBots.includes(authorLogin)) {
        continue;
      }

      const authorEmail = this.readNestedString(commit, ['author', 'email']);
      const commitMessage = this.readNestedString(commit, ['message']) ?? '';
      const commitUrl = this.readNestedString(commit, ['url']);

      const matchedTaskKey = this.matchTaskKeyInOrder(taskRegex, [commitMessage, branch]);

      if (!matchedTaskKey) {
        const authorUserId = await this.resolveUserIdFromIdentity(tenantId, authorLogin, authorEmail);
        await this.createUnmatchedCommit({
          tenantId,
          sourceEventId,
          commitSha,
          repository,
          branchName: branch,
          commitMessage,
          authorLogin,
          authorEmail,
          candidateText: `${commitMessage} ${branch ?? ''}`.trim(),
          authorUserId,
        });
        continue;
      }

      await this.mapCommitToTaskAndNotify({
        tenantId,
        sourceEventId,
        commitSha,
        repository,
        branchName: branch,
        commitMessage,
        authorLogin,
        authorEmail,
        taskKey: matchedTaskKey,
        commitUrl,
      });
    }
  }

  private async processPullRequestEvent(
    tenantId: string,
    sourceEventId: string,
    payload: Record<string, unknown>,
    taskRegex: RegExp,
    ignoredBots: string[],
  ): Promise<void> {
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    if (!pr) {
      return;
    }

    const authorLogin = this.readNestedString(pr, ['user', 'login']);
    if (authorLogin && ignoredBots.includes(authorLogin)) {
      return;
    }

    const authorEmail = this.readNestedString(pr, ['user', 'email']);
    const title = this.readNestedString(pr, ['title']) ?? '';
    const body = this.readNestedString(pr, ['body']) ?? '';
    const branch = this.readNestedString(pr, ['head', 'ref']) ?? null;
    const commitSha = this.readNestedString(pr, ['head', 'sha']) ?? `pr:${this.readNestedString(pr, ['id']) ?? Date.now()}`;
    const repository = this.readNestedString(payload, ['repository', 'full_name']);
    const commitUrl = this.readNestedString(pr, ['html_url']);

    const matchedTaskKey = this.matchTaskKeyInOrder(taskRegex, [title, body, branch]);

    if (!matchedTaskKey) {
      const authorUserId = await this.resolveUserIdFromIdentity(tenantId, authorLogin, authorEmail);
      await this.createUnmatchedCommit({
        tenantId,
        sourceEventId,
        commitSha,
        repository,
        branchName: branch,
        commitMessage: title,
        authorLogin,
        authorEmail,
        candidateText: `${title} ${body}`.trim(),
        authorUserId,
      });
      return;
    }

    await this.mapCommitToTaskAndNotify({
      tenantId,
      sourceEventId,
      commitSha,
      repository,
      branchName: branch,
      commitMessage: title,
      authorLogin,
      authorEmail,
      taskKey: matchedTaskKey,
      commitUrl,
    });
  }

  private async processIssueEvent(
    tenantId: string,
    sourceEventId: string,
    payload: Record<string, unknown>,
    taskRegex: RegExp,
    ignoredBots: string[],
  ): Promise<void> {
    const issue = payload.issue as Record<string, unknown> | undefined;
    if (!issue) {
      return;
    }

    const authorLogin = this.readNestedString(issue, ['user', 'login']);
    if (authorLogin && ignoredBots.includes(authorLogin)) {
      return;
    }

    const authorEmail = this.readNestedString(issue, ['user', 'email']);
    const title = this.readNestedString(issue, ['title']) ?? '';
    const body = this.readNestedString(issue, ['body']) ?? '';
    const repository = this.readNestedString(payload, ['repository', 'full_name']);
    const commitSha = `issue:${this.readNestedString(issue, ['id']) ?? Date.now()}`;
    const commitUrl = this.readNestedString(issue, ['html_url']);

    const matchedTaskKey = this.matchTaskKeyInOrder(taskRegex, [title, body]);

    if (!matchedTaskKey) {
      const authorUserId = await this.resolveUserIdFromIdentity(tenantId, authorLogin, authorEmail);
      await this.createUnmatchedCommit({
        tenantId,
        sourceEventId,
        commitSha,
        repository,
        branchName: null,
        commitMessage: title,
        authorLogin,
        authorEmail,
        candidateText: `${title} ${body}`.trim(),
        authorUserId,
      });
      return;
    }

    await this.mapCommitToTaskAndNotify({
      tenantId,
      sourceEventId,
      commitSha,
      repository,
      branchName: null,
      commitMessage: title,
      authorLogin,
      authorEmail,
      taskKey: matchedTaskKey,
      commitUrl,
    });
  }

  private async mapCommitToTaskAndNotify(input: {
    tenantId: string;
    sourceEventId: string;
    commitSha: string;
    repository: string | null;
    branchName: string | null;
    commitMessage: string | null;
    authorLogin: string | null;
    authorEmail: string | null;
    taskKey: string;
    commitUrl: string | null;
  }) {
    const task = await this.prisma.task.findFirst({
      where: {
        tenantId: input.tenantId,
        key: input.taskKey,
        deletedAt: null,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (!task) {
      const authorUserId = await this.resolveUserIdFromIdentity(
        input.tenantId,
        input.authorLogin,
        input.authorEmail,
      );

      await this.createUnmatchedCommit({
        tenantId: input.tenantId,
        sourceEventId: input.sourceEventId,
        commitSha: input.commitSha,
        repository: input.repository,
        branchName: input.branchName,
        commitMessage: input.commitMessage,
        authorLogin: input.authorLogin,
        authorEmail: input.authorEmail,
        candidateText: `${input.commitMessage ?? ''} ${input.branchName ?? ''}`.trim(),
        authorUserId,
      });
      return;
    }

    const userId = await this.resolveUserIdFromIdentity(
      input.tenantId,
      input.authorLogin,
      input.authorEmail,
    );

    await this.upsertCommitMapping({
      tenantId: input.tenantId,
      taskId: task.id,
      userId,
      sourceEventId: input.sourceEventId,
      commitSha: input.commitSha,
      repository: input.repository,
      branchName: input.branchName,
      commitMessage: input.commitMessage,
      authorLogin: input.authorLogin,
      authorEmail: input.authorEmail,
      commitUrl: input.commitUrl,
    });

    if (userId) {
      await this.emitCommitConfirmationEvent(input.tenantId, userId, task.key, input.commitSha);
    }
  }

  private async createUnmatchedCommit(input: {
    tenantId: string;
    sourceEventId: string;
    commitSha: string;
    repository: string | null;
    branchName: string | null;
    commitMessage: string | null;
    authorLogin: string | null;
    authorEmail: string | null;
    candidateText: string;
    authorUserId: string | null;
  }) {
    try {
      await this.prisma.gitHubUnmatchedCommit.create({
        data: {
          tenantId: input.tenantId,
          sourceEventId: input.sourceEventId,
          commitSha: input.commitSha,
          repository: input.repository,
          branchName: input.branchName,
          commitMessage: input.commitMessage,
          authorLogin: input.authorLogin,
          authorEmail: input.authorEmail,
          candidateText: input.candidateText,
          authorUserId: input.authorUserId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  private async upsertCommitMapping(input: {
    tenantId: string;
    taskId: string;
    userId: string | null;
    sourceEventId: string | null;
    commitSha: string;
    repository: string | null;
    branchName: string | null;
    commitMessage: string | null;
    authorLogin: string | null;
    authorEmail: string | null;
    commitUrl: string | null;
  }) {
    try {
      return await this.prisma.gitHubCommitMapping.create({
        data: {
          tenantId: input.tenantId,
          taskId: input.taskId,
          userId: input.userId,
          sourceEventId: input.sourceEventId,
          commitSha: input.commitSha,
          repository: input.repository,
          branchName: input.branchName,
          commitMessage: input.commitMessage,
          authorLogin: input.authorLogin,
          authorEmail: input.authorEmail,
          commitUrl: input.commitUrl,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.gitHubCommitMapping.findFirstOrThrow({
          where: {
            tenantId: input.tenantId,
            commitSha: input.commitSha,
            taskId: input.taskId,
          },
        });
      }

      throw error;
    }
  }

  private async emitCommitConfirmationEvent(
    tenantId: string,
    userId: string,
    taskKey: string,
    commitSha: string,
  ) {
    await this.notificationsService.emitToUser({
      tenantId,
      userId,
      eventKey: `github-confirm:${commitSha}:${taskKey}`,
      eventType: 'GITHUB_COMMIT_CONFIRMATION',
      title: `Commit matched to ${taskKey}`,
      body: 'Reply with 30m, 1h, 2h or custom time to log work.',
      payload: {
        taskKey,
        commitSha,
        options: ['30m', '1h', '2h', 'custom'],
      },
      channels: [NotificationChannel.WHATSAPP, NotificationChannel.IN_APP],
      source: NotificationSource.GITHUB,
    });
  }

  private async resolveTenantBySecretMatch(
    signatureHeader: string | undefined,
    rawBody: Buffer,
  ): Promise<MatchedTenantContext | null> {
    const settings = await this.prisma.integrationSetting.findMany({
      where: {
        type: IntegrationType.GITHUB,
        enabled: true,
      },
      select: {
        id: true,
        tenantId: true,
        config: true,
        encryptedSecrets: true,
      },
    });

    for (const setting of settings) {
      const secrets = this.integrationSettingsService.readSecrets(setting.encryptedSecrets);
      const secret = secrets.webhookSecret;

      if (!secret) {
        continue;
      }

      if (this.signatureService.verifySignature(rawBody, signatureHeader, secret)) {
        return {
          tenantId: setting.tenantId,
          settingId: setting.id,
          config: this.integrationSettingsService.readConfig(setting.config),
        };
      }
    }

    return null;
  }

  private async resolveUserIdFromIdentity(
    tenantId: string,
    githubLogin: string | null,
    githubEmail: string | null,
  ): Promise<string | null> {
    if (githubLogin) {
      const mapped = await this.prisma.gitHubIdentityMap.findFirst({
        where: {
          tenantId,
          kind: 'USERNAME',
          value: githubLogin,
          isActive: true,
        },
        select: {
          userId: true,
        },
      });

      if (mapped) {
        return mapped.userId;
      }
    }

    if (githubEmail) {
      const mapped = await this.prisma.gitHubIdentityMap.findFirst({
        where: {
          tenantId,
          kind: 'EMAIL',
          value: githubEmail,
          isActive: true,
        },
        select: {
          userId: true,
        },
      });

      if (mapped) {
        return mapped.userId;
      }

      const user = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: githubEmail,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      return user?.id ?? null;
    }

    return null;
  }

  private parseBranchName(ref: string | null): string | null {
    if (!ref) {
      return null;
    }

    if (ref.startsWith('refs/heads/')) {
      return ref.slice('refs/heads/'.length);
    }

    return ref;
  }

  private matchTaskKeyInOrder(taskRegex: RegExp, values: Array<string | null>): string | null {
    for (const value of values) {
      if (!value) {
        continue;
      }

      const match = value.match(taskRegex);
      if (match?.[0]) {
        return match[0].toUpperCase();
      }
    }

    return null;
  }

  private readNestedString(obj: Record<string, unknown>, path: string[]): string | null {
    let current: unknown = obj;

    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current : null;
  }

  private readSingleHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private normalizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string | string[] | null> {
    const output: Record<string, string | string[] | null> = {};

    for (const [key, value] of Object.entries(headers)) {
      output[key] = value ?? null;
    }

    return output;
  }
}
