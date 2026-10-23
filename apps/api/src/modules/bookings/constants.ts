/** How long a slot hold blocks inventory while payment is still phase 5. Not a refund rule. */
export const SLOT_HOLD_MS = 15 * 60 * 1000;

/** How long a new trip request stays open for host offers. */
export const TRIP_REQUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Longest expiry a host may set on an offer. */
export const MAX_OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_OFFER_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export const IDEMPOTENCY_SCOPE_REQUEST = "trip-request";
export const IDEMPOTENCY_SCOPE_BOOKING = "booking";
