/**
 * Booking lifecycle. There is no transition into CONFIRMED.
 * Payment confirmation belongs to phase 5 and must come from a verified
 * provider fact, not from a client call in this module.
 */
export const BookingStatus = {
  REQUESTED: "REQUESTED",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETION_PENDING: "COMPLETION_PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  DISPUTED: "DISPUTED",
  NO_SHOW: "NO_SHOW",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export type BookingAction =
  "cancel" | "expire" | "check_in" | "complete" | "no_show" | "dispute";

const NEXT: Record<
  BookingStatus,
  Partial<Record<BookingAction, BookingStatus>>
> = {
  REQUESTED: { cancel: "CANCELLED", expire: "EXPIRED" },
  AWAITING_PAYMENT: { cancel: "CANCELLED", expire: "EXPIRED" },
  CONFIRMED: {
    cancel: "CANCELLED",
    check_in: "IN_PROGRESS",
    no_show: "NO_SHOW",
    dispute: "DISPUTED",
  },
  IN_PROGRESS: {
    cancel: "CANCELLED",
    complete: "COMPLETED",
    no_show: "NO_SHOW",
    dispute: "DISPUTED",
  },
  COMPLETION_PENDING: { complete: "COMPLETED", dispute: "DISPUTED" },
  COMPLETED: { dispute: "DISPUTED" },
  CANCELLED: {},
  EXPIRED: {},
  DISPUTED: {},
  NO_SHOW: {},
};

const REPLAY: Partial<Record<BookingAction, BookingStatus>> = {
  cancel: "CANCELLED",
  check_in: "IN_PROGRESS",
  complete: "COMPLETED",
  no_show: "NO_SHOW",
  dispute: "DISPUTED",
};

export type TransitionDecision =
  | { type: "apply"; status: BookingStatus }
  | { type: "replay" }
  | { type: "reject" };

export function decideTransition(
  status: BookingStatus,
  action: BookingAction,
): TransitionDecision {
  if (REPLAY[action] === status) {
    return { type: "replay" };
  }
  const next = NEXT[status][action];
  if (next === undefined) {
    return { type: "reject" };
  }
  return { type: "apply", status: next };
}

export function outboxType(status: BookingStatus): string {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "booking.awaiting_payment";
    case "CANCELLED":
      return "booking.cancelled";
    case "EXPIRED":
      return "booking.expired";
    case "IN_PROGRESS":
      return "booking.checked_in";
    case "COMPLETED":
      return "booking.completed";
    case "NO_SHOW":
      return "booking.no_show";
    case "DISPUTED":
      return "booking.disputed";
    case "CONFIRMED":
      return "booking.confirmed";
    case "REQUESTED":
      return "booking.requested";
    case "COMPLETION_PENDING":
      return "booking.completion_pending";
  }
}

export function isBookingStatus(value: string): value is BookingStatus {
  return Object.prototype.hasOwnProperty.call(NEXT, value);
}
