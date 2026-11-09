import type { BookingStatus } from "../bookings/state.js";

export type HostVerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "NEEDS_INFORMATION";

export type PaymentAttemptStatus =
  "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type RefundStatus = "REQUESTED" | "PENDING" | "SUCCEEDED" | "FAILED";

export type PayoutStatus =
  | "PENDING_ELIGIBILITY"
  | "ELIGIBLE"
  | "SUBMITTED"
  | "SETTLED"
  | "FAILED"
  | "ON_HOLD";

export type WebhookProcessingStatus =
  "RECEIVED" | "VERIFIED" | "REJECTED" | "PROCESSED" | "FAILED";

export type ReconciliationKind =
  | "PROVIDER_PAYMENT_MISSING_INTERNAL"
  | "INTERNAL_PAYMENT_MISSING_PROVIDER"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_CAPTURE"
  | "DUPLICATE_REFUND"
  | "DUPLICATE_PAYOUT"
  | "PAYOUT_MISMATCH"
  | "UNRESOLVED_PENDING"
  | "LEDGER_IMBALANCE"
  | "CAPTURED_BOOKING_NOT_CONFIRMABLE";

export type LedgerAccountType =
  "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type PaymentBooking = {
  id: string;
  travellerId: string;
  hostId: string;
  hostUserId: string;
  hostVerificationStatus: HostVerificationStatus;
  status: BookingStatus;
  currency: string;
  totalMinor: number;
  commissionMinor: number;
  hostGrossMinor: number;
};

export type PaymentAttempt = {
  id: string;
  bookingId: string;
  provider: string;
  providerOrderRef: string | null;
  providerPaymentRef: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentAttemptStatus;
  idempotencyKey: string;
  createdAt: string;
};

export type RefundRecord = {
  id: string;
  bookingId: string;
  provider: string;
  providerRefundRef: string | null;
  amountMinor: number;
  currency: string;
  reasonCode: string;
  status: RefundStatus;
  idempotencyKey: string;
  requestedById: string;
  createdAt: string;
};

export type PayoutAllocationRecord = {
  bookingId: string;
  amountMinor: number;
};

export type PayoutRecord = {
  id: string;
  hostId: string;
  hostUserId: string;
  provider: string;
  providerPayoutRef: string | null;
  amountMinor: number;
  currency: string;
  status: PayoutStatus;
  idempotencyKey: string;
  allocations: PayoutAllocationRecord[];
  createdAt: string;
  settledAt: string | null;
};

export type IdempotencyRecord = {
  id: string;
  actorUserId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  resourceType: string;
  resourceId: string;
};

export type WebhookRecord = {
  id: string;
  provider: string;
  providerEventId: string;
  processingStatus: WebhookProcessingStatus;
};

export type ExceptionRecord = {
  id: string;
  provider: string;
  kind: ReconciliationKind;
  resourceRef: string;
  currency: string | null;
  expectedMinor: number | null;
  actualMinor: number | null;
  detail: string;
  createdAt: string;
};

export type LedgerLine = {
  code: string;
  accountType: LedgerAccountType;
  currency: string;
  debitMinor: number;
  creditMinor: number;
};

export type LedgerPost = {
  id: string;
  transactionType: "BOOKING_CHARGE" | "REFUND";
  bookingId: string;
  idempotencyKey: string;
  currency: string;
  createdAt: string;
  lines: LedgerLine[];
};

export type AccountMovement = {
  currency: string;
  debitMinor: number;
  creditMinor: number;
};
