import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new PermissionsGuard(reflector);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no permissions metadata exists', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    const allowed = guard.canActivate({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions: [] } }),
      }),
    } as never);

    expect(allowed).toBe(true);
  });

  it('blocks when user lacks required permission', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['users:create']);

    const allowed = guard.canActivate({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions: ['users:read'] } }),
      }),
    } as never);

    expect(allowed).toBe(false);
  });
});
