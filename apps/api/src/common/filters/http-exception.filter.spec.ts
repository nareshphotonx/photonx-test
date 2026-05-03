import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './http-exception.filter';

describe('GlobalHttpExceptionFilter', () => {
  const filter = new GlobalHttpExceptionFilter();

  const createHost = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const request = {
      method: 'POST',
      url: '/api/users',
      originalUrl: '/api/users',
      requestId: 'req_abc',
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    return { host, response };
  };

  it('normalizes validation errors with deterministic errorCode', () => {
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        message: ['name must be a string', 'email must be valid'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    const payload = response.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      success: false,
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      requestId: 'req_abc',
      path: '/api/users',
    });
    expect(payload.message).toContain('name must be a string');
    expect(payload.details.message).toEqual([
      'name must be a string',
      'email must be valid',
    ]);
  });

  it('respects explicit errorCode in exception payload', () => {
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        message: 'invalid payload',
        error: 'Bad Request',
        statusCode: 400,
        errorCode: 'CUSTOM_CODE',
      }),
      host,
    );

    const payload = response.json.mock.calls[0][0];
    expect(payload.errorCode).toBe('CUSTOM_CODE');
  });
});

