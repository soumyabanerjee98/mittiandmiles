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

export function invalidState(message: string): HttpError {
  return new HttpError(409, "INVALID_STATE", message);
}

export function idempotencyConflict(): HttpError {
  return new HttpError(
    409,
    "IDEMPOTENCY_CONFLICT",
    "This idempotency key was already used with a different request.",
  );
}

export function paymentInProgress(): HttpError {
  return new HttpError(
    409,
    "PAYMENT_IN_PROGRESS",
    "This booking already has an open payment attempt.",
  );
}

export function providerUnavailable(): HttpError {
  return new HttpError(
    503,
    "PAYMENT_PROVIDER_UNCONFIGURED",
    "Payment provider is not configured.",
  );
}

export function invalidSignature(): HttpError {
  return new HttpError(
    401,
    "INVALID_SIGNATURE",
    "Webhook signature was rejected.",
  );
}

export function refundExceedsCaptured(): HttpError {
  return new HttpError(
    409,
    "REFUND_EXCEEDS_CAPTURED",
    "The refund is larger than the captured amount still available.",
  );
}

export function payoutExceedsPayable(): HttpError {
  return new HttpError(
    409,
    "PAYOUT_EXCEEDS_PAYABLE",
    "The payout record is larger than the host amount still available.",
  );
}

export function refundHold(): HttpError {
  return new HttpError(
    409,
    "REFUND_HOLD",
    "A payout record cannot be created while a refund is unresolved.",
  );
}

export function disputeHold(): HttpError {
  return new HttpError(
    409,
    "DISPUTE_HOLD",
    "A payout record cannot be created while a dispute is open.",
  );
}

export function hostPayoutAccountMissing(): HttpError {
  return new HttpError(
    409,
    "HOST_PAYOUT_ACCOUNT_MISSING",
    "This host does not have a Razorpay fund account reference.",
  );
}

export function payoutProviderUnavailable(): HttpError {
  return new HttpError(
    503,
    "PAYOUT_PROVIDER_UNCONFIGURED",
    "RazorpayX account number is not configured.",
  );
}

export function hostNotEligible(): HttpError {
  return new HttpError(
    409,
    "HOST_NOT_ELIGIBLE",
    "This host is not eligible for a payout record.",
  );
}
