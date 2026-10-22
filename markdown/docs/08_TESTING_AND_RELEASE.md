# 08 --- Testing, Launch and Release Checklist

## 1. Automated tests

### Unit tests

-   commission calculation, rounding and policy versioning;
-   cancellation eligibility and refund calculation;
-   booking state transitions;
-   offer expiry;
-   payout eligibility;
-   permission decisions;
-   currency/minor-unit handling.

### Integration tests

-   database migrations;
-   host/listing ownership;
-   availability reservation and concurrent booking;
-   payment order creation;
-   webhook signature verification;
-   duplicate and out-of-order webhook processing;
-   refund idempotency;
-   ledger balancing;
-   payout allocation;
-   reconciliation;
-   review eligibility;
-   audit records for admin actions.

### API security tests

-   user A cannot read/update user B's booking;
-   host A cannot modify host B's listing;
-   traveller cannot access private host documents;
-   host cannot change commission, payment status or payout state;
-   ordinary admin cannot execute finance-only actions;
-   expired/invalid sessions are rejected;
-   rate limits apply to OTP, offers, messages and reports.

### Flutter traveller/host/admin tests

-   loading, empty, error and retry states;
-   expired session handling;
-   checkout return does not falsely confirm payment;
-   duplicate taps do not create duplicate bookings;
-   accessibility basics and responsive layouts;
-   admin screens are available only to authorised sessions in the UI, while API permission tests prove the server remains the enforcement boundary;
-   no client-side role or route manipulation can grant admin access;
-   admin workflows remain usable on narrow mobile screens and under slow/offline network conditions.

## 2. Payment sandbox scenarios

-   payment succeeds and webhook arrives once;
-   payment succeeds but client never returns;
-   client reports success but provider payment is not successful;
-   invalid webhook signature;
-   duplicate webhook;
-   delayed webhook;
-   events arrive out of order;
-   payment fails or remains pending;
-   amount or currency mismatch;
-   refund succeeds, fails or remains pending;
-   partial refund;
-   payout fails or is duplicated;
-   provider reports disagree with internal ledger.

All scenarios must have deterministic, repeatable tests.

## 3. Concurrency tests

-   two travellers attempt the last available slot;
-   repeated booking submission with the same idempotency key;
-   same offer accepted concurrently;
-   duplicate completion calls;
-   two refund requests race;
-   payout worker retries after a timeout;
-   expired reservation races with payment confirmation.

Expected result: no oversold inventory, duplicate financial entries or
invalid state transitions.

## 4. Manual operational tests

-   host verification and rejection;
-   listing takedown;
-   traveller cancellation;
-   host cancellation;
-   no-show and disputed completion;
-   refund review;
-   payout exception;
-   off-platform payment report and appeal;
-   account closure/data request;
-   customer support escalation;
-   backup restoration;
-   provider reconciliation discrepancy.

## 5. Pre-production checklist

### Product

-   [ ] Core traveller and host journeys work end to end.
-   [ ] Prices, inclusions, exclusions and cancellation rules are clear.
-   [ ] City activation is configurable.
-   [ ] Host verification and support coverage are ready.

### Engineering

-   [ ] CI formatting, lint, type checks and tests pass.
-   [ ] Migrations work from a clean database.
-   [ ] Secrets are not committed.
-   [ ] Logs redact sensitive data.
-   [ ] Monitoring and alerts are configured.
-   [ ] Backups and restore are tested.
-   [ ] Rate limits and access controls are enabled.

### Finance and provider

-   [ ] Provider has approved the marketplace model.
-   [ ] Settlement mechanics are confirmed in writing.
-   [ ] Webhook signatures and idempotency are tested.
-   [ ] Ledger balances and reconciliation work.
-   [ ] Refund and payout exceptions have owners.
-   [ ] Finance/CA has reviewed transaction and tax treatment.

### Legal and safety

-   [ ] Terms, privacy notice and cancellation policy reviewed.
-   [ ] Relevant e-commerce, data protection and tax obligations
    assessed.
-   [ ] Host/guide credential claims are accurate.
-   [ ] Experience category restrictions and safety procedures
    documented.
-   [ ] Grievance and incident escalation process staffed.
-   [ ] Applicable privacy, retention and breach procedures documented.

### Operations

-   [ ] Support team knows how to handle cancellations and disputes.
-   [ ] Host contact/escalation details are available to authorised
    staff.
-   [ ] Pilot cities have sufficient real availability.
-   [ ] Metrics dashboard is live.
-   [ ] Rollback and incident communication plans exist.

## 6. Pilot metrics

Track by city and experience category: - search-to-request conversion; -
request-to-offer rate; - offer-to-paid conversion; - completion rate; -
cancellation and no-show rate; - refund/dispute rate; - repeat booking
rate; - host retention; - substantiated leakage reports; - contribution
margin per completed booking; - acquisition cost and support cost.

Set numerical targets after baseline data is available. Do not declare
product-market fit from downloads or registrations alone.

## 7. Go/no-go rule

Do not launch real payments if any of the following remain unresolved: -
provider marketplace approval or settlement model; - critical
payment/ledger correctness failures; - ability to forge payment
confirmation; - duplicate payout/refund risk; - critical access-control
flaw; - required legal/tax review; - operational ability to handle
refunds, disputes and safety incidents.
