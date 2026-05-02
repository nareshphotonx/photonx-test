import { Module } from '@nestjs/common';
import { RbacBootstrapService } from '../../common/services/rbac-bootstrap.service';
import { AuthModule } from '../auth/auth.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService, RbacBootstrapService],
  exports: [TenantsService],
})
export class TenantsModule {}
