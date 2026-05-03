import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { type NextFunction, type Request, type Response } from 'express';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const incomingRequestId = request.headers['x-request-id'];

    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
        ? incomingRequestId.trim()
        : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    const userAgentHeader = request.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string'
        ? userAgentHeader
        : undefined;

    this.requestContextService.run(
      {
        requestId,
        ipAddress: request.ip,
        userAgent,
      },
      () => next(),
    );
  }
}
