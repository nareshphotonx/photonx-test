import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const tenantHeader = request.headers['x-tenant-id'];

    if (typeof tenantHeader === 'string' && tenantHeader.trim().length > 0) {
      request.tenantId = tenantHeader.trim();
    }

    next();
  }
}
