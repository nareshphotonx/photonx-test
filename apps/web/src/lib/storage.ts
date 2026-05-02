const ACCESS = 'photonx.accessToken';
const REFRESH = 'photonx.refreshToken';
const USER = 'photonx.user';
const TENANT_SLUG = 'photonx.tenantSlug';

export type StoredUser = {
  id: string;
  tenantId: string;
  email?: string;
  phone?: string;
  fullName?: string;
  roles?: string[];
};

export const storage = {
  getAccessToken: (): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(ACCESS),
  getRefreshToken: (): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(REFRESH),
  getUser: (): StoredUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      localStorage.removeItem(USER);
      return null;
    }
  },
  getTenantSlug: (): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(TENANT_SLUG),
  setSession: (accessToken: string, refreshToken: string, user: StoredUser | null | undefined, tenantSlug?: string) => {
    localStorage.setItem(ACCESS, accessToken);
    localStorage.setItem(REFRESH, refreshToken);
    if (user) localStorage.setItem(USER, JSON.stringify(user));
    if (tenantSlug) localStorage.setItem(TENANT_SLUG, tenantSlug);
    document.cookie = `photonx_auth=1; path=/; max-age=2592000; samesite=lax`;
  },
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS, accessToken);
    localStorage.setItem(REFRESH, refreshToken);
    document.cookie = `photonx_auth=1; path=/; max-age=2592000; samesite=lax`;
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
    document.cookie = 'photonx_auth=; path=/; max-age=0; samesite=lax';
  },
};
