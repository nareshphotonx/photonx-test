import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { ReviewEntriesController } from './review-entries.controller';
import { ReviewEntriesService } from './review-entries.service';

@Module({
  controllers: [ReviewEntriesController],
  providers: [ReviewEntriesService, TenantRbacScopeService],
})
export class ReviewEntriesModule {}
