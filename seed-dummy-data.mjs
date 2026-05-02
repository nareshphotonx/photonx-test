#!/usr/bin/env node
/**
 * Dummy-data seeder for PhotonX WorkOS pilots.
 *
 * Usage:
 *   node seed-dummy-data.mjs
 *
 * Logs in as superadmin and creates a realistic mix of:
 *   - office locations + IPs
 *   - leave types + holidays + a leave request
 *   - expense categories + an expense
 *   - one extra team and a few users
 *   - several tasks across projects (with assignees, statuses, due dates)
 *   - a few WFH requests
 *
 * Safe to re-run: every entity has a unique code/key tied to a counter,
 * and the script tolerates "already exists" responses.
 */

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'photonx-default';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'superadmin@photonx.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';

const RUN_ID = String(Date.now()).slice(-6);

let token = '';
let tenantId = '';

function log(line) {
  process.stdout.write(line + '\n');
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function safeCall(label, method, path, body) {
  const r = await call(method, path, body);
  if (r.status >= 200 && r.status < 300) {
    log(`  ✓ ${label}`);
    return r.json?.data ?? r.json;
  }
  const msg = Array.isArray(r.json?.message) ? r.json.message.join(', ') : r.json?.message ?? r.json?.error ?? r.json?.raw ?? 'unknown';
  if (r.status === 409 || /already exists|duplicate|unique constraint/i.test(msg)) {
    log(`  • ${label} (already exists, skipped)`);
    return null;
  }
  log(`  ✗ ${label}  [${r.status}] ${msg}`);
  return null;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function login() {
  log('\n→ Logging in as superadmin');
  const r = await call('POST', '/auth/login', {
    tenantSlug: TENANT_SLUG,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (r.status !== 200) {
    log(`  ✗ Login failed: ${JSON.stringify(r.json).slice(0, 300)}`);
    process.exit(1);
  }
  token = r.json.data.accessToken;
  // Decode JWT for tenantId
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    tenantId = payload.tenantId ?? '';
    log(`  ✓ Got token, tenantId=${tenantId.slice(0, 8)}…`);
  } catch (e) {
    log(`  ✗ Could not decode JWT: ${e.message}`);
  }
}

async function seedOffice() {
  log('\n→ Office locations & IPs');
  await safeCall(
    'Add office: Bangalore HQ',
    'POST', '/office-locations',
    { name: 'Bangalore HQ', address: '100 MG Road, Bangalore', latitude: 12.9716, longitude: 77.5946, isActive: true },
  );
  await safeCall(
    'Add office: Mumbai branch',
    'POST', '/office-locations',
    { name: 'Mumbai branch', address: '500 BKC, Mumbai', latitude: 19.0608, longitude: 72.8364, isActive: true },
  );
  await safeCall(
    'Add office IP: corp Wi-Fi',
    'POST', '/office-ips',
    { cidr: '203.0.113.0/24', label: 'HQ Wi-Fi', isActive: true },
  );
}

async function seedLeaveTypes() {
  log('\n→ Leave types');
  await safeCall('Casual', 'POST', '/leave-types', { code: 'CASUAL', name: 'Casual leave', description: 'Short personal time off', isActive: true });
  await safeCall('Sick', 'POST', '/leave-types', { code: 'SICK', name: 'Sick leave', description: 'Health-related time off', isActive: true });
  await safeCall('Earned', 'POST', '/leave-types', { code: 'EARNED', name: 'Earned leave', description: 'Annual paid leave', isActive: true });
}

async function seedHolidays() {
  log('\n→ Holidays');
  const year = new Date().getFullYear();
  const holidays = [
    { name: 'Republic Day', date: `${year}-01-26` },
    { name: 'Independence Day', date: `${year}-08-15` },
    { name: 'Gandhi Jayanti', date: `${year}-10-02` },
    { name: 'Diwali (optional)', date: `${year}-11-12`, isOptional: true },
    { name: 'Christmas', date: `${year}-12-25` },
  ];
  for (const h of holidays) {
    await safeCall(`${h.name} (${h.date})`, 'POST', '/holidays', { ...h, date: new Date(h.date).toISOString(), isActive: true });
  }
}

async function seedExpenseCategories() {
  log('\n→ Expense categories');
  await safeCall('Travel', 'POST', '/expense-categories', { code: 'TRAVEL', name: 'Travel', description: 'Cabs, flights, fuel', isActive: true });
  await safeCall('Food', 'POST', '/expense-categories', { code: 'FOOD', name: 'Food & beverages', description: 'Client meals, team lunches', isActive: true });
  await safeCall('Software', 'POST', '/expense-categories', { code: 'SOFTWARE', name: 'Software & SaaS', description: 'Subscriptions and tools', isActive: true });
}

async function seedTeams() {
  log('\n→ Teams');
  await safeCall(`Engineering ${RUN_ID}`, 'POST', '/teams', { name: `Engineering`, description: 'Builds the product' });
  await safeCall(`Design ${RUN_ID}`, 'POST', '/teams', { name: `Design`, description: 'Owns user experience' });
}

async function seedUsers() {
  log('\n→ Users');
  const users = [
    { name: `Riya Mehra ${RUN_ID}`, email: `riya.${RUN_ID}@photonx.dev`, password: 'User@12345' },
    { name: `Arjun Verma ${RUN_ID}`, email: `arjun.${RUN_ID}@photonx.dev`, password: 'User@12345' },
    { name: `Priya Iyer ${RUN_ID}`, email: `priya.${RUN_ID}@photonx.dev`, password: 'User@12345' },
  ];
  for (const u of users) {
    await safeCall(u.name, 'POST', '/users', u);
  }
}

async function seedTasks() {
  log('\n→ Tasks (across existing projects)');
  const projects = (await call('GET', '/projects?limit=10')).json?.data?.items ?? [];
  if (!projects.length) { log('  • no projects, skipping'); return; }
  const users = (await call('GET', '/users?limit=50')).json?.data?.items ?? [];
  const titles = [
    'Migrate auth to OAuth provider',
    'Fix layout overflow on tablet',
    'Add CSV export to reports',
    'Investigate slow query on dashboard',
    'Refresh marketing copy',
    'Set up staging environment',
    'Onboarding wizard for new users',
    'Wire SSO to Google Workspace',
    'Refactor permission middleware',
    'Polish empty states across app',
    'Performance: lazy-load images',
    'Mobile menu accessibility audit',
  ];
  const priorities = ['LOW', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL'];
  for (const project of projects.slice(0, 2)) {
    const statuses = (await call('GET', `/task-statuses?projectId=${project.id}`)).json?.data;
    const sList = Array.isArray(statuses) ? statuses : statuses?.items ?? [];
    if (!sList.length) { log(`  • no statuses for ${project.name}, skipping`); continue; }
    for (let i = 0; i < 6; i++) {
      const title = pick(titles);
      const status = pick(sList);
      const assignee = users.length ? pick(users) : null;
      const dueOffsetDays = Math.floor(Math.random() * 21) - 7;
      const due = new Date(Date.now() + dueOffsetDays * 24 * 3600 * 1000);
      await safeCall(
        `[${project.code}] ${title}`,
        'POST', '/tasks',
        {
          projectId: project.id,
          statusId: status.id,
          title,
          description: `Auto-generated dummy task #${i + 1} for ${project.name}.`,
          priority: pick(priorities),
          dueDate: due.toISOString(),
          estimateHours: Math.round(Math.random() * 8 + 1),
          assigneeId: assignee?.id,
        },
      );
    }
  }
}

async function loginAs(email, password) {
  const r = await call('POST', '/auth/login', { tenantSlug: TENANT_SLUG, email, password });
  if (r.status !== 200) {
    log(`  • could not log in as ${email}: ${r.json?.message ?? r.status}`);
    return false;
  }
  token = r.json.data.accessToken;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    tenantId = payload.tenantId ?? '';
  } catch {}
  return true;
}

async function seedAsUser() {
  log('\n→ Switching to regular user (user@photonx.dev) for leave/WFH/expenses');
  const ok = await loginAs('user@photonx.dev', 'User@12345');
  if (!ok) return;

  log('\n→ Leave requests (as user)');
  const types = (await call('GET', '/leave-types')).json?.data;
  const tList = Array.isArray(types) ? types : types?.items ?? [];
  if (tList.length) {
    const t = tList[0];
    const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const end = new Date(Date.now() + 4 * 24 * 3600 * 1000);
    await safeCall(
      `Leave: ${t.name} for 2 days`,
      'POST', '/leave/requests',
      { leaveTypeId: t.id, startDate: start.toISOString(), endDate: end.toISOString(), reason: 'Family trip' },
    );
  }

  log('\n→ WFH requests (as user)');
  const date = new Date(Date.now() + 1 * 24 * 3600 * 1000);
  await safeCall(
    'WFH: tomorrow',
    'POST', '/wfh/requests',
    { requestDate: date.toISOString(), reason: 'Internet upgrade scheduled' },
  );

  log('\n→ Expenses (as user)');
  const projects = (await call('GET', '/projects?limit=5')).json?.data?.items ?? [];
  const cats = (await call('GET', '/expense-categories')).json?.data;
  const cList = Array.isArray(cats) ? cats : cats?.items ?? [];
  if (projects.length && cList.length) {
    const project = projects[0];
    const samples = [
      { amount: 450, category: 'TRAVEL', description: 'Cab to client site' },
      { amount: 2200, category: 'FOOD', description: 'Team lunch (5 ppl)' },
      { amount: 999, category: 'SOFTWARE', description: 'Figma seat top-up' },
    ];
    for (const s of samples) {
      const category = cList.find((c) => c.code === s.category) ?? cList[0];
      await safeCall(
        s.description,
        'POST', '/expenses',
        {
          projectId: project.id,
          categoryId: category.id,
          amount: s.amount,
          currency: 'INR',
          expenseDate: new Date().toISOString(),
          description: s.description,
        },
      );
    }
  }
}

(async () => {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`PhotonX WorkOS — dummy data seeder`);
  log(`API: ${BASE}  ·  tenant: ${TENANT_SLUG}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await login();
  await seedOffice();
  await seedLeaveTypes();
  await seedHolidays();
  await seedExpenseCategories();
  await seedTeams();
  await seedUsers();
  await seedTasks();
  await seedAsUser();
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('Done. Sign in to http://localhost:3001 to explore.');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
