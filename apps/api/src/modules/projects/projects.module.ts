import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, TenantRbacScopeService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
