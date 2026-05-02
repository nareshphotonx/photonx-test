import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, TenantRbacScopeService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
