# 07 --- Implementation Plan for Cursor

## Workflow

-   One phase per branch or reviewable PR.
-   Ask Cursor to inspect first, then implement only the phase named.
-   Review every diff.
-   Run tests and commit before starting the next phase.
-   Do not build fake production flows to bypass an unresolved
    dependency.

## Phase 0 --- Decisions and project setup

Deliver: - repository structure; - root `AGENTS.md` and
`PROJECT_CONTEXT.md`; - this docs set; - ADR template and decision
log; - initial issue backlog.

Exit criteria: - architecture reviewed; - payment/provider questions
listed; - product decisions explicitly marked confirmed or unresolved.

## Phase 1 --- Developer foundation

Deliver: - API skeleton with startup environment validation and
`/health`; - Flutter mobile skeleton with traveller, host and protected admin feature-module scaffolding; -
formatting, lint, type checks and CI; - `.env.example` only, with a
Supabase Postgres connection string; - no local Docker database; - logging
and request IDs.

Exit criteria: - fresh clone setup documented; - CI passes; - no
business/payment features yet.

## Phase 2 --- Backend and database foundation

Deliver: - Prisma schema and initial migrations; - migration scripts and
seed scripts with development-only fake data; - validation/error
middleware; - JWT access and refresh tokens, register/login/refresh/logout,
and a development bearer-token seam; - RBAC; - audit logging; - test
database configuration.

Exit criteria: - migration works from an empty database; -
ownership/permission tests pass; - no real secrets or personal data in
fixtures.

## Phase 3 --- Cities, hosts and catalogue

Deliver: - cities and admin activation; - host onboarding and
verification state; - experience CRUD and moderation; - languages and
category data; - slots/availability; - search filters and pagination; -
private document storage interface.

Exit criteria: - adding a city requires data/admin configuration, not a
code deployment; - unapproved or unpublished experiences cannot be
booked; - host ownership tests pass.

## Phase 4 --- Requests, offers and booking state machine

Deliver: - traveller requests; - host offers and expiry; - price and
policy snapshots; - temporary slot reservation; - booking lifecycle and
events; - booking notification outbox.

Exit criteria: - concurrency test prevents overselling; - expired offers
cannot be accepted; - invalid state transitions fail; - duplicate
requests are idempotent where required.

## Phase 5 --- Payments and ledger

Prerequisite: payment-provider marketplace eligibility and settlement
approach confirmed or clearly isolated behind a provider abstraction in
sandbox only.

Deliver: - payment adapter; - order creation; - signed webhook
processing; - idempotent payment attempts; - double-entry ledger; -
refund workflow; - payout records and allocations; - reconciliation job
and exception queue.

Exit criteria: - forged client callback cannot confirm payment; -
duplicate webhook cannot duplicate ledger entries; - refund and payout
operations are idempotent; - provider/internal reconciliation tests
pass; - no assumption of unapproved fund holding.

## Phase 6 --- Mobile traveller journey

Deliver: - onboarding and profile; - city discovery; - search and
filters; - experience detail and availability; - custom requests and
offers; - booking and provider checkout; - booking details, cancellation
and support; - reviews and reports.

Exit criteria: - loading/error/empty/offline states exist; - no
hardcoded successful payment state; - API errors and expired sessions
are handled.

## Phase 7 --- Mobile host journey

Deliver: - onboarding and verification status; - profile and experience
management; - availability; - request and offer management; - booking
and meeting details; - check-in/completion; - earnings, payout status
and support.

Exit criteria: - host cannot alter protected financial or verification
fields; - all screens use API-backed state.

## Phase 8 --- Admin and trust/safety

Deliver: - host and listing review queues; - reports and support; -
booking/dispute view; - refund and payout exception actions; -
commission policy version management; - city activation; - audit and
reconciliation screens.

Exit criteria: - permissions enforced server-side; - sensitive actions
logged; - finance operations have appropriate approval controls.

## Phase 9 --- Leakage controls and operational hardening

Deliver: - contact-sharing signals; - reporting and human review; -
moderation appeals; - rate limits and abuse controls; - operational
metrics and alerts; - data retention/deletion workflow.

Exit criteria: - false-positive tests pass; - no invasive tracking; -
policies and retention are documented.

## Phase 10 --- Pilot and release

Deliver: - closed pilot in approved city clusters; - support runbooks; -
provider reconciliation; - backup/restore test; - incident response
plan; - app-store and privacy disclosures; - launch readiness report.

Exit criteria: - all critical checks in `08_TESTING_AND_RELEASE.md`
pass; - unresolved legal/provider issues are explicit and block real
payments where critical.


## Cross-phase admin constraint

Admin UI is a feature area within `apps/mobile` (Flutter), not a separate web app. During Phase 1, scaffold the admin module and role-aware route boundary without building production admin screens. During Phase 2, implement backend RBAC and audit foundations. During Phase 3 and later, add the relevant admin workflows to the same Flutter app as their API capabilities become available. Do not create `apps/admin`, a Next.js dashboard, or a web-only dependency.
