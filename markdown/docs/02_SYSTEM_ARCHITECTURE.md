# 02 --- System Architecture

## 1. Architecture decision

Use a modular monolith for the initial release. Separate domain modules
in code, but deploy the API as one application until operational
evidence justifies splitting services.

## 2. Components

### Mobile app

Flutter app with role-aware navigation for travellers and hosts. Use
typed API clients, secure token storage, clear error handling and no
authoritative business logic for money or permissions.

### Admin area inside the Flutter app

Admin is a protected feature area within the same Flutter mobile application used by travellers and hosts. It is not a separate Next.js app or website. Reuse the app's authentication/session lifecycle, API client, design tokens, accessibility conventions and common components, while keeping admin features in clearly separated modules. After login, the app may expose an admin entry point only when the server-provided session/profile indicates authorised admin capabilities. This is a navigation convenience only: every admin API endpoint must independently enforce permissions. Do not support self-service admin registration or client-side privilege escalation.

Admin workflows include host verification, experience moderation, city/category configuration, user reports and support, booking/dispute review, and restricted finance/reconciliation tools. Use mobile-friendly queues, search/filter, paginated lists and detail screens; avoid desktop-only tables. Financial and destructive actions require explicit confirmation, idempotent API commands where applicable, visible pending states, and audit records.

### API

Node.js, Express and TypeScript. Responsibilities: - authentication
integration and session validation; - authorization and input
validation; - domain services; - transactions and state transitions; -
provider integrations; - audit logs; - OpenAPI documentation.

### Database

PostgreSQL hosted on Supabase, accessed with Prisma. Use the project
connection string in the environment. Do not run a local Docker
database. Use migrations committed to source control. Use raw SQL
migrations for database constraints Prisma cannot express adequately.

### Geospatial

Use PostGIS for proximity and geographic filtering if required. Do not
expose precise host or traveller locations without a specific, consented
purpose.

### Background processing

Use a queue/worker for notifications, webhook retries where appropriate,
reconciliation, expired holds, offer expiry and scheduled operational
jobs. Queue messages are not the authoritative state.

### Object storage

Public experience images can use controlled public/CDN access. Identity
and credential documents must use private storage and short-lived
authorised access.

### External integrations

Payment provider, SMS/OTP, email, push notifications, maps/geocoding,
identity verification if selected, logging and error monitoring.

## 3. Suggested repository layout

```text
apps/
  api/
    src/
      config/
      middleware/
      modules/
        auth/
        users/
        hosts/
        cities/
        experiences/
        availability/
        requests/
        offers/
        bookings/
        payments/
        ledger/
        payouts/
        messaging/
        reviews/
        reports/
        admin/
      jobs/
      providers/
      shared/
      app.ts
      server.ts
    prisma/
      schema.prisma
      migrations/
    tests/
  mobile/  # Flutter: traveller, host and protected admin areas
    lib/
      app/
      core/
      features/
        auth/
        discovery/
        experience/
        requests/
        bookings/
        messaging/
        host/
        profile/
        admin/
          overview/
          host_verification/
          experience_moderation/
          reports_support/
          bookings_disputes/
          finance/
          audit/
    test/
docs/
packages/
  api-contracts/
```

## 4. Request path

1.  Client calls a versioned API.
2.  API validates session and request.
3.  Authorization verifies role and resource ownership.
4.  Domain service executes business logic.
5.  Database transaction enforces consistency.
6.  Outbox event is committed with the state change when asynchronous
    work is needed.
7.  Worker delivers notification or other retryable side effect.
8.  Structured logs include a correlation ID but exclude secrets and
    unnecessary personal data.

## 5. Data ownership

-   PostgreSQL is authoritative for booking, offer, inventory,
    payment-attempt, refund, ledger and payout records.
-   Payment provider is authoritative for provider-side
    payment/settlement facts; internal records must be reconciled
    against it.
-   Redis is not authoritative for booking state or balances.
-   The mobile client is never authoritative for prices, commission,
    roles or payment success.
-   Admin UI is not a trusted boundary; the API enforces permissions for every admin operation. The admin feature lives inside Flutter, but app-level route guards are only UX controls.

## 6. Transactional outbox

For important state changes, write the domain update and outbox record
in the same database transaction. A worker processes the outbox with
retries and idempotency. Examples: booking confirmed, booking cancelled,
refund requested, payout eligible, review published.

## 7. Configuration

-   Validate environment variables at process startup.
-   Keep provider secrets in a secret manager or deployment environment.
-   Maintain separate development, test, staging and production
    configurations.
-   Use explicit feature flags or city activation records.
-   Version commission and cancellation policies; never mutate
    historical booking snapshots.

## 8. Observability

Track: - request rate, latency and error rate; - database latency and
connection pool health; - payment webhook delivery and processing
failures; - provider/internal reconciliation differences; - booking
transition failures; - inventory conflicts; - refund and payout age; -
queue depth and retry counts; - host cancellations and reports.

Alert on financial mismatches, repeated webhook failures and payout
exceptions.

## 9. Architecture decisions to document

Before production, write ADRs for: - authentication provider; - payment
provider and settlement flow; - host identity verification; - messaging
and moderation approach; - object storage and retention; - deployment
and backups; - whether PostGIS is required for initial search.
