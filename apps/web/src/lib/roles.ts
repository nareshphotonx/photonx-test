'use client';

import { useEffect, useState } from 'react';
import { storage, type StoredUser } from './storage';

export const ROLES = ['SUPER_ADMIN', 'TEAM_LEAD', 'USER'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = {
  SUPER_ADMIN: 3,
  TEAM_LEAD: 2,
  USER: 1,
};

export function userRoles(user: StoredUser | null): Role[] {
  const raw = user?.roles ?? [];
  return raw
    .map((r) => (typeof r === 'string' ? r : (r as { code?: string; name?: string })?.code ?? (r as { name?: string })?.name ?? ''))
    .map((s) => s.toUpperCase())
    .filter((s): s is Role => (ROLES as readonly string[]).includes(s));
}

export function primaryRole(user: StoredUser | null): Role {
  const r = userRoles(user);
  if (r.length === 0) return 'USER';
  return r.sort((a, b) => RANK[b] - RANK[a])[0];
}

export function hasRole(user: StoredUser | null, ...needed: Role[]): boolean {
  const r = userRoles(user);
  return needed.some((n) => r.includes(n));
}

/** True if user has the given role OR a strictly higher one. */
export function atLeast(user: StoredUser | null, min: Role): boolean {
  const r = userRoles(user);
  if (r.length === 0) return false;
  const max = Math.max(...r.map((x) => RANK[x]));
  return max >= RANK[min];
}

/** Where a fresh login should land based on the user's role. */
export function landingFor(user: StoredUser | null): string {
  const role = primaryRole(user);
  if (role === 'USER') return '/me';
  return '/dashboard';
}

/**
 * Hook that returns the current user from localStorage and re-renders
 * after mount. SSR-safe (returns null on server).
 */
export function useCurrentUser(): { user: StoredUser | null; loaded: boolean } {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setUser(storage.getUser());
    setLoaded(true);
  }, []);
  return { user, loaded };
}

export function useRole(): { user: StoredUser | null; loaded: boolean; role: Role; roles: Role[] } {
  const { user, loaded } = useCurrentUser();
  return { user, loaded, role: primaryRole(user), roles: userRoles(user) };
}
