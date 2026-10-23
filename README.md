# Mitti and Miles

Multi-city marketplace for local experiences in India. This repository is at Phase 2: the API has a Prisma domain schema, validation, an authentication seam, role permissions, and audit logging. Bookings and payment capture are not implemented.

Product and engineering rules live in `markdown/`. Start with `markdown/AGENTS.md`, `markdown/PROJECT_CONTEXT.md`, and `markdown/docs/07_IMPLEMENTATION_PLAN.md`.

## Layout

```text
apps/api/                 Node.js, Express, TypeScript. Run this app on its own.
apps/mobile/              Flutter app (traveller, host, protected admin area)
packages/api-contracts/   OpenAPI (health and account seam)
markdown/                 Product and engineering documents
```

There is no root Node workspace. There is no separate admin website. Admin screens, when they exist, stay inside the Flutter app. The API remains the permission boundary.

PostgreSQL is hosted on Supabase. This repo does not run a local Docker database.

## Fresh clone

Requirements:

- Node.js 22 or newer
- Flutter 3.22.3 (the version this app was generated with)
- A Supabase project, for the Postgres connection string

API, from `apps/api`:

```bash
cd apps/api
npm ci
cp .env.example .env
```

Put the Supabase Postgres URIs in `DATABASE_URL` and `DIRECT_URL`, then apply the schema and optional development identities:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`db:seed` runs only when `NODE_ENV=development`. It inserts fake `@example.com` accounts and no documents or payment data. A local token looks like `Authorization: Bearer dev:development:dev-traveller`. `AUTH_MODE=unconfigured` rejects every token. That is the safe setting until an identity provider is chosen.

`GET /api/v1/me` returns the account stored for that subject. Roles in a header or body are ignored.

On Windows PowerShell:

```powershell
cd apps/api
Copy-Item .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`GET http://localhost:3000/health` returns `{ "status": "ok", "service": "mittiandmiles-api" }` and an `X-Request-Id` header. Startup checks environment variables and refuses to boot when they are invalid. The API connects to Supabase when a request needs an account or an audit row.

Flutter:

```bash
cd apps/mobile
cp .env.example .env
flutter pub get
flutter analyze
flutter test
flutter run
```

On Windows PowerShell, copy the env file with `Copy-Item .env.example .env`. Set `API_BASE_URL` in `.env` to your API origin (for example `http://localhost:3000` or a deployed `apps/api` URL). `.env` is gitignored; only `.env.example` is committed.

The app opens on the traveller placeholder. Host is a second tab. Admin is absent unless a server-issued capability is supplied in code. There is no control in the app that grants admin access. No screen calls the API yet.

## Checks

From `apps/api`:

```bash
npm run check
```

That runs typecheck, lint, format check, and tests. Flutter checks are separate, from `apps/mobile`:

```bash
flutter analyze
flutter test
```

GitHub Actions runs both on push and pull request. The API job installs dependencies, applies migrations to a disposable Postgres 16 service, and then runs the checks. That service is only for CI. Local development keeps using Supabase.

Constraint tests run when `TEST_DATABASE_URL` is set. They insert rows inside transactions that roll back. Local `npm run check` skips them when the variable is unset. Point it at a disposable database.

## Dependencies added for Phase 2

- `@prisma/client` — PostgreSQL access for accounts, permissions, and audit rows
- `prisma` (development) — schema, migrations, and the development seed

The API stays one Express process. Prisma does not add a local database.

## Dependencies added for Phase 1

API runtime:

- `express` — HTTP server
- `zod` — startup environment validation
- `pino` — structured logs

API development:

- `typescript`, `tsx`, `eslint`, `typescript-eslint`, `prettier`
- `supertest` and `@types/supertest` — HTTP tests
- `@types/express`, `@types/node`

Flutter uses the Flutter SDK, `flutter_test`, `flutter_lints`, and `flutter_dotenv` for `API_BASE_URL` in `.env`. No routing, HTTP client, or state-management package was added yet. The Supabase client library is not added; the API will use the Postgres connection string.

Phase 1 packages do not change the modular-monolith architecture. Ask before adding a package that would.
