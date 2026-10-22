# Project Context --- Indian Local Experiences Marketplace

## Product vision

Build a trustworthy marketplace connecting Indian and international
travellers with local hosts and professional guides for authentic local
experiences across multiple Indian cities.

Positioning: "Meet the people who know a city beyond its tourist map."

The product is inspired by the local-host discovery and booking category
represented by Local & Traveler, but must use original branding,
original UI, original content and its own implementation. Do not copy
another app's proprietary assets or exact interface.

## Business model

-   The platform earns a commission on eligible completed bookings.
-   Travellers pay through an approved online payment flow at booking.
-   Commission is calculated server-side and snapshotted on the booking.
-   Host settlement follows the approved payment-provider arrangement
    and applicable rules.
-   No assumption that the platform may hold funds or defer settlement
    without provider and legal approval.
-   Initial commission percentage is configurable by versioned policy;
    15% is an example for modelling, not a final business decision.
-   Do not add subscriptions, ads or paid placements to the MVP.

## Users

-   Travellers: Indian and international adults.
-   Local hosts: individuals offering eligible cultural, food,
    neighbourhood, photography and other approved experiences.
-   Professional guides: providers whose qualifications or licences are
    verified where required.
-   Operations/admin staff: host verification, listing moderation,
    disputes, refunds, support and reconciliation.
-   Finance staff: restricted access to financial operations.
-   Super admin: global configuration and access administration.

Do not describe all local hosts as licensed tourist guides. Verify
qualifications and permissions according to the relevant provider and
experience category.

## Launch approach

The product must support multiple Indian cities from the first release.
City activation is controlled by admin and operational readiness, not by
a hardcoded code release.

Initial candidate cities for validation: Kolkata, Jaipur, Delhi and
Kochi. These are hypotheses, not confirmed demand rankings. Final
activation requires host supply, bookable inventory, support coverage
and compliance review.

## Core traveller journey

1.  Select city and dates.
2.  Search experiences by category, language, price, duration, group
    size and host verification.
3.  View host profile, experience details, availability, inclusions,
    exclusions, safety notes and cancellation policy.
4.  Book an available fixed-price slot or submit a custom trip request.
5.  Chat in the app and receive structured host offers.
6.  Accept an offer with explicit price and terms.
7.  Pay using a supported payment provider.
8.  Receive confirmation only after verified server-side payment
    confirmation.
9.  View meeting details and booking status.
10. Check in, attend and complete the experience.
11. Resolve any dispute/refund before payout eligibility is finalised.
12. Leave a review only when eligible.

## Core host journey

1.  Register and complete host onboarding.
2.  Submit identity and any category-specific credentials through a
    secure flow.
3.  Wait for review; cannot publish restricted listings before approval.
4.  Create experiences, pricing, language support and availability.
5.  Receive requests and submit offers.
6.  Manage confirmed bookings and communicate through the app.
7.  Record attendance/completion under platform policy.
8.  View earnings, commission, payout status and reconciliation details.
9.  Report incidents and respond to disputes.

## Commission leakage principles

The platform cannot technically guarantee that people who meet will
never transact elsewhere. Reduce leakage by: - keeping direct contact
details and external payment details hidden before the allowed stage; -
screening messages and uploaded content proportionately; - making in-app
booking protections, verified reviews, receipts, support and repeat
booking useful; - providing host tools and fair transparent commission
economics; - allowing reports and appeals; - reviewing multiple signals
rather than punishing on a single weak signal; - applying proportionate
enforcement for substantiated repeated circumvention.

Do not build covert tracking, invasive device fingerprinting or
indiscriminate monitoring. Document purpose, access, retention and
appeals for moderation controls.

## Product scope --- MVP

Must have: - account and role management; - host onboarding and
verification status; - city and experience catalogue; - experience
search and detail pages; - availability and inventory reservation; -
custom requests and structured offers; - in-app messaging; - bookings
and lifecycle; - approved payment-provider integration; - server-side
commission calculation; - financial ledger and reconciliation; -
cancellation/refund and payout workflows; - check-in, completion and
booking-linked reviews; - admin moderation, reports, support and audit
logs; - notifications and operational monitoring.

Defer: - AI itineraries and AI matching; - dynamic pricing; -
subscriptions and advertising; - loyalty points; - multi-experience
bundles; - international host payouts; - high-risk adventure activities
until a separate safety/compliance review; - live tracking unless a
defined user need justifies it.

## Technical architecture

-   One Flutter mobile app with traveller, host and protected admin areas.
-   Node.js + Express + TypeScript API.
-   PostgreSQL + Prisma; use PostGIS where geospatial queries warrant
    it.
-   Redis for cache/rate limits/background jobs, never as the source of
    truth for financial state.
-   Queue/worker for notifications, reconciliation and retryable jobs.
-   Object storage for images and private verification documents.
-   Payment provider selected after written confirmation of marketplace
    eligibility and settlement capabilities.
-   OpenAPI contract for REST APIs.
-   Modular monolith, not microservices, for the initial release.


## Mobile-only application and admin decision

The MVP has **one mobile application and no separate website/admin frontend**. Build traveller, host and admin experiences as feature areas in the same Flutter app, sharing design tokens, API client, authentication/session handling, accessibility patterns and common components. Admin routes/screens must only be reachable by accounts whose server-issued permissions allow the relevant action. Never allow users to grant themselves an admin role or rely on client-side route hiding as the security boundary. Admin staff accounts and permissions are provisioned through a controlled backend process. The API remains the source of truth for every admin action.

Admin UI should be mobile-first and operationally efficient: compact but readable queues, searchable/filterable lists, clear detail screens, explicit confirmation for destructive/financial actions, and audit history. Where a workflow is genuinely difficult on a phone, design a usable mobile alternative rather than adding a web dashboard to the MVP.

## Money and time conventions

-   Money values are integer minor units (paise for INR) plus ISO
    currency code.
-   Never use floating point for monetary arithmetic.
-   Store timestamps as UTC; keep city/experience IANA time zone for
    display and scheduling.
-   Price, commission policy, cancellation policy and offer terms are
    snapshotted onto the booking.
-   Financial records are append-only; corrections use compensating
    entries.

## Success measures

Track: - request-to-offer rate; - offer-to-paid-booking conversion; -
completed booking rate; - host cancellation and no-show rates; -
refund/dispute rates; - repeat booking rate; - host retention; -
substantiated leakage incidents; - contribution margin per completed
booking; - traveller and host acquisition cost; - support cost per
booking.

## Decisions that require human confirmation

-   final app/brand name and domain;
-   initial commission percentage and cancellation rules;
-   payment-provider eligibility and settlement design;
-   legal entity, GST/TDS treatment and marketplace contractual role;
-   city activation criteria and host verification policy;
-   identity verification vendor and retention period;
-   final languages, currency display and international card support;
-   dispute windows and payout timing;
-   production hosting and data residency requirements.

Do not silently make these decisions in code. Use explicit configuration
and record decisions in project documentation.
