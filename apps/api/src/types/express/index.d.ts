declare namespace Express {
  interface User {
    sub: string;
    tenantId: string;
    sessionId: string;
    roles: string[];
    permissions: string[];
    [key: string]: unknown;
  }

  interface Request {
    requestId?: string;
    tenantId?: string;
    rawBody?: Buffer;
  }
}
