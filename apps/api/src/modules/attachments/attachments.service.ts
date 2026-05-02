import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AttachmentEntityType, AttachmentStatus, Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreatePresignedUrlDto } from './dto/create-presigned-url.dto';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async createPresignedUrl(
    tenantId: string,
    actor: Express.User,
    dto: CreatePresignedUrlDto,
  ) {
    const entityType = this.resolveEntityType(dto.entityType, dto.taskId, dto.entityId);
    const context = await this.resolveAttachmentContext(tenantId, actor, entityType, dto);

    const { bucket, region, presignExpiresIn } = this.getS3Config();
    const client = this.createS3Client(region);

    const safeFileName = dto.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const scopeId = context.entityId ?? context.projectId;
    const key = `${tenantId}/${entityType.toLowerCase()}/${scopeId}/${Date.now()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.contentType,
      ContentLength: dto.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: presignExpiresIn,
    });

    return {
      bucket,
      key,
      uploadUrl,
      expiresInSeconds: presignExpiresIn,
      entityType,
      entityId: context.entityId,
      projectId: context.projectId,
    };
  }

  async confirmUpload(
    tenantId: string,
    actor: Express.User,
    dto: ConfirmUploadDto,
  ) {
    const entityType = this.resolveEntityType(dto.entityType, dto.taskId, dto.entityId);
    const context = await this.resolveAttachmentContext(tenantId, actor, entityType, dto);

    if (!dto.s3Key.startsWith(`${tenantId}/`)) {
      throw new BadRequestException('s3Key does not belong to tenant scope');
    }

    const { bucket, region } = this.getS3Config();

    try {
      const attachment = await this.prisma.taskAttachment.create({
        data: {
          tenantId,
          entityType,
          entityId: context.entityId,
          projectId: context.projectId,
          taskId: context.taskId,
          uploaderId: actor.sub,
          s3Key: dto.s3Key,
          fileName: dto.fileName,
          contentType: dto.contentType,
          sizeBytes: dto.sizeBytes,
          status: AttachmentStatus.UPLOADED,
          url: `https://${bucket}.s3.${region}.amazonaws.com/${dto.s3Key}`,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'ATTACHMENT_CONFIRM_UPLOAD',
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        metadata: {
          entityType,
          entityId: context.entityId,
          taskId: context.taskId,
          projectId: context.projectId,
          s3Key: dto.s3Key,
        },
      });

      return attachment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Attachment key already confirmed');
      }

      throw error;
    }
  }

  async getAttachment(tenantId: string, actor: Express.User, attachmentId: string) {
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: {
        tenantId,
        id: attachmentId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.entityType === AttachmentEntityType.TASK && attachment.taskId) {
      await this.scopeService.ensureTaskReadAccess(tenantId, attachment.taskId, actor);
      return attachment;
    }

    if (this.isSuperAdmin(actor)) {
      return attachment;
    }

    if (attachment.uploaderId === actor.sub) {
      return attachment;
    }

    if (this.isTeamLead(actor)) {
      const overlap = await this.hasTeamOverlap(tenantId, actor.sub, attachment.uploaderId);
      if (overlap) {
        return attachment;
      }
    }

    throw new ForbiddenException('No access to attachment');
  }

  private resolveEntityType(
    explicitType: AttachmentEntityType | undefined,
    taskId: string | undefined,
    entityId: string | undefined,
  ): AttachmentEntityType {
    if (explicitType) {
      return explicitType;
    }

    if (taskId || entityId) {
      return AttachmentEntityType.TASK;
    }

    return AttachmentEntityType.EXPENSE;
  }

  private async resolveAttachmentContext(
    tenantId: string,
    actor: Express.User,
    entityType: AttachmentEntityType,
    dto: Pick<CreatePresignedUrlDto, 'taskId' | 'entityId' | 'projectId'>,
  ): Promise<{ entityId: string | null; taskId: string | null; projectId: string }> {
    if (entityType === AttachmentEntityType.TASK) {
      const taskId = dto.taskId ?? dto.entityId;

      if (!taskId) {
        throw new BadRequestException('taskId (or entityId) is required for TASK attachments');
      }

      const task = await this.scopeService.ensureTaskManageAccess(tenantId, taskId, actor);

      return {
        entityId: task.id,
        taskId: task.id,
        projectId: task.projectId,
      };
    }

    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for EXPENSE attachments');
    }

    await this.scopeService.ensureProjectReadAccess(tenantId, dto.projectId, actor);

    if (dto.entityId) {
      const expense = await this.prisma.expense.findFirst({
        where: {
          tenantId,
          id: dto.entityId,
          projectId: dto.projectId,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found for provided entityId');
      }

      if (
        !this.isSuperAdmin(actor) &&
        expense.userId !== actor.sub &&
        !(await this.hasTeamOverlap(tenantId, actor.sub, expense.userId))
      ) {
        throw new ForbiddenException('No access to expense attachment scope');
      }

      return {
        entityId: expense.id,
        taskId: null,
        projectId: dto.projectId,
      };
    }

    return {
      entityId: null,
      taskId: null,
      projectId: dto.projectId,
    };
  }

  private async hasTeamOverlap(
    tenantId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const [actorTeams, targetTeams] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: actorId,
        },
        select: { teamId: true },
      }),
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        select: { teamId: true },
      }),
    ]);

    const targetSet = new Set(targetTeams.map((entry) => entry.teamId));
    return actorTeams.some((entry) => targetSet.has(entry.teamId));
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && actor.roles.includes(Role.TEAM_LEAD);
  }

  private getS3Config(): {
    bucket: string;
    region: string;
    presignExpiresIn: number;
  } {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_REGION');
    const presignExpiresIn = Number(
      this.configService.get<string>('AWS_S3_PRESIGN_EXPIRES_IN_SEC', '900'),
    );

    if (!bucket || !region) {
      throw new BadRequestException('AWS_S3_BUCKET and AWS_REGION must be configured');
    }

    return {
      bucket,
      region,
      presignExpiresIn,
    };
  }

  private createS3Client(region: string): S3Client {
    return new S3Client({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }
}
