import { type Role } from '../../../common/enums/role.enum';

export interface JwtPayload {
  sub: string;
  tenantId?: string;
  roles?: Role[];
  iat?: number;
  exp?: number;
}
