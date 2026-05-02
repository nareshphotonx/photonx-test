import { api, get, post } from './api';
import { storage, type StoredUser } from './storage';

export type LoginInput = {
  tenantSlug: string;
  email?: string;
  phone?: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

type JwtPayload = {
  sub: string;
  tenantId: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function userFromToken(token: string, fallbackEmail?: string): StoredUser {
  const payload = decodeJwt(token);
  return {
    id: payload?.sub ?? '',
    tenantId: payload?.tenantId ?? '',
    email: fallbackEmail,
    roles: payload?.roles,
  };
}

export async function login(input: LoginInput): Promise<LoginResponse & { user: StoredUser }> {
  const res = await post<LoginResponse>('/auth/login', input);
  const user = userFromToken(res.accessToken, input.email);
  storage.setSession(res.accessToken, res.refreshToken, user, input.tenantSlug);
  // Fire-and-forget enrichment with /me — don't block login if it fails.
  void fetchMe()
    .then((me) => {
      const current = storage.getUser();
      storage.setSession(res.accessToken, res.refreshToken, { ...current, ...me } as StoredUser, input.tenantSlug);
    })
    .catch(() => {});
  return { ...res, user };
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
  }
  storage.clear();
}

export async function fetchMe(): Promise<StoredUser> {
  return get<StoredUser>('/auth/me');
}
