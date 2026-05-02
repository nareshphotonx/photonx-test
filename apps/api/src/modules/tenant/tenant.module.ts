import { Module } from '@nestjs/common';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';

@Module({
  providers: [TenantContextGuard, TenantContextMiddleware],
  exports: [TenantContextGuard, TenantContextMiddleware],
})
export class TenantModule {}
