import { randomUUID } from "node:crypto";
import { requestHash } from "../bookings/hash.js";
import type { Permission } from "../auth/permissions.js";
import { Permission as Permissions } from "../auth/permissions.js";
import { SETTLEMENT_MODEL } from "./capabilities.js";
import {
  disputeHold,
  hidden,
  hostNotEligible,
  idempotencyConflict,
  invalidState,
  notFound,
  paymentInProgress,
  payoutExceedsPayable,
  providerUnavailable,
  refundExceedsCaptured,
  refundHold,
  invalidSignature,
  invalid,
} from "./errors.js";
import { captureLines, refundLines, refundSplit } from "./ledger.js";
import type { PaymentProvider, ProviderEvent } from "./provider.js";
import { exceptionView, findDiscrepancies } from "./reconcile.js";
import type { PaymentDatabase, PaymentTx, WebhookPayload } from "./tx.js";
import type {
  PaymentAttempt,
  PaymentBooking,
  PayoutAllocationRecord,
  PayoutRecord,
  ReconciliationKind,
  RefundRecord,
} from "./types.js";

const SCOPE_INTENT = "payment-intent";
const SCOPE_REFUND = "refund-request";
const SCOPE_PAYOUT = "payout-record";

export type PaymentActor = {
  userId: string;
  permissions: ReadonlySet<Permission>;
};

export type RefundRequestInput = {
  amountMinor?: number;
  reasonCode: string;
};

export type PayoutInput = {
  hostId: string;
  currency: string;
  allocations: PayoutAllocationRecord[];
};

