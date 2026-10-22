# 03 --- Database and Domain Model

## 1. Conventions

-   UUID primary keys.
-   `created_at` and `updated_at` timestamps as appropriate.
-   Store instants in UTC; retain IANA timezone for experience/city
    scheduling.
-   Store money as integer minor units plus ISO currency code.
-   Use explicit enums for state fields.
-   Add foreign keys, unique constraints and indexes for domain
    invariants.
-   Use soft deletion only where appropriate; financial and audit
    records should be append-only.
-   Do not store full card data or unnecessary identity-document
    contents in PostgreSQL.

## 2. Core entities

### Identity

`users`: id, email, phone, auth subject/provider, account status,
locale, timestamps.

`traveller_profiles`: user id, display name, country code, language
preferences, interests.

`host_profiles`: id, user id, public name, bio, verification status,
onboarding status, payout provider reference, public profile status.

`host_documents`: id, host id, document type, private storage reference,
verification state, reviewer id, review timestamps, retention/deletion
metadata.

`user_roles`: user id, role, scope where required. Do not trust role
claims supplied by clients.

### Geography and catalogue

`cities`: id, slug, name, state, country code, timezone, centre geometry
if useful, activation status.

`experiences`: id, host id, city id, category, title, description,
duration, base price minor units, currency, capacity, listing status,
inclusions, exclusions, meeting area, accessibility and safety notes.

`experience_languages`: experience id, language code.

`experience_images`: experience id, private/public storage reference,
sort order, moderation status.

`experience_slots`: id, experience id, start/end UTC, capacity, status.

`slot_reservations`: id, slot id, booking id, quantity, expiry, state.
Use transaction-safe capacity enforcement.

### Requests and offers

`trip_requests`: id, traveller id, city id, requested date range, party
size, budget minor units, currency, preferences, status, expiry.

`offers`: id, request id, host id, proposed start/end, price minor
units, currency, inclusions/exclusions, policy version/snapshot, expiry,
status.

### Booking

`bookings`: id, traveller id, host id, experience id nullable for custom
offer, offer id nullable, status, starts/ends, participant count,
currency, subtotal, discount, tax fields if applicable, total,
commission policy version, commission amount, host gross entitlement,
cancellation policy snapshot, experience/offer snapshot, timestamps.

`booking_participants`: booking id, participant reference or minimal
participant data, attendance state. Avoid collecting unnecessary
personal details for other participants.

`booking_events`: booking id, event type, actor, minimal metadata,
timestamp. Append-only for normal application roles.

`check_ins`: booking id, actor id, method, verified timestamp, policy
result.

### Payments and accounting

`payment_attempts`: booking id, provider, provider order/payment
reference, amount, currency, status, idempotency key, timestamps.

`webhook_events`: provider, provider event id, signature verification
result, processing status, received/processed timestamps, safe payload
reference or minimised payload. Unique constraint on provider + event
id.

`refunds`: booking id, provider refund reference, amount, reason code,
status, timestamps.

`ledger_accounts`: account code, account type, currency, status.

`ledger_transactions`: transaction type, booking id, idempotency key,
currency, created timestamp. Unique idempotency key in appropriate
scope.

`ledger_entries`: transaction id, account id, debit minor units, credit
minor units. Ensure each posted transaction balances per currency;
enforce in transaction/service and, where appropriate, database
controls.

`payouts`: host id, provider payout reference, amount, currency, status,
created/settled timestamps.

`payout_allocations`: payout id, booking id, allocated amount. Prevent
over-allocation of host payable.

`commission_policies`: version, effective dates, rate/basis, eligibility
and configuration. Never overwrite policy history.

### Messaging, trust and operations

`conversations`: request id and/or booking id, participant references,
status.

`messages`: conversation id, sender id, content, attachment references,
moderation status, timestamp. Apply retention and access policies.

`reviews`: booking id, reviewer id, reviewee id, rating, content,
status, created timestamp.

`reports`: reporter, reported user, booking, category, evidence
reference, status, outcome, timestamps.

`support_tickets`: requester, booking, category, status, assigned agent,
timestamps.

`audit_logs`: actor, action, resource type/id, request ID, timestamp,
safe metadata.

`outbox_events`: event id, type, aggregate id, payload minimised to
required data, processing state, retry count, timestamps.

## 3. Important constraints

-   Unique provider webhook event ID per provider.
-   Unique provider transaction references where provided.
-   Unique idempotency key for each financial command in its intended
    scope.
-   One eligible review per reviewer/booking/target.
-   Booking participant count cannot exceed reserved capacity.
-   A host cannot accept their own booking.
-   Only published and eligible experiences can be booked.
-   Expired offers cannot be accepted.
-   Slot capacity must not be oversold under concurrent requests.
-   Commission must be calculated from server-side policy.
-   Refund total must not exceed eligible captured amount, considering
    provider semantics and previous refunds.
-   Payout allocation must not exceed eligible host payable.
-   Posted ledger transactions are immutable and balanced.

## 4. Booking state machine

Define explicit transitions in a domain service. Example states:
`REQUESTED`, `AWAITING_PAYMENT`, `CONFIRMED`, `IN_PROGRESS`,
`COMPLETION_PENDING`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `DISPUTED`,
`NO_SHOW`.

Keep payment/refund state separate: payment attempts may be `CREATED`,
`PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`; refunds may be
`REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`; payouts may be
`PENDING_ELIGIBILITY`, `ELIGIBLE`, `SUBMITTED`, `SETTLED`, `FAILED`,
`ON_HOLD`.

Never assume all provider events arrive in order. Validate current state
and provider facts before applying transitions.

## 5. Migration and test approach

-   Commit all Prisma migrations.
-   Test migrations against a fresh disposable database.
-   Add integration tests for foreign keys, unique constraints,
    concurrent slot reservation and idempotency.
-   Use fixtures/factories with fake identities and provider references.
-   Never use production customer data in tests.
-   If Prisma cannot express a needed constraint, add a reviewed SQL
    migration and document it.
