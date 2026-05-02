import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Express.Request>();

    // Foundation skeleton: tenant enforcement policies can be applied here later.
    request.tenantId = request.tenantId ?? undefined;

    return true;
  }
}
