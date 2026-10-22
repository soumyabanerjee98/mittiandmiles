# 05 --- Payments, Commission, Ledger and Leakage Controls

## 1. Business rule

The platform charges a commission on eligible completed bookings. The
traveller pays at booking through an approved provider. The host
receives settlement according to the approved provider arrangement,
applicable law and the platform's published policy.

The platform must not assume it can hold funds or delay settlement until
completion. Obtain written provider confirmation and legal review before
finalising settlement timing.

## 2. Commission policy

Create versioned commission policies with: - policy version; - effective
start/end; - commission basis; - rate or fixed amount; - applicable
categories/cities; - tax treatment configuration as reviewed by
finance; - refund/cancellation treatment; - activation status.

Snapshot the policy and calculated amounts onto the booking. Later
policy changes must not silently change existing bookings.

Example only: booking subtotal ₹2,000, commission rate 15%, platform
commission ₹300 and host gross entitlement ₹1,700 before processing
costs, tax treatment and adjustments. Do not hardcode this example as
the production policy.

## 3. Payment flow

1.  Traveller chooses an available slot or accepts an offer.
2.  API verifies host/listing eligibility and reserves inventory
    transactionally.
3.  API calculates price, commission, applicable taxes/fees and
    cancellation policy.
4.  API creates booking in `AWAITING_PAYMENT` and a payment attempt.
5.  API creates a provider order using server-side credentials and an
    idempotency key.
6.  Client completes the provider checkout.
7.  Client return/callback is informational only.
8.  Backend verifies the provider webhook signature and event.
9.  Backend checks provider-side payment facts and expected
    amount/currency/order.
10. Backend processes the event idempotently and updates payment/booking
    state in a database transaction.
11. Confirmation notification is sent through the outbox.
12. Reconciliation checks internal state against provider records.

If payment fails or times out, do not assume it failed solely because
the client says so. Query/reconcile provider state as supported, then
release inventory according to a safe timeout policy.

## 4. Webhook processing

-   Verify signature according to the provider's official integration
    guide.
-   Use the raw request body if required by the provider.
-   Persist provider + event ID with a unique constraint.
-   Reject invalid signatures.
-   Acknowledge according to provider requirements after durable
    receipt/processing design is in place.
-   Handle duplicate, delayed and out-of-order events.
-   Never trust amount, currency or booking ID without matching them to
    the stored payment attempt and provider reference.
-   Store minimal payload needed for audit; redact sensitive values.
-   Use retry-safe workers for slow follow-up operations.

## 5. Ledger

Use an append-only double-entry ledger or an equivalently rigorous
accounting journal reviewed by an accountant.

Conceptual accounts may include: - payment-provider clearing; - host
payable; - platform commission revenue; - refund/chargeback clearing; -
payment-processing expense; - tax payable/receivable accounts as advised
by finance.

Every posted transaction must balance per currency. A refund, reversal
or correction creates new entries; it must not rewrite posted history.
Do not use a single mutable host balance as the financial source of
truth.

Use integer minor units. Add unique idempotency keys and immutable
references to booking/provider transactions.

## 6. Refunds

-   Calculate eligibility from the booking's policy snapshot and
    documented exceptions.
-   Record a refund request and reason.
-   Apply required permissions and review.
-   Create provider refund with idempotency protection.
-   Update refund state from verified provider facts.
-   Record compensating ledger entries.
-   Handle partial refunds and multiple refunds without exceeding
    eligible captured value.
-   Reconcile refunds with provider reports.
-   Notify both parties of status.
-   Do not automatically release a payout while a policy-defined dispute
    or refund hold remains unresolved.

## 7. Payouts

-   Complete required host onboarding/KYC before payout.
-   Determine host payable from ledger and policy, not client data.
-   Check eligible booking status, refund/dispute holds and provider
    rules.
-   Prevent duplicate payout submission.
-   Record provider payout references and state transitions.
-   Reconcile submitted, failed and settled payouts.
-   Define manual exception and approval controls.
-   Do not imply payout timing until the provider contract confirms it.

## 8. Reconciliation

Run scheduled reconciliation against provider reports/APIs. Detect: -
provider payment missing internally; - internal payment missing at
provider; - amount/currency mismatch; - duplicate
capture/refund/payout; - payout mismatch; - unresolved pending
payment; - ledger imbalance.

Create an operations queue and alert on material mismatches. Never
silently auto-correct financial discrepancies.

## 9. Commission leakage prevention

Before confirmed booking: - restrict direct phone/email/social handles
and external payment links where practical; - explain why contact
sharing may be restricted; - allow safe exceptions and appeals; -
support reporting of off-platform payment requests.

After booking: - provide in-app itinerary, receipts, support,
cancellation handling, verified reviews and repeat booking; - use
transparent host economics and quality-based benefits; - monitor
substantiated reports and suspicious patterns; - investigate with human
review before serious enforcement.

Do not use one low conversion rate as proof of circumvention. Avoid
covert location tracking, invasive fingerprinting or indiscriminate
conversation surveillance. Define moderation purpose, access, retention
and appeal procedures.

## 10. Provider approval gate

Before production, obtain provider and professional confirmation of: -
marketplace eligibility; - host onboarding/KYC; - collection, split and
settlement mechanics; - whether delayed/conditional settlement is
supported; - refund, chargeback and reserve handling; - international
card acceptance; - tax reports and reconciliation exports; - contractual
responsibilities and applicable regulatory requirements.
