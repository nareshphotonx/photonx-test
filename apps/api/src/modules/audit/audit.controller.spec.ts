import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { AuditController } from './audit.controller';

describe('AuditController metadata', () => {
  it('restricts audit log endpoint to super admin with explicit permission', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuditController.prototype.listAuditLogs);
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AuditController.prototype.listAuditLogs,
    );

    expect(roles).toEqual([Role.SUPER_ADMIN]);
    expect(permissions).toEqual([PERMISSIONS.AUDIT_LOGS_READ]);
  });
});

