'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { landingFor } from '@/lib/roles';

/**
 * Root index — redirects to the role-appropriate landing page.
 * USER → /me, TEAM_LEAD/SUPER_ADMIN → /dashboard. Falls back to /login if unauth.
 */
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const user = storage.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(landingFor(user));
  }, [router]);
  return null;
}
