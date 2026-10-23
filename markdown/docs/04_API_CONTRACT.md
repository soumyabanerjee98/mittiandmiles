# 04 --- API Contract

## 1. Conventions

Base path: `/api/v1`.

-   JSON request/response bodies.
-   OpenAPI specification committed to the repository.
-   Schema validation at every boundary.
-   Consistent errors: `code`, `message`, `requestId`, optional field
    errors.
-   Cursor pagination for growing collections.
-   UTC ISO 8601 timestamps.
-   Currency is an ISO code; money is integer minor units.
-   Sensitive operations require authentication, authorization and
    idempotency.
-   API responses never expose provider secrets, private identity
    documents or hidden contact details.

## 2. Error envelope

``` json
{
  "error": {
    "code": "BOOKING_NOT_AVAILABLE",
    "message": "This time slot is no longer available.",
    "requestId": "request-id",
    "details": []
  }
}
```

Do not expose stack traces or internal provider payloads to clients.

## 3. Auth and account

Implemented (JWT):

-   `POST /auth/register` — email, password, optional locale; returns
    access and refresh tokens.
-   `POST /auth/login` — email and password; returns tokens.
-   `POST /auth/refresh` — body `{ "refreshToken" }`; rotates refresh
    token and returns a new pair.
-   `POST /auth/logout` — body `{ "refreshToken" }`; revokes the session
    (`204`).

Account (Bearer access JWT):

-   `GET /me`
-   `PATCH /me` — locale only; rejects role and status fields.
-   `GET /users/:userId` — self or staff `user.read` (staff reads are
    audited).

Not implemented yet on this contract:

-   `POST /hosts/onboarding`
-   `GET /hosts/me/verification`

### Authentication rules (implemented)

-   **Access token:** HS256 JWT. Claims include `sub` (user id) and
    `typ: "access"`. Do **not** put roles, admin flags, or permissions in
    the token.
-   **Refresh token:** opaque value; only a hash is stored server-side.
    Rotation on refresh; logout revokes the session.
-   **Passwords:** stored as scrypt hashes; never returned in API
    responses.
-   **Development:** when `AUTH_MODE=development`, the API also accepts
    `Bearer dev:<provider>:<subject>` for seeded users (not a production
    mechanism). With `JWT_SECRET` set, JWT and dev tokens can both work
    in development.
-   **Production:** use `AUTH_MODE=jwt` and a strong `JWT_SECRET` (see
    `apps/api/.env.example`).

Account recovery, OTP, and external identity providers are not implemented
yet. Admin roles are not self-assigned through register.

## 4. Discovery

-   `GET /cities`
-   `GET /experiences`
-   `GET /experiences/:id`
-   `GET /experiences/:id/availability`
-   `GET /hosts/:id`
-   `GET /categories`
-   `GET /languages`

Filters may include city, date, category, language, price range,
duration, party size and host verification. Return only published,
eligible listings.

## 5. Requests and offers

-   `POST /trip-requests`
-   `GET /trip-requests/:id`
-   `GET /trip-requests/:id/offers`
-   `POST /trip-requests/:id/offers`
-   `POST /offers/:id/accept`
-   `POST /offers/:id/withdraw`

Only eligible hosts may offer. An offer includes price, currency, time,
duration, inclusions, exclusions, cancellation policy and expiry.
Acceptance freezes terms but does not mark payment successful.

## 6. Bookings

-   `POST /bookings`
-   `GET /bookings/:id`
-   `GET /me/bookings`
-   `POST /bookings/:id/cancel`
-   `POST /bookings/:id/check-in`
-   `POST /bookings/:id/complete`
-   `POST /bookings/:id/no-show`
-   `POST /bookings/:id/disputes`

The server verifies actor permissions and allowed state transitions.
Completion and no-show endpoints must be idempotent and subject to
policy.

## 7. Payments and refunds

-   `POST /bookings/:id/payment-intent`
-   `GET /bookings/:id/payment-status`
-   `POST /bookings/:id/refund-requests`
-   `POST /webhooks/payments/:provider`

Webhook authentication uses the provider's documented signature
verification and raw-body requirements. Store provider event IDs and
process idempotently. Do not return internal payment details to
unauthorised users.

## 8. Host operations

-   `POST /hosts/me/experiences`
-   `PATCH /hosts/me/experiences/:id`
-   `POST /hosts/me/experiences/:id/submit`
-   `PUT /hosts/me/experiences/:id/availability`
-   `GET /hosts/me/bookings`
-   `GET /hosts/me/earnings`
-   `GET /hosts/me/payouts`
-   `POST /hosts/me/reports`

Enforce resource ownership. A host cannot edit another host's listings
or change verification, commission or payout state.

## 9. Messaging and reviews

-   `GET /conversations`
-   `POST /conversations`
-   `GET /conversations/:id/messages`
-   `POST /conversations/:id/messages`
-   `POST /bookings/:id/reviews`
-   `GET /experiences/:id/reviews`
-   `POST /reports`

Verify conversation membership on every read/write. Apply moderation,
rate limits and privacy/retention rules.

## 10. Admin APIs

Use a separate namespace such as `/admin/v1` or `/api/v1/admin`.

-   host verification queue and decisions;
-   listing moderation;
-   reports and support tickets;
-   booking and dispute review;
-   refund request and approval;
-   payout exception review;
-   reconciliation reports;
-   city activation;
-   commission policy version management;
-   role and permission management.

Finance operations require explicit permissions and audit records.
Consider maker-checker approval for high-risk or high-value actions.

## 11. Example booking request

``` json
{
  "experienceId": "uuid",
  "slotId": "uuid",
  "participantCount": 2,
  "currency": "INR"
}
```

This request does not set authoritative price, host, commission or
payment state. The backend loads those values from trusted records and
returns a server-calculated quote.

## 12. API security checklist

-   Object-level authorization on every private resource.
-   Rate limits and abuse protection.
-   Input validation and output shaping.
-   No mass assignment of privileged fields.
-   Idempotency for payment/refund/booking operations.
-   Consistent error handling.
-   Request correlation IDs.
-   Sensitive-field redaction.
-   OpenAPI contract tests for critical endpoints.
