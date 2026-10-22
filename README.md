# Mitti and Miles

Multi-city marketplace for local experiences in India. This repository is at Phase 1: a TypeScript API skeleton and a Flutter app skeleton. Bookings and payments are not implemented.

Product and engineering rules live in `markdown/`. Start with `markdown/AGENTS.md`, `markdown/PROJECT_CONTEXT.md`, and `markdown/docs/07_IMPLEMENTATION_PLAN.md`.

## Layout

```text
apps/api/                 Node.js, Express, TypeScript. Run this app on its own.
apps/mobile/              Flutter app (traveller, host, protected admin area)
packages/api-contracts/   OpenAPI (GET /health only)
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

Put the Supabase Postgres URI in `DATABASE_URL`, then:

```bash
npm run dev
```

On Windows PowerShell:

```powershell
cd apps/api
Copy-Item .env.example .env
npm run dev
```

`GET http://localhost:3000/health` returns `{ "status": "ok", "service": "mittiandmiles-api" }` and an `X-Request-Id` header. Startup checks environment variables and refuses to boot when they are invalid. The process does not connect to Supabase yet. Database migrations begin in Phase 2.

Flutter:

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter run
```

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

GitHub Actions runs both on push and pull request. The API job installs and checks inside `apps/api`.

## Dependencies added for Phase 1

API runtime:

- `express` — HTTP server
- `zod` — startup environment validation
- `pino` — structured logs

API development:

- `typescript`, `tsx`, `eslint`, `typescript-eslint`, `prettier`
- `supertest` and `@types/supertest` — HTTP tests
- `@types/express`, `@types/node`

Flutter uses the Flutter SDK, `flutter_test`, and `flutter_lints`. No routing, HTTP, or state-management package was added. The Supabase client library is not added; the API will use the Postgres connection string.

These do not change the modular-monolith architecture. Ask before adding a package that would.
