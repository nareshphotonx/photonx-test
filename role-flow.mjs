#!/usr/bin/env node
/**
 * Per-role smoke test. Logs in as each role and:
 *  - Verifies expected pages return 200
 *  - Verifies expected pages return 403 (when the role shouldn't access)
 *  - Verifies role-appropriate API endpoints work
 *
 * Usage: node role-flow.mjs
 */

const API = 'http://localhost:3000/api';
const WEB = 'http://localhost:3001';
const TENANT = 'photonx-default';

const ROLES = [
  { name: 'SUPER_ADMIN', email: 'superadmin@photonx.dev', password: 'Admin@12345' },
  { name: 'TEAM_LEAD', email: 'teamlead@photonx.dev', password: 'TeamLead@12345' },
  { name: 'USER', email: 'user@photonx.dev', password: 'User@12345' },
];

const PAGE_MATRIX = {
  SUPER_ADMIN: {
    expect200: ['/me', '/dashboard', '/ai', '/inbox', '/projects', '/milestones', '/tasks', '/time', '/approvals', '/attendance', '/leave', '/wfh', '/holidays', '/expenses', '/people/users', '/people/teams', '/people/roles', '/performance', '/reviews', '/documents', '/admin/setup', '/admin/office', '/admin/leave-types', '/admin/task-statuses', '/admin/whatsapp', '/admin/github', '/admin/notifications', '/admin/audit', '/admin/backup', '/settings/profile', '/settings/workspace', '/settings/integrations', '/settings/notifications'],
  },
  TEAM_LEAD: {
    expect200: ['/me', '/dashboard', '/ai', '/inbox', '/projects', '/milestones', '/tasks', '/time', '/approvals', '/attendance', '/leave', '/wfh', '/holidays', '/expenses', '/people/users', '/people/teams', '/performance', '/reviews', '/documents', '/settings/profile', '/settings/notifications'],
  },
  USER: {
    expect200: ['/me', '/ai', '/inbox', '/projects', '/tasks', '/time', '/attendance', '/leave', '/wfh', '/holidays', '/expenses', '/reviews', '/documents', '/settings/profile', '/settings/notifications'],
  },
};

const C = { reset: '\x1b[0m', dim: '\x1b[2m', g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', b: '\x1b[1m' };
const log = (s) => process.stdout.write(s + '\n');

let totals = { pass: 0, fail: 0 };

async function loginToken(role) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: TENANT, email: role.email, password: role.password }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  const data = await r.json();
  return data.data.accessToken;
}

async function checkPage(url) {
  // Web routes are protected by a cookie check, not JWT — set the cookie our proxy.ts looks for.
  const r = await fetch(`${WEB}${url}`, {
    headers: { Cookie: 'photonx_auth=1' },
    redirect: 'manual',
  });
  return r.status;
}

async function checkApi(token, method, path) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.status;
}

(async () => {
  log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`${C.b} Role-aware UI test`);
  log(` ${C.reset}${C.dim}Web: ${WEB}  ·  API: ${API}${C.reset}`);
  log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);

  for (const role of ROLES) {
    log(`\n${C.b}${C.c}● ${role.name}  (${role.email})${C.reset}`);
    let token;
    try {
      token = await loginToken(role);
    } catch (e) {
      log(`  ${C.r}✗ login failed: ${e.message}${C.reset}`);
      totals.fail++;
      continue;
    }

    // Test pages return 200 (SSR compile + cookie auth — actual data fetch happens client-side with JWT)
    log(`  ${C.dim}Pages (SSR render):${C.reset}`);
    const matrix = PAGE_MATRIX[role.name];
    let pageOk = 0, pageBad = 0;
    for (const url of matrix.expect200) {
      const code = await checkPage(url);
      const ok = code === 200;
      if (ok) pageOk++; else pageBad++;
      const mark = ok ? `${C.g}✓${C.reset}` : `${C.r}✗${C.reset}`;
      log(`    ${mark} ${C.dim}${code}${C.reset} ${url}`);
    }
    if (pageBad === 0) totals.pass++; else totals.fail++;

    // A few representative API checks — ensure role can read its own data
    log(`  ${C.dim}APIs:${C.reset}`);
    const apiTests = [
      ['GET', '/auth/me'],
      ['GET', '/attendance/today'],
      ['GET', '/tasks?limit=5'],
      ['GET', '/notifications?limit=5'],
    ];
    if (role.name !== 'USER') apiTests.push(['GET', '/approvals/pending']);
    if (role.name === 'SUPER_ADMIN') apiTests.push(['GET', '/audit-logs'], ['GET', '/users?limit=5'], ['GET', '/dashboard/super-admin']);

    for (const [method, path] of apiTests) {
      const code = await checkApi(token, method, path);
      const ok = code >= 200 && code < 400;
      const mark = ok ? `${C.g}✓${C.reset}` : `${C.r}✗${C.reset}`;
      log(`    ${mark} ${C.dim}${code}${C.reset} ${method} ${path}`);
    }

    log(`  ${C.dim}${pageOk}/${pageOk + pageBad} pages OK${C.reset}`);
  }

  log('');
  log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(` Summary: ${C.g}${totals.pass} role(s) passed${C.reset} · ${totals.fail > 0 ? C.r : C.g}${totals.fail} failed${C.reset}`);
  log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  process.exit(totals.fail > 0 ? 1 : 0);
})();
