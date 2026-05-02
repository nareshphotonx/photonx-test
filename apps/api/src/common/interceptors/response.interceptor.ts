import {
  CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Observable, map } from 'rxjs';
import { type ApiSuccessResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: response.statusCode,
        message: this.resolveMessage(response.statusCode),
        data,
        requestId: request.requestId ?? null,
        timestamp: new Date().toISOString(),
        path: request.originalUrl ?? request.url,
      })),
    );
  }

  private resolveMessage(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'Request successful';
    }

    return 'Request processed';
  }
}
