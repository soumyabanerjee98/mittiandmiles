# Cursor Build Guide --- Indian Local Experiences Marketplace

## How to use this repository

This folder contains the product and engineering instructions for
building a multi-city marketplace connecting travellers with local hosts
and professional guides in India.

**Do not ask Cursor to implement the entire product in one prompt.**
Keep the specification files in the repository and build in the phases
below. Ask Cursor to inspect existing files before editing and to report
what it changed and which tests it ran.

## Recommended repository layout

``` text
mittiandmiles/
├── AGENTS.md
├── PROJECT_CONTEXT.md
├── README_BUILD_ORDER.md
├── docs/
│   ├── 01_PRODUCT_REQUIREMENTS.md
│   ├── 02_SYSTEM_ARCHITECTURE.md
│   ├── 03_DATABASE_AND_DOMAIN_MODEL.md
│   ├── 04_API_CONTRACT.md
│   ├── 05_PAYMENTS_AND_COMMISSION.md
│   ├── 06_SECURITY_PRIVACY_COMPLIANCE.md
│   ├── 07_IMPLEMENTATION_PLAN.md
│   └── 08_TESTING_AND_RELEASE.md
├── apps/
│   ├── api/
│   └── mobile/  # Flutter traveller, host and protected admin areas
└── packages/
    └── api-contracts/
```

Flutter and TypeScript do not share source code directly. Keep API
contracts documented in OpenAPI and generate or manually maintain typed
client models for Flutter. Do not create a shared TypeScript package
that the Flutter app cannot consume.

## Mobile-only architecture decision

The MVP contains no public website and no separate admin website. The Flutter app has traveller, host and protected admin feature areas. The backend remains a single Node.js/Express/TypeScript API and enforces all roles and action-level permissions. Keep the repo to `apps/api` and `apps/mobile` plus documentation/contracts unless a future explicit decision changes this.

## First setup in Cursor

1.  Create an empty Git repository named `mittiandmiles`.
2.  Open the repository root in Cursor.
3.  Copy all supplied Markdown files into the root and `docs/` paths
    shown above.
4.  Read `PROJECT_CONTEXT.md` and `AGENTS.md` to ensure the business
    rules match your intent.
5.  Open Cursor Agent mode and run **Prompt 0** below.
6.  Review the proposed plan before accepting changes.
7.  Commit the working baseline to Git before moving to the next phase.

## Prompts to run in order

### Prompt 0 --- Inspect and plan, no implementation yet

> Read `AGENTS.md`, `PROJECT_CONTEXT.md`, and all documents under
> `docs/`. Do not write application code yet. Summarise the
> architecture, identify unresolved decisions and external dependencies,
> and propose a milestone plan that follows
> `docs/07_IMPLEMENTATION_PLAN.md`. Highlight anything that needs
> payment-provider, legal, tax, or security confirmation. Do not invent
> provider capabilities or legal conclusions.

### Prompt 1 --- Repository foundation

> Implement only Phase 1 from `docs/07_IMPLEMENTATION_PLAN.md`. Create
> the monorepo structure, TypeScript API skeleton, Flutter admin module
> skeleton, Flutter app skeleton, local development configuration,
> formatting/linting, environment examples, health checks, and CI checks
> as specified. Do not implement bookings or payments. Run all available
> checks and report exact commands and results. Ask before adding a
> dependency that changes the architecture.

### Prompt 2 --- Backend domain foundation

> Implement only Phase 2. Follow `AGENTS.md`, the database/domain model
> and API contract. Add Prisma schema and migrations for the approved
> scope, validation, structured errors, authentication integration
> seams, RBAC and audit logging. Do not store secrets or real identity
> documents in the repository. Add migration and authorization tests. Do
> not implement payment capture yet.

### Prompt 3 --- Discovery and host onboarding

> Implement only Phase 3. Build cities, host profiles, verification
> workflow, experience listings, languages, availability, traveller
> discovery and admin review. Enforce host ownership and server-side
> validation. Use seed data clearly marked as development-only. Add
> tests before moving on.

### Prompt 4 --- Requests, offers and booking state machine

> Implement only Phase 4. Build trip requests, host offers, offer
> expiry, price/terms snapshots, slot reservations and booking state
> transitions. Use PostgreSQL transactions and concurrency-safe
> inventory reservation. Add tests for duplicate requests, last-slot
> race conditions, expired offers and invalid state transitions. Do not
> simulate payment success.

### Prompt 5 --- Payments and ledger

> Before coding, list the payment-provider capabilities that must be
> confirmed for our marketplace model. Implement only the provider
> abstraction, sandbox integration, webhook verification, idempotent
> event handling, immutable double-entry ledger, refunds, payout records
> and reconciliation defined in `docs/05_PAYMENTS_AND_COMMISSION.md`.
> Never mark a booking paid based only on a client response. Do not
> assume we may hold funds or delay settlements without provider/legal
> approval.

### Prompt 6 --- Mobile app journeys

> Implement only the traveller and host mobile journeys for the
> completed backend endpoints. Follow `PROJECT_CONTEXT.md` and the API
> contract. Use typed models, loading/error/empty states, accessible
> forms and secure token handling. Do not add fake payment confirmation
> or hardcoded production data. Include tests for critical UI state and
> API error handling.

### Prompt 7 --- Admin operations and trust/safety (inside Flutter)

> Implement admin workflows as a protected feature area inside the existing Flutter mobile app. Do not create a Next.js app, web dashboard or separate admin frontend. Reuse the mobile app theme, API client, authentication and navigation patterns. The backend is the security boundary. Implement the admin workflows for host verification, experience
> moderation, support tickets, reports, disputes, refunds and
> reconciliation. Enforce server-side permissions per action; do not
> rely on hiding UI buttons. Every sensitive admin action must create an
> audit record. Add tests for least privilege and cross-tenant access.

### Prompt 8 --- Leakage controls and abuse review

> Implement pre-booking contact-sharing signals, reporting and a review
> queue according to the policy document. Use explainable rules,
> minimise message retention and avoid automatic punitive action from a
> single weak signal. Provide user notices and an appeal workflow. Add
> false-positive tests. Do not build invasive device fingerprinting or
> covert location tracking.

### Prompt 9 --- Release readiness

> Execute the full checklist in `docs/08_TESTING_AND_RELEASE.md`. Run
> migrations against a disposable test database, all automated tests,
> lint/type checks, dependency/security checks and payment sandbox
> reconciliation. Produce a release-readiness report listing passed
> checks, failures, unresolved provider approvals, compliance reviews
> and operational risks. Do not claim production readiness if a critical
> item is unresolved.

## Cursor operating rules

-   Use a separate Git branch for each milestone.
-   Ask Cursor to inspect existing code before making changes.
-   Keep changes small enough to review.
-   Require tests for booking, money, permissions and state transitions.
-   Review diffs before accepting changes.
-   Do not paste production secrets, customer data, identity documents
    or payment credentials into Cursor.
-   Never let an AI coding agent invent legal conclusions or silently
    choose a payment settlement model.
-   Use real provider sandbox integrations; do not substitute mocked
    payment success in production paths.
-   If Cursor proposes a major architectural change, ask it to explain
    the trade-offs before proceeding.

## Definition of done for every milestone

1.  Requirements implemented without breaking earlier milestones.
2.  Automated tests added and passing.
3.  Formatting, lint and type checks passing.
4.  Database migrations are reproducible.
5.  Authorization and error cases are tested.
6.  Documentation updated.
7.  Diff reviewed and committed.
8.  Remaining risks and manual steps clearly reported.
