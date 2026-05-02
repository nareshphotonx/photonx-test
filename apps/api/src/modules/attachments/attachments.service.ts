import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AttachmentStatus, Prisma } from '@prisma/client';
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
    await this.scopeService.ensureTaskManageAccess(tenantId, dto.taskId, actor);

    const { bucket, region, presignExpiresIn } = this.getS3Config();
    const client = this.createS3Client(region);

    const safeFileName = dto.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `${tenantId}/${dto.taskId}/${Date.now()}-${safeFileName}`;

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
    };
  }

  async confirmUpload(
    tenantId: string,
    actor: Express.User,
    dto: ConfirmUploadDto,
  ) {
    const task = await this.scopeService.ensureTaskManageAccess(
      tenantId,
      dto.taskId,
      actor,
    );

    const { bucket, region } = this.getS3Config();

    if (!dto.s3Key.startsWith(`${tenantId}/${dto.taskId}/`)) {
      throw new BadRequestException('s3Key does not belong to tenant/task scope');
    }

    try {
      const attachment = await this.prisma.taskAttachment.create({
        data: {
          tenantId,
          projectId: task.projectId,
          taskId: task.id,
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
        action: 'TASK_ATTACHMENT_CREATE',
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        metadata: {
          taskId: task.id,
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

    await this.scopeService.ensureTaskReadAccess(tenantId, attachment.taskId, actor);

    return attachment;
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
