import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppLogger } from './common/logger/app.logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const corsOrigins = parseCsv(process.env.CORS_ORIGINS);
  app.enableCors({
    origin:
      corsOrigins.length > 0
        ? corsOrigins
        : true,
    methods:
      parseCsv(process.env.CORS_METHODS).join(',') ||
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      parseCsv(process.env.CORS_ALLOWED_HEADERS).join(',') ||
      'Content-Type,Authorization,x-tenant-id,x-request-id',
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  });

  const helmetCspEnabled = parseBoolean(process.env.HELMET_ENABLE_CSP, false);
  app.use(
    helmet({
      contentSecurityPolicy: helmetCspEnabled ? undefined : false,
    }),
  );

  app.use((request: Request, response: Response, next: NextFunction) => {
    const maxSize = Number(process.env.REQUEST_BODY_LIMIT_BYTES ?? '1048576');
    const contentLengthHeader = request.headers['content-length'];
    const contentLength = Number(
      typeof contentLengthHeader === 'string' ? contentLengthHeader : '0',
    );

    if (
      Number.isFinite(maxSize) &&
      maxSize > 0 &&
      Number.isFinite(contentLength) &&
      contentLength > maxSize
    ) {
      const requestId = request.requestId ?? null;
      response.status(413).json({
        success: false,
        statusCode: 413,
        message: 'Request entity too large',
        error: 'Payload Too Large',
        errorCode: 'REQUEST_TOO_LARGE',
        details: {
          maxBytes: maxSize,
          contentLength,
        },
        requestId,
        timestamp: new Date().toISOString(),
        path: request.originalUrl ?? request.url,
      });
      return;
    }

    next();
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'webhooks/whatsapp', method: RequestMethod.GET },
      { path: 'webhooks/whatsapp', method: RequestMethod.POST },
      { path: 'webhooks/github', method: RequestMethod.POST },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PhotonX WorkOS API')
    .setDescription('Backend foundation for PhotonX WorkOS')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: 'x-tenant-id',
      required: false,
      in: 'header',
      description: 'Tenant context header',
    })
    .addGlobalParameters({
      name: 'x-request-id',
      required: false,
      in: 'header',
      description: 'Request correlation ID',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  applySwaggerDefaults(document);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}`);
}

void bootstrap();

function parseCsv(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseBoolean(input: string | undefined, defaultValue: boolean): boolean {
  if (input === undefined) {
    return defaultValue;
  }

  return input.toLowerCase() === 'true';
}

function applySwaggerDefaults(document: { paths?: unknown }): void {
  const paths = (document.paths ?? {}) as Record<
    string,
    Record<string, Record<string, unknown>>
  >;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const op = operation as Record<string, unknown>;
      const responses = (op.responses ?? {}) as Record<string, Record<string, unknown>>;

      ensureSuccessResponse(responses, method, path);
      ensureErrorResponse(responses, '400', 'Bad Request', 'VALIDATION_ERROR');
      ensureErrorResponse(responses, '401', 'Unauthorized', 'AUTH_UNAUTHORIZED');
      ensureErrorResponse(responses, '403', 'Forbidden', 'AUTH_FORBIDDEN');
      ensureErrorResponse(responses, '404', 'Not Found', 'RESOURCE_NOT_FOUND');
      ensureErrorResponse(responses, '429', 'Too Many Requests', 'RATE_LIMIT_EXCEEDED');
      ensureErrorResponse(responses, '500', 'Internal Server Error', 'INTERNAL_ERROR');

      op.responses = responses;
    }
  }
}

function ensureSuccessResponse(
  responses: Record<string, Record<string, unknown>>,
  method: string,
  path: string,
): void {
  const status = method.toLowerCase() === 'post' ? '201' : '200';
  const existing =
    responses[status] ??
    responses['200'] ??
    responses['201'] ??
    responses['204'];

  if (existing && hasJsonExample(existing)) {
    return;
  }

  const base = existing ?? {
    description: 'Request successful',
  };

  responses[status] = {
    ...base,
    content: {
      ...(typeof base.content === 'object' && base.content !== null
        ? (base.content as Record<string, unknown>)
        : {}),
      'application/json': {
        ...(readJsonContent(base) ?? {}),
        example: {
          success: true,
          statusCode: Number(status),
          message: 'Request successful',
          data: {},
          requestId: 'req_123',
          timestamp: '2026-05-02T00:00:00.000Z',
          path,
        },
      },
    },
  };
}

function ensureErrorResponse(
  responses: Record<string, Record<string, unknown>>,
  status: string,
  label: string,
  errorCode: string,
): void {
  const existing = responses[status] ?? {
    description: label,
  };

  if (existing && hasJsonExample(existing)) {
    return;
  }

  responses[status] = {
    ...existing,
    content: {
      ...(typeof existing.content === 'object' && existing.content !== null
        ? (existing.content as Record<string, unknown>)
        : {}),
      'application/json': {
        ...(readJsonContent(existing) ?? {}),
        example: {
          success: false,
          statusCode: Number(status),
          message: label,
          error: label,
          errorCode,
          details: {},
          requestId: 'req_123',
          timestamp: '2026-05-02T00:00:00.000Z',
          path: '/api/example',
        },
      },
    },
  };
}

function readJsonContent(
  response: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (
    typeof response.content === 'object' &&
    response.content !== null &&
    'application/json' in response.content
  ) {
    const content = (response.content as Record<string, unknown>)['application/json'];
    if (content && typeof content === 'object') {
      return content as Record<string, unknown>;
    }
  }

  return undefined;
}

function hasJsonExample(response: Record<string, unknown>): boolean {
  const json = readJsonContent(response);
  return !!json?.example;
}
