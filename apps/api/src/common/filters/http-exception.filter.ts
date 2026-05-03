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
import { sanitizeForLog } from '../logger/log-sanitizer.util';

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
      errorCode: normalized.errorCode,
      details: normalized.details,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    };

    this.logger.error(
      `${request.method} ${request.originalUrl ?? request.url} -> ${statusCode} [${normalized.errorCode}]`,
      exception instanceof Error ? exception.stack : undefined,
      JSON.stringify(
        sanitizeForLog({
          requestId: request.requestId,
          details: normalized.details,
        }),
      ),
    );

    response.status(statusCode).json(payload);
  }

  private normalizeException(
    exception: unknown,
    statusCode: number,
  ): { message: string; error: string; errorCode: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          message: response,
          error: HttpStatus[statusCode] ?? 'Error',
          errorCode: this.resolveErrorCode(statusCode),
        };
      }

      if (typeof response === 'object' && response !== null) {
        const objectResponse = response as Record<string, unknown>;
        const message = this.normalizeMessage(objectResponse.message);
        const explicitErrorCode =
          typeof objectResponse.errorCode === 'string'
            ? objectResponse.errorCode
            : undefined;

        const errorCode =
          explicitErrorCode ??
          (Array.isArray(objectResponse.message)
            ? 'VALIDATION_ERROR'
            : this.resolveErrorCode(statusCode));

        return {
          message,
          error:
            typeof objectResponse.error === 'string'
              ? objectResponse.error
              : HttpStatus[statusCode] ?? 'Error',
          errorCode,
          details: this.normalizeDetails(objectResponse),
        };
      }
    }

    return {
      message:
        exception instanceof Error
          ? exception.message
          : 'Internal server error',
      error: HttpStatus[statusCode] ?? 'InternalServerError',
      errorCode: this.resolveErrorCode(statusCode),
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

  private normalizeDetails(input: Record<string, unknown>): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (key === 'errorCode') {
        continue;
      }

      details[key] = value;
    }

    return details;
  }

  private resolveErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'RESOURCE_CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'REQUEST_TOO_LARGE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
