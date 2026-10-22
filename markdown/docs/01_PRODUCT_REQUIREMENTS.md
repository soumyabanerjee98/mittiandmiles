# 01 --- Product Requirements and Acceptance Criteria

## 1. Product goals

1.  Help travellers discover trustworthy, relevant local experiences.
2.  Let hosts earn through a transparent, dependable booking process.
3.  Monetise completed bookings through a configurable commission.
4.  Support multiple Indian cities and international travellers.
5.  Keep bookings, payments, refunds, reviews and host payouts
    auditable.
6.  Reduce off-platform leakage without invasive monitoring or
    unreasonable friction.

## 2. Personas

### Traveller

Needs relevant experiences, accurate prices, trustworthy hosts, clear
inclusions, easy payment, responsive support and fair cancellation
terms.

### Local host

Needs an easy onboarding process, control over availability, predictable
fees, quality leads, simple booking management and clear payout records.

### Professional guide

Needs the above plus accurate credential display and workflows
appropriate to their guide category.

### Operations agent

Needs queues for host approval, reports, cancellations, disputes and
support, with least-privilege permissions and audit history.

### Finance operator

Needs provider reconciliation, refund/payout status, exception handling
and exportable reports, without unrestricted access to private
conversations or identity documents.

## Admin delivery constraint

All admin workflows in the MVP must be implemented inside the Flutter mobile app; do not build a separate admin website or Next.js dashboard. The app must present admin navigation only to appropriately authorised accounts, but server-side authorization remains mandatory for every admin action. Admin capabilities are assigned through a controlled staff provisioning process and cannot be self-selected.

Admin mobile workflows must support searchable/filterable/paginated queues, case detail screens, confirmation for sensitive changes, clear pending/success/failure outcomes, and audit history. Admin UI must handle small screens and poor network conditions.

## 3. Functional requirements

### Accounts

-   Users can register, authenticate, recover access and close an
    account through a defined workflow.
-   Users can be travellers, hosts or both where policy permits.
-   Privileged actions require server-side authorization.
-   Account status supports active, restricted, suspended and closed
    states.

### Host onboarding

-   Hosts submit required identity and category-specific information.
-   Documents are private and accessible only to authorised reviewers.
-   Verification status includes pending, approved, rejected and
    needs-more-information.
-   A host cannot publish or accept bookings if the required
    verification is incomplete.
-   Verification claims shown publicly must match evidence reviewed.

### Experience catalogue

-   Host creates and edits own listings.
-   Listing contains title, description, city, category, duration,
    languages, price, currency, capacity, inclusions, exclusions,
    meeting area, accessibility notes, safety notes, cancellation policy
    and images.
-   Listings move through draft, pending-review, published, rejected,
    paused and archived.
-   Admin can moderate listings with audit records.
-   Do not expose exact private meeting addresses publicly unless
    intended and safe.

### Search

-   Filter by city, dates, category, language, price, duration, group
    size and verification status.
-   Search returns only published, eligible listings with relevant
    availability.
-   Search results are paginated and validated.
-   Adding a city must be possible through data/admin configuration, not
    a code change.

### Availability

-   Hosts configure slots, capacity and blackout periods.
-   Booking cannot exceed capacity.
-   Concurrent attempts for the final available seat must not oversell
    inventory.
-   Temporary holds expire safely.
-   Availability is evaluated in the experience/city time zone and
    stored as UTC instants.

### Requests and offers

-   Traveller submits a request with city, date/time range, party size,
    budget, interests and accessibility/language needs where relevant.
-   Eligible hosts can respond with a structured offer.
-   Offer has price, currency, duration, inclusions, exclusions,
    proposed time, expiry and cancellation terms.
-   Traveller must explicitly accept the offer.
-   Acceptance does not imply payment success.
-   Expired or withdrawn offers cannot be checked out.

### Booking and checkout

-   A booking snapshots price, commission policy, cancellation terms and
    experience details.
-   Checkout creates a payment attempt with the approved provider.
-   Booking becomes paid/confirmed only after verified server-side
    payment confirmation.
-   Duplicate API requests and webhooks do not duplicate bookings or
    charges.
-   Booking transitions are validated on the server.

### Fulfilment

-   Traveller and host see confirmed itinerary and meeting details.
-   Check-in and completion use defined evidence and policy.
-   Completion is idempotent and does not itself bypass dispute or
    payout checks.
-   No-show, cancellation and dispute workflows are explicit.

### Reviews

-   Only eligible participants in qualifying completed bookings can
    review.
-   One review per eligible reviewer/booking/target unless a documented
    policy allows otherwise.
-   Reviews can be reported and moderated.
-   Hosts cannot review themselves or create reviews for unbooked
    experiences.

### Admin

-   Separate permissions for host verification, content moderation,
    support, finance and super-admin actions.
-   Every sensitive change is audited.
-   Refunds and payouts require explicit reason and appropriate
    permissions.
-   No hidden or unlogged financial overrides.

## 4. Non-functional requirements

-   Strong consistency for booking inventory and financial ledger.
-   Secure by default, with least-privilege permissions.
-   Accessible and responsive UI with loading, empty, offline and error
    states.
-   Localised date/time and currency presentation.
-   Structured logs with request IDs and redaction of sensitive fields.
-   Backups and tested restore procedure.
-   CI checks for formatting, lint, type safety and tests.
-   API versioning and documented error codes.

## 5. MVP exclusions

Do not implement AI itinerary generation, automated dynamic pricing,
host subscriptions, advertising, loyalty points, international host
payouts or high-risk adventure categories in the initial release unless
separately approved.

## 6. Acceptance criteria for MVP

The MVP is functionally acceptable only when: 1. An approved host can
publish a listing and configure availability. 2. A traveller can find
the listing and complete a booking through the approved provider. 3. A
forged client success callback cannot confirm payment. 4. Duplicate
webhooks and retries cannot duplicate financial entries. 5. Two
travellers cannot reserve the same last slot. 6. Cancellation and refund
rules are applied from the booking snapshot. 7. An eligible completed
booking produces the correct commission and host payable. 8. Payout
eligibility is blocked by unresolved conditions defined by policy. 9.
Reviews are tied to qualifying bookings. 10. Admin permissions and audit
logs are tested. 11. A city can be activated without a code change. 12.
All release checklist critical items pass.
