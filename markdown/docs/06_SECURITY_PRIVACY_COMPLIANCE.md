# 06 --- Security, Privacy and Indian Compliance Workstream

This document is an engineering checklist, not legal or tax advice.
Engage qualified Indian counsel, a CA and the selected payment provider
to determine actual obligations and confirm which provisions apply at
launch.

## 1. Security baseline

Use OWASP API Security Top 10 as a baseline.

### Authentication

-   **Current API (MVP):** local email/password with server-issued HS256
    JWT access tokens and opaque refresh tokens (hash stored in
    PostgreSQL; rotation on refresh). Access tokens must not embed roles
    or permissions; the server loads grants from the database every
    request. Configure `JWT_SECRET` only via environment/secrets manager
    (never commit). Development may use non-JWT `Bearer dev:...` tokens
    for seeded users when `AUTH_MODE=development`.
-   Future: external identity provider, OTP/SMS, or passkeys — use a
    maintained provider or a carefully reviewed implementation.
-   Protect OTP delivery and verification from brute force and cost
    abuse when added.
-   Use secure token storage on clients, rotation/revocation on the
    server, logout, and (when built) account recovery.
-   Require stronger controls for privileged finance/admin actions.

### Authorization

-   Deny by default.
-   Check object ownership on every protected request.
-   Enforce role and action permissions on the server.
-   Separate operations, finance, verification and super-admin
    permissions.
-   Test that users cannot access other users' bookings, conversations,
    documents or payouts by changing IDs.

### Admin in the mobile app

The admin interface is embedded in Flutter, but the mobile app is an untrusted client. A hidden route, local role flag or decoded client-side claim must never grant authority. The backend must validate the authenticated account and action-level permission on every request, check resource scope/ownership, and deny by default. Do not allow users to edit their own roles or assign staff privileges through public endpoints. Apply step-up authentication or re-authentication to sensitive finance/security actions if supported by the chosen identity solution.

Admin list/detail screens must minimise sensitive data, mask by default, and fetch private identity documents only through short-lived authorised access. Log sensitive admin reads and all consequential changes according to the approved policy.

### Input and output

-   Validate all inputs at API boundaries.
-   Use parameterised queries.
-   Prevent mass assignment of status, role, commission, price and
    payout fields.
-   Sanitize/render user-generated content safely.
-   Limit upload types and sizes; scan files where appropriate.
-   Use safe errors without stack traces or provider secrets.

### Payments

-   Verify webhook signatures.
-   Use idempotency and unique provider references.
-   Never trust client payment callbacks.
-   Reconcile internal and provider records.
-   Do not store raw card details.
-   Protect payment credentials in a secret manager.

### Operations

-   TLS in transit and appropriate encryption at rest.
-   Separate development/staging/production credentials.
-   Dependency and secret scanning in CI.
-   Structured logs with request IDs and sensitive-field redaction.
-   Encrypted backups and tested restores.
-   Incident response and applicable breach notification process.
-   Audit all sensitive admin actions.

## 2. Privacy engineering

-   Map personal-data collection to a clear product purpose.
-   Provide understandable privacy notices and appropriate
    consent/lawful-ground workflows.
-   Minimise personal data and define retention periods.
-   Restrict access to identity documents and private messages.
-   Store private files in non-public object storage with short-lived
    authorised links.
-   Avoid placing identity documents or full message bodies in general
    logs.
-   Provide processes for applicable access, correction, erasure,
    grievance and account-closure requests.
-   Review processor contracts and data transfers.
-   Document breach response and applicable notification obligations.
-   Restrict the initial service to adults unless a separately reviewed
    minors policy is implemented.

## 3. Indian compliance review

Counsel/CA should assess, as applicable: - company/entity and
contractual structure; - Consumer Protection (E-Commerce) Rules and
marketplace disclosures; - GST registration and commission tax
treatment; - e-commerce operator obligations and GST TCS; - income-tax
TDS, including Section 194-O where applicable; - invoicing and host tax
information; - payment aggregation and payment-provider regulatory
responsibilities; - RBI directions applicable to the selected payment
arrangement; - DPDP Act, 2023 and DPDP Rules, 2025, including phased
commencement; - tourism-guide credentials and local permissions for each
experience category; - insurance/liability and safety rules for selected
activities; - foreign-customer payment, currency and cross-border
considerations.

Do not treat the list as a conclusion that every requirement applies.
Determine applicability against the actual business model and current
law.

## 4. Host verification and safety

-   Define evidence required by host/experience category.
-   Do not call a host licensed/certified unless the credential was
    verified and the wording is accurate.
-   Provide a way to flag expired or disputed credentials.
-   Keep identity documents private and access audited.
-   Establish complaint, emergency escalation and incident response
    procedures.
-   Require additional review before listing higher-risk experiences.
-   Avoid promising insurance, guaranteed refunds or background checks
    unless actually provided.

## 5. Leakage moderation

-   Explain pre-booking contact-sharing rules to users.
-   Use proportionate detection and human review.
-   Minimise stored moderation evidence.
-   Set retention periods and access controls.
-   Provide appeals and corrections for false positives.
-   Do not infer wrongdoing solely from low conversion or a single
    ambiguous message.
-   Do not use covert tracking or invasive fingerprinting.

## 6. Release gate

Do not launch real payments until: - payment-provider approval and
settlement model are documented; - legal and tax reviews have been
completed for the actual transaction flow; - privacy notice and terms
have been reviewed; - host verification and support processes are
operational; - refund, dispute, payout and incident runbooks are tested.
