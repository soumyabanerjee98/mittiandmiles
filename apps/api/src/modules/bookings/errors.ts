import { HttpError } from "../../shared/http-error.js";
import { ResourceNotOwnedError } from "../catalogue/service.js";

export function notFound(): HttpError {
  return new HttpError(404, "NOT_FOUND", "Not found.");
}

export function hidden(resourceType: string, resourceId: string): HttpError {
  return new ResourceNotOwnedError(resourceType, resourceId);
}

export function invalid(field: string): HttpError {
  return new HttpError(400, "VALIDATION_ERROR", "Request validation failed.", [
    { field, message: "Invalid value." },
  ]);
}

export function invalidState(): HttpError {
  return new HttpError(
    409,
    "INVALID_STATE",
    "This booking cannot move to that state.",
  );
}

export function unavailable(): HttpError {
  return new HttpError(
    409,
    "BOOKING_NOT_AVAILABLE",
    "This time slot is no longer available.",
  );
}

export function offerExpired(): HttpError {
  return new HttpError(409, "OFFER_EXPIRED", "This offer has expired.");
}

export function requestExpired(): HttpError {
  return new HttpError(
    409,
    "REQUEST_EXPIRED",
    "This trip request has expired.",
  );
}

export function idempotencyConflict(): HttpError {
  return new HttpError(
    409,
    "IDEMPOTENCY_CONFLICT",
    "This idempotency key was already used with a different request.",
  );
}

export function duplicateOffer(): HttpError {
  return new HttpError(
    409,
    "DUPLICATE_OFFER",
    "This host already has a pending offer on the request.",
  );
}

export function selfBooking(): HttpError {
  return new HttpError(
    409,
    "CONFLICT",
    "A host cannot book their own experience.",
  );
}

export function forbidden(): HttpError {
  return new HttpError(
    403,
    "FORBIDDEN",
    "You do not have access to this resource.",
  );
}
