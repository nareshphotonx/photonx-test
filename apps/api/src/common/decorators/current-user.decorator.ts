import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Express.User | undefined => {
    const request = context.switchToHttp().getRequest<Express.Request>();
    return request.user;
  },
);