export class PaymentService {
  constructor(
    private readonly database: PaymentDatabase,
    private readonly provider: PaymentProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createIntent(
    actor: PaymentActor,
    bookingId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; attempt: PaymentAttempt; keyId: string }> {
    return this.database.transaction((tx) =>
      tx.exclusive([`booking:${bookingId}`], async () => {
        const booking = await this.ownedBooking(tx, actor, bookingId, true);
        if (booking.totalMinor <= 0) {
          throw invalidState("This booking does not have an amount to pay.");
        }
        const hash = requestHash({
          bookingId,
          amountMinor: booking.totalMinor,
          currency: booking.currency,
        });
        const prior = await tx.findIdempotency(
          actor.userId,
          SCOPE_INTENT,
          idempotencyKey,
        );
        if (prior !== null) {
          if (prior.requestHash !== hash) {
            throw idempotencyConflict();
          }
          const attempt = await tx.findAttempt(prior.resourceId);
          if (attempt === null || this.provider.publicKeyId === null) {
            throw notFound();
          }
          return {
            replayed: true,
            attempt,
            keyId: this.provider.publicKeyId,
          };
        }
        if (booking.status !== "AWAITING_PAYMENT") {
          throw invalidState("This booking is not awaiting payment.");
        }
        if (!this.provider.configured || this.provider.publicKeyId === null) {
          throw providerUnavailable();
        }
        const open = await tx.findOpenAttempt(bookingId);
        if (open !== null) {
          throw paymentInProgress();
        }
        const createdAt = this.now().toISOString();
        const attempt: PaymentAttempt = {
          id: randomUUID(),
          bookingId,
          provider: this.provider.name,
          providerOrderRef: null,
          providerPaymentRef: null,
          amountMinor: booking.totalMinor,
          currency: booking.currency,
          status: "CREATED",
          idempotencyKey,
          createdAt,
        };
        await tx.insertAttempt(attempt);
        const order = await this.provider.createOrder({
          amountMinor: booking.totalMinor,
          currency: booking.currency,
          receipt: bookingId,
          idempotencyKey,
        });
        const attached = await tx.attachOrder(
          attempt.id,
          order.providerOrderRef,
        );
        if (!attached) {
          throw invalidState("This booking is not awaiting payment.");
        }
        await tx.insertIdempotency({
          id: randomUUID(),
          actorUserId: actor.userId,
          scope: SCOPE_INTENT,
          idempotencyKey,
          requestHash: hash,
          resourceType: "payment_attempt",
          resourceId: attempt.id,
        });
        const stored = await tx.findAttempt(attempt.id);
        if (stored === null) {
          throw notFound();
        }
        return {
          replayed: false,
          attempt: stored,
          keyId: this.provider.publicKeyId,
        };
      }),
    );
  }

  async readStatus(
    actor: PaymentActor,
    bookingId: string,
  ): Promise<{ booking: PaymentBooking; attempt: PaymentAttempt | null }> {
    const preview = await this.database.transaction((tx) =>
      tx.findBooking(bookingId),
    );
    if (
      preview === null ||
      (preview.travellerId !== actor.userId &&
        preview.hostUserId !== actor.userId)
    ) {
      throw hidden("booking", bookingId);
    }
    const attempt = await this.database.transaction((tx) =>
      tx.latestAttempt(bookingId),
    );
    if (
      attempt?.providerOrderRef !== null &&
      attempt?.providerOrderRef !== undefined &&
      (attempt.status === "CREATED" || attempt.status === "PENDING") &&
      this.provider.configured
    ) {
      const fact = await this.provider.fetchPayment(attempt.providerOrderRef);
      if (fact !== null) {
        await this.database.transaction((tx) =>
          tx.exclusive(
            [`booking:${bookingId}`, `order:${attempt.providerOrderRef}`],
            () => this.applyPaymentFact(tx, fact, null),
          ),
        );
      }
    }
    const booking = await this.database.transaction((tx) =>
      tx.findBooking(bookingId),
    );
    const latest = await this.database.transaction((tx) =>
      tx.latestAttempt(bookingId),
    );
    if (booking === null) {
      throw hidden("booking", bookingId);
    }
    return { booking, attempt: latest };
  }

  get signatureHeader(): string {
    return this.provider.signatureHeader;
  }

  get eventIdHeader(): string | null {
    return this.provider.eventIdHeader;
  }

  receiveWebhook(
    providerName: string,
    raw: Buffer,
    signature: string | undefined,
    eventId: string | undefined,
  ): Promise<void> {
    if (!this.provider.configured) {
      throw providerUnavailable();
    }
    if (providerName !== this.provider.name) {
      throw notFound();
    }
    if (!this.provider.verifyWebhook(raw, signature)) {
      throw invalidSignature();
    }
    const event = this.provider.parseWebhook(raw, eventId);
    if (event === null) {
      if (this.provider.ignoreWebhook(raw, eventId)) {
        return Promise.resolve();
      }
      throw invalid("body");
    }
    return this.lockWebhook(event);
  }

  createRefundRequest(
    actor: PaymentActor,
    bookingId: string,
    idempotencyKey: string,
    input: RefundRequestInput,
  ): Promise<{ replayed: boolean; refund: RefundRecord }> {
    const finance = actor.permissions.has(Permissions.REFUND_REVIEW);
    return this.database.transaction((tx) =>
      tx.exclusive([`booking:${bookingId}`], async () => {
        const booking = await tx.findBooking(bookingId);
        if (booking === null) {
          throw hidden("booking", bookingId);
        }
        if (booking.travellerId !== actor.userId && !finance) {
          throw hidden("booking", bookingId);
        }
        const captured = await tx.capturedMinor(bookingId);
        const refunded = await tx.refundedMinor(bookingId);
        const remaining = captured - refunded;
        if (captured <= 0 || remaining <= 0) {
          throw refundExceedsCaptured();
        }
        const amountMinor = input.amountMinor ?? remaining;
        if (amountMinor > remaining) {
          throw refundExceedsCaptured();
        }
        const hash = requestHash({
          bookingId,
          amountMinor,
          reasonCode: input.reasonCode,
        });
        const prior = await tx.findIdempotency(
          actor.userId,
          SCOPE_REFUND,
          idempotencyKey,
        );
        if (prior !== null) {
          if (prior.requestHash !== hash) {
            throw idempotencyConflict();
          }
          const refund = await tx.findRefund(prior.resourceId);
          if (refund === null) {
            throw notFound();
          }
          return { replayed: true, refund };
        }
        const refund: RefundRecord = {
          id: randomUUID(),
          bookingId,
          provider: this.provider.name,
          providerRefundRef: null,
          amountMinor,
          currency: booking.currency,
          reasonCode: input.reasonCode,
          status: "REQUESTED",
          idempotencyKey,
          requestedById: actor.userId,
          createdAt: this.now().toISOString(),
        };
        await tx.insertRefund(refund);
        await tx.insertIdempotency({
          id: randomUUID(),
          actorUserId: actor.userId,
          scope: SCOPE_REFUND,
          idempotencyKey,
          requestHash: hash,
          resourceType: "refund",
          resourceId: refund.id,
        });
        await tx.insertOutbox(
          randomUUID(),
          "refund.requested",
          bookingId,
          { bookingId, status: "REQUESTED" },
          refund.createdAt,
        );
        return { replayed: false, refund };
      }),
    );
  }

  reviewRefund(
    refundId: string,
    decision: "approve" | "reject",
    amountMinor: number | undefined,
  ): Promise<RefundRecord> {
    if (!this.provider.configured) {
      throw providerUnavailable();
    }
    return this.database.transaction(async (tx) => {
      const existing = await tx.findRefund(refundId);
      if (existing === null) {
        throw notFound();
      }
      return tx.exclusive(
        [`booking:${existing.bookingId}`, `refund:${refundId}`],
        async () => {
          const refund = await tx.findRefund(refundId);
          if (refund === null) {
            throw notFound();
          }
          if (decision === "reject") {
            if (refund.status !== "REQUESTED") {
              throw invalidState("This refund can no longer be rejected.");
            }
            await tx.updateRefund(refund.id, { status: "FAILED" });
            const failed = await tx.findRefund(refund.id);
            if (failed === null) {
              throw notFound();
            }
            return failed;
          }
          if (refund.status === "PENDING" || refund.status === "SUCCEEDED") {
            return refund;
          }
          if (refund.status !== "REQUESTED") {
            throw invalidState("This refund can no longer be approved.");
          }
          const booking = await tx.findBooking(refund.bookingId);
          if (booking === null) {
            throw notFound();
          }
          const nextAmount = amountMinor ?? refund.amountMinor;
          if (nextAmount > refund.amountMinor) {
            throw refundExceedsCaptured();
          }
          const captured = await tx.capturedMinor(refund.bookingId);
          const others =
            (await tx.refundedMinor(refund.bookingId)) - refund.amountMinor;
          if (nextAmount > captured - others) {
            throw refundExceedsCaptured();
          }
          const attempts = await tx.listAttempts(refund.bookingId);
          const succeeded = attempts.filter(
            (row) => row.status === "SUCCEEDED",
          );
          const payment = succeeded.length === 1 ? succeeded[0] : undefined;
          if (payment === undefined || payment.providerPaymentRef === null) {
            throw invalidState(
              "This booking does not have one captured payment.",
            );
          }
          if (nextAmount !== refund.amountMinor) {
            await tx.updateRefund(refund.id, { amountMinor: nextAmount });
          }
          const created = await this.provider.createRefund({
            providerPaymentRef: payment.providerPaymentRef,
            amountMinor: nextAmount,
            currency: booking.currency,
            idempotencyKey: `refund:${refund.id}`,
          });
          await tx.updateRefund(refund.id, {
            status: "PENDING",
            providerRefundRef: created.providerRefundRef,
          });
          const pending = await tx.findRefund(refund.id);
          if (pending === null) {
            throw notFound();
          }
          return pending;
        },
      );
    });
  }

  recordPayout(
    actor: PaymentActor,
    idempotencyKey: string,
    input: PayoutInput,
  ): Promise<{ replayed: boolean; payout: PayoutRecord }> {
    const amountMinor = input.allocations.reduce(
      (sum, row) => sum + row.amountMinor,
      0,
    );
    const hash = requestHash({
      hostId: input.hostId,
      currency: input.currency,
      amountMinor,
      allocations: [...input.allocations].sort((left, right) =>
        left.bookingId < right.bookingId ? -1 : 1,
      ),
    });
    return this.database.transaction((tx) =>
      tx.exclusive(
        [
          `payout:${actor.userId}:${idempotencyKey}`,
          ...input.allocations.map((row) => `booking:${row.bookingId}`),
        ],
        async () => {
          const prior = await tx.findIdempotency(
            actor.userId,
            SCOPE_PAYOUT,
            idempotencyKey,
          );
          if (prior !== null) {
            if (prior.requestHash !== hash) {
              throw idempotencyConflict();
            }
            const payout = await tx.findPayoutByKey(idempotencyKey);
            if (payout === null) {
              throw notFound();
            }
            return { replayed: true, payout };
          }
          const host = await tx.findHost(input.hostId);
          if (host === null) {
            throw notFound();
          }
          if (host.verificationStatus !== "VERIFIED") {
            throw hostNotEligible();
          }
          for (const allocation of input.allocations) {
            const booking = await tx.findBooking(allocation.bookingId);
            if (booking === null || booking.hostId !== input.hostId) {
              throw notFound();
            }
            if (booking.status === "DISPUTED") {
              throw disputeHold();
            }
            if (booking.status !== "COMPLETED") {
              throw invalidState(
                "This booking is not eligible for a payout record.",
              );
            }
            if (booking.currency !== input.currency) {
              throw invalidState(
                "This booking is not eligible for a payout record.",
              );
            }
            if (await tx.hasOpenRefund(booking.id)) {
              throw refundHold();
            }
            const payable = await tx.hostPayable(booking.id);
            const available =
              (payable === null
                ? 0
                : payable.creditMinor - payable.debitMinor) -
              (await tx.allocatedMinor(booking.id));
            if (allocation.amountMinor > available) {
              throw payoutExceedsPayable();
            }
          }
          const payout: PayoutRecord = {
            id: randomUUID(),
            hostId: input.hostId,
            hostUserId: host.userId,
            provider: this.provider.configured
              ? this.provider.name
              : "unconfirmed",
            providerPayoutRef: null,
            amountMinor,
            currency: input.currency,
            status: "ELIGIBLE",
            idempotencyKey,
            allocations: input.allocations.map((row) => ({ ...row })),
            createdAt: this.now().toISOString(),
          };
          await tx.insertPayout(payout);
          await tx.insertIdempotency({
            id: randomUUID(),
            actorUserId: actor.userId,
            scope: SCOPE_PAYOUT,
            idempotencyKey,
            requestHash: hash,
            resourceType: "payout",
            resourceId: payout.id,
          });
          await tx.insertOutbox(
            randomUUID(),
            "payout.eligible",
            payout.id,
            { bookingId: payout.id, status: "ELIGIBLE" },
            payout.createdAt,
          );
          return { replayed: false, payout };
        },
      ),
    );
  }

  listOwnPayouts(actor: PaymentActor): Promise<PayoutRecord[]> {
    if (!actor.permissions.has(Permissions.PAYOUT_READ_OWN)) {
      throw hidden("payout", actor.userId);
    }
    return this.database.transaction((tx) =>
      tx.listPayoutsForHostUser(actor.userId),
    );
  }

  async ownEarnings(actor: PaymentActor): Promise<{
    settlement: typeof SETTLEMENT_MODEL;
    items: {
      currency: string;
      hostPayableMinor: number;
      allocatedMinor: number;
      availableMinor: number;
    }[];
  }> {
    if (!actor.permissions.has(Permissions.PAYOUT_READ_OWN)) {
      throw hidden("payout", actor.userId);
    }
    const rows = await this.database.transaction((tx) =>
      tx.hostEarnings(actor.userId),
    );
    return {
      settlement: SETTLEMENT_MODEL,
      items: rows.map((row) => ({
        currency: row.currency,
        hostPayableMinor: row.payableMinor,
        allocatedMinor: row.allocatedMinor,
        availableMinor: row.payableMinor - row.allocatedMinor,
      })),
    };
  }

  async reconcile(): Promise<ReturnType<typeof exceptionView>[]> {
    if (!this.provider.configured) {
      throw providerUnavailable();
    }
    const report = await this.provider.report();
    return this.database.transaction((tx) =>
      tx.exclusive([`reconcile:${this.provider.name}`], async () => {
        const attempts = await tx.listAttempts();
        const refunds = await tx.listRefunds();
        const payouts = await tx.listPayouts();
        const totals = await tx.ledgerTotals();
        const drafts = findDiscrepancies({
          providerName: this.provider.name,
          attempts,
          refunds,
          payouts,
          report,
          ledgerDebitMinor: totals.debitMinor,
          ledgerCreditMinor: totals.creditMinor,
        });
        const created: ReturnType<typeof exceptionView>[] = [];
        for (const draft of drafts) {
          if (await tx.hasOpenException(draft.kind, draft.resourceRef)) {
            continue;
          }
          const row = {
            id: randomUUID(),
            provider: this.provider.name,
            kind: draft.kind,
            resourceRef: draft.resourceRef,
            currency: draft.currency,
            expectedMinor: draft.expectedMinor,
            actualMinor: draft.actualMinor,
            detail: draft.detail,
            createdAt: this.now().toISOString(),
          };
          await tx.insertException(row);
          created.push(exceptionView(row));
        }
        return created;
      }),
    );
  }

  listExceptions(): Promise<ReturnType<typeof exceptionView>[]> {
    return this.database.transaction(async (tx) =>
      (await tx.listExceptions()).map(exceptionView),
    );
  }

  private async lockWebhook(event: ProviderEvent): Promise<void> {
    const keys = [`event:${this.provider.name}:${event.id}`];
    if (isPaymentEvent(event)) {
      keys.push(`order:${event.orderId}`);
      const attempt = await this.database.transaction((tx) =>
        tx.findAttemptByOrder(this.provider.name, event.orderId),
      );
      if (attempt !== null) {
        keys.push(`booking:${attempt.bookingId}`);
      }
    } else {
      keys.push(`refund:${event.refundId}`);
      const refund = await this.database.transaction((tx) =>
        tx.findRefundByProviderRef(this.provider.name, event.refundId),
      );
      if (refund !== null) {
        keys.push(`booking:${refund.bookingId}`);
      }
    }
    await this.database.transaction((tx) =>
      tx.exclusive(keys, () => this.ingest(tx, event)),
    );
  }

  private async ownedBooking(
    tx: PaymentTx,
    actor: PaymentActor,
    bookingId: string,
    travellerOnly: boolean,
  ): Promise<PaymentBooking> {
    const booking = await tx.findBooking(bookingId);
    if (booking === null) {
      throw hidden("booking", bookingId);
    }
    const owner = travellerOnly
      ? booking.travellerId === actor.userId
      : booking.travellerId === actor.userId ||
        booking.hostUserId === actor.userId;
    if (!owner) {
      throw hidden("booking", bookingId);
    }
    return booking;
  }

  private async ingest(tx: PaymentTx, event: ProviderEvent): Promise<void> {
    const existing = await tx.findWebhook(this.provider.name, event.id);
    if (existing?.processingStatus === "PROCESSED") {
      return;
    }
    const webhookId = existing?.id ?? randomUUID();
    if (existing === null) {
      await tx.insertWebhook({
        id: webhookId,
        provider: this.provider.name,
        providerEventId: event.id,
        processingStatus: "VERIFIED",
        payload: payloadOf(event),
      });
    }
    if (isPaymentEvent(event)) {
      const fact = await this.provider.fetchPayment(event.orderId);
      await this.applyPaymentFact(tx, fact, event);
    } else {
      await this.applyRefundFact(tx, event);
    }
    await tx.finishWebhook(webhookId, "PROCESSED", this.now().toISOString());
  }

  private async applyPaymentFact(
    tx: PaymentTx,
    fact: Awaited<ReturnType<PaymentProvider["fetchPayment"]>>,
    event: Extract<
      ProviderEvent,
      { type: "payment.captured" | "payment.failed" }
    > | null,
  ): Promise<void> {
    if (fact === null) {
      if (event !== null) {
        await this.recordException(tx, {
          kind: "INTERNAL_PAYMENT_MISSING_PROVIDER",
          resourceRef: event.orderId,
          currency: event.currency,
          expectedMinor: event.amountMinor,
          actualMinor: null,
          detail: "Provider has no payment record for this order.",
        });
      }
      return;
    }
    const attempt = await tx.findAttemptByOrder(
      this.provider.name,
      fact.providerOrderRef,
    );
    if (attempt === null) {
      await this.recordException(tx, {
        kind: "PROVIDER_PAYMENT_MISSING_INTERNAL",
        resourceRef: fact.providerPaymentRef ?? fact.providerOrderRef,
        currency: fact.currency,
        expectedMinor: fact.amountMinor,
        actualMinor: null,
        detail: "A provider payment has no internal attempt.",
      });
      return;
    }
    if (
      event !== null &&
      (event.amountMinor !== fact.amountMinor ||
        event.currency !== fact.currency ||
        event.orderId !== fact.providerOrderRef ||
        (fact.providerPaymentRef !== null &&
          event.paymentId !== fact.providerPaymentRef))
    ) {
      await this.recordException(tx, {
        kind: "AMOUNT_MISMATCH",
        resourceRef: fact.providerOrderRef,
        currency: fact.currency,
        expectedMinor: fact.amountMinor,
        actualMinor: event.amountMinor,
        detail: "Provider event does not match the provider payment record.",
      });
      return;
    }
    if (
      fact.amountMinor !== attempt.amountMinor ||
      fact.currency !== attempt.currency
    ) {
      await this.recordException(tx, {
        kind: "AMOUNT_MISMATCH",
        resourceRef: fact.providerOrderRef,
        currency: attempt.currency,
        expectedMinor: attempt.amountMinor,
        actualMinor: fact.amountMinor,
        detail: "Provider payment does not match the stored attempt.",
      });
      return;
    }
    if (fact.status === "pending" || fact.providerPaymentRef === null) {
      return;
    }
    if (attempt.status === "SUCCEEDED") {
      return;
    }
    if (fact.status === "failed") {
      await tx.markAttempt(attempt.id, "FAILED", fact.providerPaymentRef);
      return;
    }
    const booking = await tx.findBooking(attempt.bookingId);
    if (booking === null || booking.status !== "AWAITING_PAYMENT") {
      await this.recordException(tx, {
        kind: "CAPTURED_BOOKING_NOT_CONFIRMABLE",
        resourceRef: attempt.bookingId,
        currency: attempt.currency,
        expectedMinor: attempt.amountMinor,
        actualMinor: fact.amountMinor,
        detail:
          "The provider captured a payment for a booking that is not awaiting payment.",
      });
      return;
    }
    const confirmed = await tx.confirmBooking(booking.id);
    if (!confirmed) {
      await this.recordException(tx, {
        kind: "CAPTURED_BOOKING_NOT_CONFIRMABLE",
        resourceRef: booking.id,
        currency: booking.currency,
        expectedMinor: booking.totalMinor,
        actualMinor: fact.amountMinor,
        detail: "The booking could not be confirmed from the provider capture.",
      });
      return;
    }
    const marked = await tx.markAttempt(
      attempt.id,
      "SUCCEEDED",
      fact.providerPaymentRef,
    );
    if (!marked) {
      throw invalidState("This payment attempt can no longer be confirmed.");
    }
    const createdAt = this.now().toISOString();
    await tx.postLedger({
      id: randomUUID(),
      transactionType: "BOOKING_CHARGE",
      bookingId: booking.id,
      idempotencyKey: `capture:${attempt.id}`,
      currency: booking.currency,
      createdAt,
      lines: captureLines({
        currency: booking.currency,
        totalMinor: booking.totalMinor,
        hostGrossMinor: booking.hostGrossMinor,
        commissionMinor: booking.commissionMinor,
      }),
    });
    await tx.insertBookingEvent(
      randomUUID(),
      booking.id,
      "payment.succeeded",
      createdAt,
    );
    await tx.insertOutbox(
      randomUUID(),
      "booking.confirmed",
      booking.id,
      { bookingId: booking.id, status: "CONFIRMED" },
      createdAt,
    );
  }

  private async applyRefundFact(
    tx: PaymentTx,
    event: Extract<
      ProviderEvent,
      { type: "refund.processed" | "refund.failed" }
    >,
  ): Promise<void> {
    const fact = await this.provider.fetchRefund(event.refundId);
    const refund = await tx.findRefundByProviderRef(
      this.provider.name,
      event.refundId,
    );
    if (fact === null || refund === null) {
      await this.recordException(tx, {
        kind: "PROVIDER_PAYMENT_MISSING_INTERNAL",
        resourceRef: event.refundId,
        currency: event.currency,
        expectedMinor: event.amountMinor,
        actualMinor: fact?.amountMinor ?? null,
        detail: "A provider refund does not match an internal refund.",
      });
      return;
    }
    if (
      event.amountMinor !== fact.amountMinor ||
      event.currency !== fact.currency ||
      fact.amountMinor !== refund.amountMinor ||
      fact.currency !== refund.currency ||
      event.paymentId !== fact.providerPaymentRef
    ) {
      await this.recordException(tx, {
        kind: "AMOUNT_MISMATCH",
        resourceRef: event.refundId,
        currency: refund.currency,
        expectedMinor: refund.amountMinor,
        actualMinor: fact.amountMinor,
        detail: "Provider refund does not match the stored refund.",
      });
      return;
    }
    if (refund.status === "SUCCEEDED") {
      return;
    }
    if (refund.status !== "PENDING") {
      await this.recordException(tx, {
        kind: "UNRESOLVED_PENDING",
        resourceRef: refund.id,
        currency: refund.currency,
        expectedMinor: refund.amountMinor,
        actualMinor: fact.amountMinor,
        detail: "A refund event arrived before the refund was submitted.",
      });
      return;
    }
    if (fact.status === "failed" || event.type === "refund.failed") {
      await tx.updateRefund(refund.id, { status: "FAILED" });
      return;
    }
    if (fact.status !== "processed") {
      return;
    }
    const booking = await tx.findBooking(refund.bookingId);
    if (booking === null) {
      throw notFound();
    }
    const already = await tx.refundDebits(refund.bookingId);
    const split = refundSplit({
      refundMinor: refund.amountMinor,
      totalMinor: booking.totalMinor,
      hostGrossMinor: booking.hostGrossMinor,
      commissionMinor: booking.commissionMinor,
      hostAlreadyMinor: already.hostMinor,
      commissionAlreadyMinor: already.commissionMinor,
    });
    const createdAt = this.now().toISOString();
    await tx.postLedger({
      id: randomUUID(),
      transactionType: "REFUND",
      bookingId: booking.id,
      idempotencyKey: `refund:${refund.id}`,
      currency: booking.currency,
      createdAt,
      lines: refundLines({
        currency: booking.currency,
        refundMinor: refund.amountMinor,
        hostMinor: split.hostMinor,
        commissionMinor: split.commissionMinor,
      }),
    });
    await tx.updateRefund(refund.id, { status: "SUCCEEDED" });
    const payable = await tx.hostPayable(booking.id);
    const available =
      (payable === null ? 0 : payable.creditMinor - payable.debitMinor) -
      (await tx.allocatedMinor(booking.id));
    if (available < 0) {
      await this.recordException(tx, {
        kind: "PAYOUT_MISMATCH",
        resourceRef: booking.id,
        currency: booking.currency,
        expectedMinor: 0,
        actualMinor: available,
        detail:
          "Host payable from the ledger is below recorded payout allocations.",
      });
    }
    await tx.insertOutbox(
      randomUUID(),
      "refund.succeeded",
      booking.id,
      { bookingId: booking.id, status: "SUCCEEDED" },
      createdAt,
    );
  }

  private async recordException(
    tx: PaymentTx,
    draft: {
      kind: ReconciliationKind;
      resourceRef: string;
      currency: string | null;
      expectedMinor: number | null;
      actualMinor: number | null;
      detail: string;
    },
  ): Promise<void> {
    if (await tx.hasOpenException(draft.kind, draft.resourceRef)) {
      return;
    }
    await tx.insertException({
      id: randomUUID(),
      provider: this.provider.name,
      kind: draft.kind,
      resourceRef: draft.resourceRef,
      currency: draft.currency,
      expectedMinor: draft.expectedMinor,
      actualMinor: draft.actualMinor,
      detail: draft.detail.slice(0, 240),
      createdAt: this.now().toISOString(),
    });
  }
}

function isPaymentEvent(
  event: ProviderEvent,
): event is Extract<
  ProviderEvent,
  { type: "payment.captured" | "payment.failed" }
> {
  return event.type === "payment.captured" || event.type === "payment.failed";
}

function payloadOf(event: ProviderEvent): WebhookPayload {
  if (isPaymentEvent(event)) {
    return {
      type: event.type,
      amountMinor: event.amountMinor,
      currency: event.currency,
      orderId: event.orderId,
      paymentId: event.paymentId,
    };
  }
  return {
    type: event.type,
    amountMinor: event.amountMinor,
    currency: event.currency,
    refundId: event.refundId,
    paymentId: event.paymentId,
  };
}
