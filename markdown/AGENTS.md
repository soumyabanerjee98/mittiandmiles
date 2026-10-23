# AGENTS.md --- Repository Rules for Cursor

## Operating principles

-   Treat `PROJECT_CONTEXT.md` and the documents under `docs/` as the
    source of truth.
-   Implement one milestone at a time. Do not build features outside the
    active milestone.
-   Before editing, inspect the repository and identify the files that
    will change.
-   If a requirement conflicts with an existing implementation, explain
    the conflict and propose the smallest safe change.
-   Do not invent product, provider, legal, tax, or security
    requirements.
-   Ask for a decision when a blocking business or compliance choice is
    unresolved.
-   Prefer simple, maintainable code over premature microservices or
    abstractions.

## Architecture

-   API: Node.js, Express, TypeScript, and Prisma. PostgreSQL is hosted on Supabase. Do not add a local Docker database.
-   Admin: a protected admin area inside the Flutter mobile app; no separate admin website.
-   Mobile: Flutter.
-   Use REST APIs under `/api/v1`; document them in OpenAPI.
-   Keep a modular monolith until actual scale requires a service split.
-   PostgreSQL is authoritative for bookings, availability reservations,
    payment records and ledger data.
-   Redis may support cache, rate limits and jobs, but must not be the
    source of truth for money or booking status.
-   Store all timestamps as UTC instants and retain IANA time zones for
    city/experience schedules.
-   Store money as integer minor units and always include ISO currency
    codes.

## Non-negotiable correctness rules

-   Never trust client-supplied prices, commission amounts, role claims,
    payment status or payout status.
-   Never mark a payment successful from a mobile/web client callback
    alone.
-   Verify payment webhooks using the provider's documented signature
    verification.
-   Process webhooks and financial commands idempotently.
-   Use database transactions and concurrency-safe inventory
    reservation.
-   Do not allow duplicate payouts, duplicate refunds or duplicate
    completion.
-   Never edit or delete posted financial ledger entries to correct
    them; create compensating entries.
-   Do not assume the platform can hold customer funds or delay
    settlement unless the provider arrangement and legal review
    expressly permit it.
-   Enforce ownership and permissions server-side on every protected
    resource.
-   Do not expose private host contact details before the permitted
    booking stage.
-   Do not automatically suspend a host based only on one weak leakage
    signal.
-   Record sensitive administrative actions in an audit log.

## Security and privacy

-   Never commit secrets, access tokens, private keys, production
    credentials or real user data.
-   Provide `.env.example` with placeholders only.
-   Validate all external input at the API boundary.
-   Use least-privilege access and deny by default.
-   Keep identity documents in private object storage; expose only
    authorised, short-lived access.
-   Minimise personal-data collection and define retention/deletion
    workflows.
-   Avoid logging OTPs, access tokens, payment credentials, full
    identity documents or unnecessary message contents.
-   Apply rate limits to authentication, messaging, offers, reports and
    payment endpoints.
-   Use safe error messages that do not leak internals.
-   Use parameterised database access and safe rendering for
    user-generated content.

## Code quality

-   Use strict TypeScript settings.
-   Prefer small modules with clear boundaries.
-   Validate environment variables at startup.
-   Use structured logs with request/correlation IDs.
-   Add tests for business rules, permissions, concurrency and failure
    paths.
-   Avoid `any` unless there is a documented reason.
-   Do not suppress type or lint errors just to make checks pass.
-   Do not add a dependency without explaining its purpose and
    maintenance impact.
-   Never report a test as passing unless it was actually run.

## Required response after each task

Report: 1. What changed. 2. Files created or modified. 3. Commands run
and exact results. 4. Tests not run and why. 5. Remaining risks or
decisions. 6. The next smallest recommended task.

## Prohibited shortcuts

-   No fake payment success in a production code path.
-   No client-side commission calculation as the authoritative value.
-   No mutable "balance" field as the only financial record.
-   No arbitrary admin override without permission checks and audit
    trail.
-   No hardcoded city list that requires code changes to add a city.
-   No claiming a host is government-certified unless that credential
    has been verified and the claim is accurate.


## Mobile admin rules

- Implement admin screens as a feature area in the existing Flutter app. Reuse app routing, theme, networking, session handling and shared components.
- Never expose an admin entry point to an unauthorised account; nevertheless, always enforce permissions server-side for every request and object.
- Do not allow role escalation, role switching to admin, or privilege claims supplied by the client.
- Keep admin permissions granular (for example operations, support, finance and super-admin); default deny.
- Record actor, action, target, timestamp, outcome and required reason in audit logs for sensitive actions.
- For finance/moderation actions show the target, consequence and current state, require confirmation where appropriate, then render the server-confirmed result.
- Design for mobile touch, small screens, accessibility, slow networks, loading/empty/error/retry states and safe handling of sensitive data.
