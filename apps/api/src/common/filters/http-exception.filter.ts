import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type ApiErrorResponse } from '../interfaces/api-response.interface';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeException(exception, statusCode);

    const payload: ApiErrorResponse = {
      success: false,
      statusCode,
      message: normalized.message,
      error: normalized.error,
      details: normalized.details,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    };

    this.logger.error(
      `${request.method} ${request.originalUrl ?? request.url} -> ${statusCode}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json(payload);
  }

  private normalizeException(
    exception: unknown,
    statusCode: number,
  ): { message: string; error: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          message: response,
          error: HttpStatus[statusCode] ?? 'Error',
        };
      }

      if (typeof response === 'object' && response !== null) {
        const objectResponse = response as Record<string, unknown>;
        const message = this.normalizeMessage(objectResponse.message);

        return {
          message,
          error:
            typeof objectResponse.error === 'string'
              ? objectResponse.error
              : HttpStatus[statusCode] ?? 'Error',
          details: objectResponse,
        };
      }
    }

    return {
      message:
        exception instanceof Error
          ? exception.message
          : 'Internal server error',
      error: HttpStatus[statusCode] ?? 'InternalServerError',
    };
  }

  private normalizeMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }

    return 'Request failed';
  }
}
