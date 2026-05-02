# PhotonX WorkOS Backend

NestJS backend for PhotonX WorkOS (WhatsApp-first HRMS + project OS), currently with:

- Phase 1: identity + tenant foundation
- Phase 2: projects/tasks/workflow foundation
- Phase 3: time tracking + project costing
- Phase 4: HRMS modules (attendance, leave/WFH, holidays, expenses, approvals)
- Phase 5: integrations + notification system (WhatsApp, GitHub, Slack, email)

## Stack

- NestJS + TypeScript
- MySQL + Prisma ORM
- Redis + BullMQ
- Swagger/OpenAPI
- JWT auth + tenant-scoped RBAC
- Docker

## Project Structure

- `apps/api` - NestJS API application
- `apps/api/prisma/schema.prisma` - Prisma schema
- `apps/api/prisma/seed.ts` - seed script

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop (optional)

## Setup

1. Install dependencies:

```bash
corepack pnpm install
```

2. Create environment file:

```bash
cp .env.example .env
```

S3 attachment endpoints require valid AWS values in `.env`:
`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`.

Integration and notification encryption/test features require:
`APP_ENCRYPTION_KEY`, `WHATSAPP_TEST_SECRET`.

3. Start infra (MySQL + Redis):

```bash
docker compose up -d mysql redis
```

4. (Optional but recommended) create shadow DB for Prisma migrate if your MySQL user cannot create databases:

```sql
CREATE DATABASE photonx_workos_shadow;
```

5. Generate Prisma client:

```bash
corepack pnpm prisma:generate
```

6. Apply migrations:

```bash
corepack pnpm --filter @photonx/api exec dotenv -e ../../.env -- prisma migrate deploy --schema prisma/schema.prisma
```

7. Seed demo data:

```bash
corepack pnpm prisma:seed
```

## Run Locally

```bash
corepack pnpm dev
```

## API Docs

- Health: `GET /health`
- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs-json`
- Root webhooks (excluded from `/api` prefix):
  - `GET /webhooks/whatsapp`
  - `POST /webhooks/whatsapp`
  - `POST /webhooks/github`

## Endpoint Groups

- Auth: `/api/auth/*`
- Tenants: `/api/tenants/*`
- Users: `/api/users/*`
- Teams: `/api/teams/*`
- Roles and permissions: `/api/roles`, `/api/permissions`, `/api/users/:id/roles`
- Office policy: `/api/office-locations`, `/api/office-ips`, `/api/office-policy/check`
- Notification preferences: `/api/notification-preferences/me`
- Projects: `/api/projects/*`
- Milestones: `/api/milestones/*` and `/api/projects/:projectId/milestones`
- Task statuses: `/api/task-statuses/*`
- Task workflows: `/api/task-workflows/*`
- Tasks: `/api/tasks/*` (kanban, bulk, status, dependencies, comments)
- Attachments: `/api/attachments/*` (task + expense entity support)
- Time entries: `/api/time-entries/*`
- Attendance: `/api/attendance/*`
- Leave: `/api/leave*` and `/api/leave-types`, `/api/leave-policies`
- WFH: `/api/wfh/*`
- Holidays: `/api/holidays/*`
- Expenses: `/api/expense-categories`, `/api/expense-policies`, `/api/expenses/*`
- Approvals: `/api/approvals/*`
- Notifications: `/api/notifications/*`
- WhatsApp operations: `/api/whatsapp/*`
- GitHub integrations: `/api/integrations/github/*`
- Slack integration: `/api/integrations/slack/settings`
- Email integration: `/api/integrations/email/settings`
- Webhooks (no `/api` prefix): `/webhooks/whatsapp`, `/webhooks/github`

## WhatsApp Command Test

Public test endpoint:

```bash
curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -H "x-whatsapp-test-secret: $WHATSAPP_TEST_SECRET" \
  -d '{
    "tenantSlug": "photonx-default",
    "userPhone": "+919900000002",
    "command": "tasks"
  }'
```

## Seed Credentials

After running seed:

- SUPER_ADMIN: `superadmin@photonx.dev` / `Admin@12345`
- TEAM_LEAD: `teamlead@photonx.dev` / `TeamLead@12345`
- USER: `user@photonx.dev` / `User@12345`
- Tenant slug: `photonx-default`

## Build / Lint / Test

```bash
corepack pnpm build
corepack pnpm lint
corepack pnpm test
```
