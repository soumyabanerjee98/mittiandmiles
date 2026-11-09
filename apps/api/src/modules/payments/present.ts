import { SETTLEMENT_MODEL } from "./capabilities.js";
import type {
  PaymentAttempt,
  PaymentBooking,
  PayoutRecord,
  RefundRecord,
} from "./types.js";

export function presentIntent(attempt: PaymentAttempt, keyId: string) {
  return {
    attemptId: attempt.id,
    bookingId: attempt.bookingId,
    status: attempt.status,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
    provider: attempt.provider,
    settlement: SETTLEMENT_MODEL,
    checkout: {
      providerOrderRef: attempt.providerOrderRef,
      keyId,
    },
  };
}

export function presentStatus(
  booking: PaymentBooking,
  attempt: PaymentAttempt | null,
) {
  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    settlement: SETTLEMENT_MODEL,
    payment:
      attempt === null
        ? null
        : {
            attemptId: attempt.id,
            status: attempt.status,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            provider: attempt.provider,
          },
  };
}

export function presentRefund(refund: RefundRecord) {
  return {
    id: refund.id,
    bookingId: refund.bookingId,
    amountMinor: refund.amountMinor,
    currency: refund.currency,
    reasonCode: refund.reasonCode,
    status: refund.status,
    providerRefundRef: refund.providerRefundRef,
  };
}

export function presentPayout(payout: PayoutRecord) {
  return {
    id: payout.id,
    hostId: payout.hostId,
    amountMinor: payout.amountMinor,
    currency: payout.currency,
    status: payout.status,
    settlement: SETTLEMENT_MODEL,
    providerPayoutRef: payout.providerPayoutRef,
    allocations: payout.allocations.map((row) => ({
      bookingId: row.bookingId,
      amountMinor: row.amountMinor,
    })),
    createdAt: payout.createdAt,
  };
}
