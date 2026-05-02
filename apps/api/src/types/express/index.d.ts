declare namespace Express {
  interface User {
    sub: string;
    tenantId?: string;
    roles?: string[];
    [key: string]: unknown;
  }

  interface Request {
    requestId?: string;
    tenantId?: string;
  }
}
