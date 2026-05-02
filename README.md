# PhotonX WorkOS Backend Foundation

NestJS backend foundation for PhotonX WorkOS (WhatsApp-first HRMS + project OS).

## Stack

- NestJS + TypeScript
- MySQL + Prisma ORM
- Redis + BullMQ
- Swagger/OpenAPI
- JWT auth skeleton
- RBAC + tenant context skeleton
- Docker

## Project Structure

- `apps/api` - NestJS API application
- `apps/api/prisma/schema.prisma` - Prisma schema

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (optional, for containerized run)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
pnpm prisma:generate
```

4. Run migrations:

```bash
pnpm prisma:migrate -- --name init
```

## Run Locally

```bash
pnpm dev
```

API defaults:

- Health: `GET /health`
- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs-json`

## Build / Lint / Test

```bash
pnpm build
pnpm lint
pnpm test
```

## Prisma Utilities

```bash
pnpm prisma:generate
pnpm prisma:migrate -- --name <migration_name>
pnpm prisma:studio
```

## Run with Docker Compose

```bash
docker compose up --build
```

Services:

- API: `http://localhost:3000`
- MySQL: `localhost:3306`
- Redis: `localhost:6379`
