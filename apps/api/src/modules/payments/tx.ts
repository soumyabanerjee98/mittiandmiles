import type {
  AccountMovement,
  ExceptionRecord,
  IdempotencyRecord,
  LedgerPost,
  PaymentAttempt,
  PaymentBooking,
  PayoutRecord,
  ReconciliationKind,
  RefundRecord,
  RefundStatus,
  WebhookRecord,
} from "./types.js";
import type { PaymentAttemptStatus } from "./types.js";

export type PaymentTx = {
  exclusive<T>(keys: readonly string[], run: () => Promise<T>): Promise<T>;
  findIdempotency(
    actorUserId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null>;
  insertIdempotency(row: IdempotencyRecord): Promise<void>;
  findBooking(id: string): Promise<PaymentBooking | null>;
  findHost(hostId: string): Promise<{
    id: string;
    userId: string;
    verificationStatus: PaymentBooking["hostVerificationStatus"];
  } | null>;
  listBookingsForHostUser(userId: string): Promise<PaymentBooking[]>;
  findAttempt(id: string): Promise<PaymentAttempt | null>;
  findAttemptByKey(idempotencyKey: string): Promise<PaymentAttempt | null>;
  findAttemptByOrder(
    provider: string,
    providerOrderRef: string,
  ): Promise<PaymentAttempt | null>;
  findOpenAttempt(bookingId: string): Promise<PaymentAttempt | null>;
  latestAttempt(bookingId: string): Promise<PaymentAttempt | null>;
  listAttempts(bookingId?: string): Promise<PaymentAttempt[]>;
  insertAttempt(row: PaymentAttempt): Promise<void>;
  attachOrder(attemptId: string, providerOrderRef: string): Promise<boolean>;
  markAttempt(
    attemptId: string,
    status: Extract<PaymentAttemptStatus, "SUCCEEDED" | "FAILED">,
    providerPaymentRef: string,
  ): Promise<boolean>;
  confirmBooking(bookingId: string): Promise<boolean>;
  insertBookingEvent(
    id: string,
    bookingId: string,
    eventType: string,
    createdAt: string,
  ): Promise<void>;
  insertOutbox(
    id: string,
    eventType: string,
    aggregateId: string,
    payload: { bookingId: string; status: string },
    createdAt: string,
  ): Promise<void>;
  findWebhook(
    provider: string,
    providerEventId: string,
  ): Promise<WebhookRecord | null>;
  insertWebhook(
    row: WebhookRecord & { payload: WebhookPayload },
  ): Promise<void>;
  finishWebhook(
    id: string,
    status: Extract<WebhookRecord["processingStatus"], "PROCESSED" | "FAILED">,
    processedAt: string,
  ): Promise<void>;
  refundedMinor(bookingId: string): Promise<number>;
  capturedMinor(bookingId: string): Promise<number>;
  refundDebits(
    bookingId: string,
  ): Promise<{ hostMinor: number; commissionMinor: number }>;
  hostPayable(bookingId: string): Promise<AccountMovement | null>;
  allocatedMinor(bookingId: string): Promise<number>;
  hasOpenRefund(bookingId: string): Promise<boolean>;
  insertRefund(row: RefundRecord): Promise<void>;
  findRefund(id: string): Promise<RefundRecord | null>;
  findRefundByKey(idempotencyKey: string): Promise<RefundRecord | null>;
  findRefundByProviderRef(
    provider: string,
    providerRefundRef: string,
  ): Promise<RefundRecord | null>;
  updateRefund(
    id: string,
    patch: {
      amountMinor?: number;
      status?: RefundStatus;
      providerRefundRef?: string | null;
    },
  ): Promise<void>;
  listRefunds(bookingId?: string): Promise<RefundRecord[]>;
  findPayoutByKey(idempotencyKey: string): Promise<PayoutRecord | null>;
  insertPayout(row: PayoutRecord): Promise<void>;
  listPayoutsForHostUser(userId: string): Promise<PayoutRecord[]>;
  listPayouts(): Promise<PayoutRecord[]>;
  hostEarnings(
    userId: string,
  ): Promise<
    { currency: string; payableMinor: number; allocatedMinor: number }[]
  >;
  postLedger(post: LedgerPost): Promise<"posted" | "exists">;
  ledgerTotals(): Promise<{ debitMinor: number; creditMinor: number }>;
  hasOpenException(
    kind: ReconciliationKind,
    resourceRef: string,
  ): Promise<boolean>;
  insertException(row: ExceptionRecord): Promise<void>;
  listExceptions(): Promise<ExceptionRecord[]>;
};

export type WebhookPayload = {
  type: string;
  amountMinor: number;
  currency: string;
  orderId?: string;
  paymentId?: string;
  refundId?: string;
};

export type PaymentDatabase = {
  transaction<T>(run: (tx: PaymentTx) => Promise<T>): Promise<T>;
};
