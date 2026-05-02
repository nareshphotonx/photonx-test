export interface JwtPayload {
  sub: string;
  tenantId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}
