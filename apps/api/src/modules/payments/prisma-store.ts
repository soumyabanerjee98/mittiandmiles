import { Prisma, PrismaClient } from "@prisma/client";
import { idempotencyConflict } from "../bookings/errors.js";
import { isBookingStatus } from "../bookings/state.js";
import type { PaymentDatabase, PaymentTx, WebhookPayload } from "./tx.js";
import type {
  AccountMovement,
  ExceptionRecord,
  HostVerificationStatus,
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

const bookingInclude = {
  host: { select: { userId: true, verificationStatus: true } },
} satisfies Prisma.BookingInclude;

const payoutInclude = {
  host: { select: { userId: true } },
  allocations: true,
} satisfies Prisma.PayoutInclude;

export class PrismaPaymentStore implements PaymentDatabase {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(run: (tx: PaymentTx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction((tx) =>
        run(new PrismaPaymentTx(tx)),
      );
    } catch (error: unknown) {
      throw mapWriteError(error);
    }
  }
}

class PrismaPaymentTx implements PaymentTx {
  constructor(private readonly db: Prisma.TransactionClient) {}

  async exclusive<T>(
    keys: readonly string[],
    run: () => Promise<T>,
  ): Promise<T> {
    for (const key of [...new Set(keys)].sort()) {
      const split = key.indexOf(":");
      const kind = split < 0 ? key : key.slice(0, split);
      const id = split < 0 ? "" : key.slice(split + 1);
      if (kind === "booking" && isUuid(id)) {
        await this.db
          .$queryRaw`SELECT id FROM bookings WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
      } else {
        await this.db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      }
    }
    return run();
  }

  async findIdempotency(
    actorUserId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null> {
    const row = await this.db.commandIdempotency.findUnique({
      where: {
        actorUserId_scope_idempotencyKey: {
          actorUserId,
          scope,
          idempotencyKey,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      scope: row.scope,
      idempotencyKey: row.idempotencyKey,
      requestHash: row.requestHash,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    };
  }

  async insertIdempotency(row: IdempotencyRecord): Promise<void> {
    await this.db.commandIdempotency.create({
      data: {
        id: row.id,
        actorUserId: row.actorUserId,
        scope: row.scope,
        idempotencyKey: row.idempotencyKey,
        requestHash: row.requestHash,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
      },
    });
  }

  async findBooking(id: string): Promise<PaymentBooking | null> {
    const row = await this.db.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (row === null || !isBookingStatus(row.status)) {
      return null;
    }
    return {
      id: row.id,
      travellerId: row.travellerId,
      hostId: row.hostId,
      hostUserId: row.host.userId,
      hostVerificationStatus: hostStatus(row.host.verificationStatus),
      status: row.status,
      currency: row.currency,
      totalMinor: row.totalMinor,
      commissionMinor: row.commissionMinor,
      hostGrossMinor: row.hostGrossMinor,
    };
  }

  async findHost(hostId: string): Promise<{
    id: string;
    userId: string;
    verificationStatus: HostVerificationStatus;
  } | null> {
    const row = await this.db.hostProfile.findUnique({ where: { id: hostId } });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      verificationStatus: hostStatus(row.verificationStatus),
    };
  }

  async listBookingsForHostUser(userId: string): Promise<PaymentBooking[]> {
    const rows = await this.db.booking.findMany({
      where: { host: { userId } },
      include: bookingInclude,
    });
    return rows.flatMap((row) => {
      if (!isBookingStatus(row.status)) {
        return [];
      }
      return [
        {
          id: row.id,
          travellerId: row.travellerId,
          hostId: row.hostId,
          hostUserId: row.host.userId,
          hostVerificationStatus: hostStatus(row.host.verificationStatus),
          status: row.status,
          currency: row.currency,
          totalMinor: row.totalMinor,
          commissionMinor: row.commissionMinor,
          hostGrossMinor: row.hostGrossMinor,
        },
      ];
    });
  }

  async findAttempt(id: string): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findUnique({ where: { id } });
    return row === null ? null : toAttempt(row);
  }

  async findAttemptByKey(
    idempotencyKey: string,
  ): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });
    return row === null ? null : toAttempt(row);
  }

  async findAttemptByOrder(
    provider: string,
    providerOrderRef: string,
  ): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findFirst({
      where: { provider, providerOrderRef },
    });
    return row === null ? null : toAttempt(row);
  }

  async findOpenAttempt(bookingId: string): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findFirst({
      where: { bookingId, status: { in: ["CREATED", "PENDING"] } },
    });
    return row === null ? null : toAttempt(row);
  }

  async latestAttempt(bookingId: string): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findFirst({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
    });
    return row === null ? null : toAttempt(row);
  }

  async listAttempts(bookingId?: string): Promise<PaymentAttempt[]> {
    const rows = await this.db.paymentAttempt.findMany({
      ...(bookingId === undefined ? {} : { where: { bookingId } }),
    });
    return rows.map(toAttempt);
  }

  async insertAttempt(row: PaymentAttempt): Promise<void> {
    await this.db.paymentAttempt.create({
      data: {
        id: row.id,
        bookingId: row.bookingId,
        provider: row.provider,
        providerOrderRef: row.providerOrderRef,
        providerPaymentRef: row.providerPaymentRef,
        amountMinor: row.amountMinor,
        currency: row.currency,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async attachOrder(
    attemptId: string,
    providerOrderRef: string,
  ): Promise<boolean> {
    const result = await this.db.paymentAttempt.updateMany({
      where: { id: attemptId, status: "CREATED", providerOrderRef: null },
      data: { providerOrderRef, status: "PENDING" },
    });
    return result.count === 1;
  }

  async markAttempt(
    attemptId: string,
    status: "SUCCEEDED" | "FAILED",
    providerPaymentRef: string,
  ): Promise<boolean> {
    const result = await this.db.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["CREATED", "PENDING"] } },
      data: { status, providerPaymentRef },
    });
    return result.count === 1;
  }

  async confirmBooking(bookingId: string): Promise<boolean> {
    const updated = await this.db.booking.updateMany({
      where: { id: bookingId, status: "AWAITING_PAYMENT" },
      data: { status: "CONFIRMED" },
    });
    if (updated.count !== 1) {
      return false;
    }
    await this.db.slotReservation.updateMany({
      where: { bookingId, state: "HELD" },
      data: { state: "CONFIRMED", expiresAt: null },
    });
    return true;
  }

  async insertBookingEvent(
    id: string,
    bookingId: string,
    eventType: string,
    createdAt: string,
  ): Promise<void> {
    await this.db.bookingEvent.create({
      data: {
        id,
        bookingId,
        eventType,
        metadata: {},
        createdAt: new Date(createdAt),
      },
    });
  }

  async insertOutbox(
    id: string,
    eventType: string,
    aggregateId: string,
    payload: { bookingId: string; status: string },
    createdAt: string,
  ): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id,
        eventType,
        aggregateId,
        payload,
        createdAt: new Date(createdAt),
      },
    });
  }

  async findWebhook(
    provider: string,
    providerEventId: string,
  ): Promise<WebhookRecord | null> {
    const row = await this.db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider, providerEventId } },
    });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      provider: row.provider,
      providerEventId: row.providerEventId,
      processingStatus: row.processingStatus,
    };
  }

  async insertWebhook(
    row: WebhookRecord & { payload: WebhookPayload },
  ): Promise<void> {
    await this.db.webhookEvent.create({
      data: {
        id: row.id,
        provider: row.provider,
        providerEventId: row.providerEventId,
        signatureValid: true,
        processingStatus: row.processingStatus,
        payload: webhookJson(row.payload),
      },
    });
  }

  async finishWebhook(
    id: string,
    status: "PROCESSED" | "FAILED",
    processedAt: string,
  ): Promise<void> {
    await this.db.webhookEvent.update({
      where: { id },
      data: { processingStatus: status, processedAt: new Date(processedAt) },
    });
  }

  async refundedMinor(bookingId: string): Promise<number> {
    const sum = await this.db.refund.aggregate({
      where: { bookingId, status: { not: "FAILED" } },
      _sum: { amountMinor: true },
    });
    return sum._sum.amountMinor ?? 0;
  }

  async capturedMinor(bookingId: string): Promise<number> {
    const sum = await this.db.paymentAttempt.aggregate({
      where: { bookingId, status: "SUCCEEDED" },
      _sum: { amountMinor: true },
    });
    return sum._sum.amountMinor ?? 0;
  }

  async refundDebits(
    bookingId: string,
  ): Promise<{ hostMinor: number; commissionMinor: number }> {
    const rows = await this.db.ledgerEntry.findMany({
      where: { transaction: { bookingId, transactionType: "REFUND" } },
      include: { account: true },
    });
    let hostMinor = 0;
    let commissionMinor = 0;
    for (const row of rows) {
      if (row.account.code.startsWith("host_payable:")) {
        hostMinor += row.debitMinor;
      }
      if (row.account.code.startsWith("commission_revenue:")) {
        commissionMinor += row.debitMinor;
      }
    }
    return { hostMinor, commissionMinor };
  }

  async hostPayable(bookingId: string): Promise<AccountMovement | null> {
    const rows = await this.db.ledgerEntry.findMany({
      where: {
        transaction: { bookingId },
        account: { code: { startsWith: "host_payable:" } },
      },
      include: { account: true },
    });
    if (rows.length === 0) {
      return null;
    }
    let debitMinor = 0;
    let creditMinor = 0;
    for (const row of rows) {
      debitMinor += row.debitMinor;
      creditMinor += row.creditMinor;
    }
    return {
      currency: rows[0]?.account.currency ?? "INR",
      debitMinor,
      creditMinor,
    };
  }

  async allocatedMinor(bookingId: string): Promise<number> {
    const rows = await this.db.payoutAllocation.findMany({
      where: { bookingId, payout: { status: { not: "FAILED" } } },
    });
    return rows.reduce((sum, row) => sum + row.amountMinor, 0);
  }

  async hasOpenRefund(bookingId: string): Promise<boolean> {
    const count = await this.db.refund.count({
      where: { bookingId, status: { in: ["REQUESTED", "PENDING"] } },
    });
    return count > 0;
  }

  async insertRefund(row: RefundRecord): Promise<void> {
    await this.db.refund.create({
      data: {
        id: row.id,
        bookingId: row.bookingId,
        provider: row.provider,
        providerRefundRef: row.providerRefundRef,
        amountMinor: row.amountMinor,
        reasonCode: row.reasonCode,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        requestedById: row.requestedById,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async findRefund(id: string): Promise<RefundRecord | null> {
    const row = await this.db.refund.findUnique({
      where: { id },
      include: { booking: { select: { currency: true } } },
    });
    return row === null ? null : toRefund(row);
  }

  async findRefundByKey(idempotencyKey: string): Promise<RefundRecord | null> {
    const row = await this.db.refund.findUnique({
      where: { idempotencyKey },
      include: { booking: { select: { currency: true } } },
    });
    return row === null ? null : toRefund(row);
  }

  async findRefundByProviderRef(
    provider: string,
    providerRefundRef: string,
  ): Promise<RefundRecord | null> {
    const row = await this.db.refund.findFirst({
      where: { provider, providerRefundRef },
      include: { booking: { select: { currency: true } } },
    });
    return row === null ? null : toRefund(row);
  }

  async updateRefund(
    id: string,
    patch: {
      amountMinor?: number;
      status?: RefundStatus;
      providerRefundRef?: string | null;
    },
  ): Promise<void> {
    const data: Prisma.RefundUpdateInput = {};
    if (patch.amountMinor !== undefined) {
      data.amountMinor = patch.amountMinor;
    }
    if (patch.status !== undefined) {
      data.status = patch.status;
    }
    if (patch.providerRefundRef !== undefined) {
      data.providerRefundRef = patch.providerRefundRef;
    }
    await this.db.refund.update({ where: { id }, data });
  }

  async listRefunds(bookingId?: string): Promise<RefundRecord[]> {
    const rows = await this.db.refund.findMany({
      ...(bookingId === undefined ? {} : { where: { bookingId } }),
      include: { booking: { select: { currency: true } } },
    });
    return rows.flatMap((row) => {
      const mapped = toRefund(row);
      return mapped === null ? [] : [mapped];
    });
  }

  async findPayoutByKey(idempotencyKey: string): Promise<PayoutRecord | null> {
    const row = await this.db.payout.findUnique({
      where: { idempotencyKey },
      include: payoutInclude,
    });
    return row === null ? null : toPayout(row);
  }

  async insertPayout(row: PayoutRecord): Promise<void> {
    await this.db.payout.create({
      data: {
        id: row.id,
        hostId: row.hostId,
        provider: row.provider,
        providerPayoutRef: row.providerPayoutRef,
        amountMinor: row.amountMinor,
        currency: row.currency,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        createdAt: new Date(row.createdAt),
        allocations: {
          create: row.allocations.map((allocation) => ({
            bookingId: allocation.bookingId,
            amountMinor: allocation.amountMinor,
          })),
        },
      },
    });
  }

  async listPayoutsForHostUser(userId: string): Promise<PayoutRecord[]> {
    const rows = await this.db.payout.findMany({
      where: { host: { userId } },
      include: payoutInclude,
    });
    return rows.map(toPayout);
  }

  async listPayouts(): Promise<PayoutRecord[]> {
    const rows = await this.db.payout.findMany({ include: payoutInclude });
    return rows.map(toPayout);
  }

  async hostEarnings(
    userId: string,
  ): Promise<
    { currency: string; payableMinor: number; allocatedMinor: number }[]
  > {
    const bookings = await this.db.booking.findMany({
      where: { host: { userId } },
      select: { id: true },
    });
    const ids = bookings.map((row) => row.id);
    const entries = await this.db.ledgerEntry.findMany({
      where: {
        transaction: { bookingId: { in: ids } },
        account: { code: { startsWith: "host_payable:" } },
      },
      include: { account: true },
    });
    const byCurrency = new Map<
      string,
      { payableMinor: number; allocatedMinor: number }
    >();
    for (const entry of entries) {
      const current = byCurrency.get(entry.account.currency) ?? {
        payableMinor: 0,
        allocatedMinor: 0,
      };
      current.payableMinor += entry.creditMinor - entry.debitMinor;
      byCurrency.set(entry.account.currency, current);
    }
    const payouts = await this.db.payout.findMany({
      where: { host: { userId }, status: { not: "FAILED" } },
    });
    for (const payout of payouts) {
      const current = byCurrency.get(payout.currency) ?? {
        payableMinor: 0,
        allocatedMinor: 0,
      };
      current.allocatedMinor += payout.amountMinor;
      byCurrency.set(payout.currency, current);
    }
    return [...byCurrency.entries()].map(([currency, amounts]) => ({
      currency,
      payableMinor: amounts.payableMinor,
      allocatedMinor: amounts.allocatedMinor,
    }));
  }

  async postLedger(post: LedgerPost): Promise<"posted" | "exists"> {
    const existing = await this.db.ledgerTransaction.findUnique({
      where: { idempotencyKey: post.idempotencyKey },
    });
    if (existing !== null) {
      return "exists";
    }
    await this.db.ledgerTransaction.create({
      data: {
        id: post.id,
        transactionType: post.transactionType,
        bookingId: post.bookingId,
        idempotencyKey: post.idempotencyKey,
        currency: post.currency,
        createdAt: new Date(post.createdAt),
      },
    });
    for (const entry of post.lines) {
      const code = `${entry.code}:${entry.currency}`;
      let account = await this.db.ledgerAccount.findUnique({ where: { code } });
      if (account === null) {
        account = await this.db.ledgerAccount.create({
          data: {
            code,
            accountType: entry.accountType,
            currency: entry.currency,
          },
        });
      }
      await this.db.ledgerEntry.create({
        data: {
          transactionId: post.id,
          accountId: account.id,
          debitMinor: entry.debitMinor,
          creditMinor: entry.creditMinor,
        },
      });
    }
    return "posted";
  }

  async ledgerTotals(): Promise<{ debitMinor: number; creditMinor: number }> {
    const sum = await this.db.ledgerEntry.aggregate({
      _sum: { debitMinor: true, creditMinor: true },
    });
    return {
      debitMinor: sum._sum.debitMinor ?? 0,
      creditMinor: sum._sum.creditMinor ?? 0,
    };
  }

  async hasOpenException(
    kind: ReconciliationKind,
    resourceRef: string,
  ): Promise<boolean> {
    const count = await this.db.reconciliationException.count({
      where: { kind, resourceRef, resolvedAt: null },
    });
    return count > 0;
  }

  async insertException(row: ExceptionRecord): Promise<void> {
    await this.db.reconciliationException.create({
      data: {
        id: row.id,
        provider: row.provider,
        kind: row.kind,
        resourceRef: row.resourceRef,
        currency: row.currency,
        expectedMinor: row.expectedMinor,
        actualMinor: row.actualMinor,
        detail: row.detail,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async listExceptions(): Promise<ExceptionRecord[]> {
    const rows = await this.db.reconciliationException.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      kind: row.kind,
      resourceRef: row.resourceRef,
      currency: row.currency,
      expectedMinor: row.expectedMinor,
      actualMinor: row.actualMinor,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

function toAttempt(row: {
  id: string;
  bookingId: string;
  provider: string;
  providerOrderRef: string | null;
  providerPaymentRef: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentAttempt["status"];
  idempotencyKey: string;
  createdAt: Date;
}): PaymentAttempt {
  return {
    id: row.id,
    bookingId: row.bookingId,
    provider: row.provider,
    providerOrderRef: row.providerOrderRef,
    providerPaymentRef: row.providerPaymentRef,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRefund(row: {
  id: string;
  bookingId: string;
  provider: string;
  providerRefundRef: string | null;
  amountMinor: number;
  reasonCode: string;
  status: RefundStatus;
  idempotencyKey: string | null;
  requestedById: string | null;
  createdAt: Date;
  booking: { currency: string };
}): RefundRecord | null {
  if (row.idempotencyKey === null || row.requestedById === null) {
    return null;
  }
  return {
    id: row.id,
    bookingId: row.bookingId,
    provider: row.provider,
    providerRefundRef: row.providerRefundRef,
    amountMinor: row.amountMinor,
    currency: row.booking.currency,
    reasonCode: row.reasonCode,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    requestedById: row.requestedById,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPayout(row: {
  id: string;
  hostId: string;
  provider: string;
  providerPayoutRef: string | null;
  amountMinor: number;
  currency: string;
  status: PayoutRecord["status"];
  idempotencyKey: string | null;
  createdAt: Date;
  host: { userId: string };
  allocations: { bookingId: string; amountMinor: number }[];
}): PayoutRecord {
  return {
    id: row.id,
    hostId: row.hostId,
    hostUserId: row.host.userId,
    provider: row.provider,
    providerPayoutRef: row.providerPayoutRef,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotencyKey ?? row.id,
    allocations: row.allocations.map((allocation) => ({
      bookingId: allocation.bookingId,
      amountMinor: allocation.amountMinor,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

function webhookJson(payload: WebhookPayload): Prisma.InputJsonObject {
  return {
    type: payload.type,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    ...(payload.orderId === undefined ? {} : { orderId: payload.orderId }),
    ...(payload.paymentId === undefined
      ? {}
      : { paymentId: payload.paymentId }),
    ...(payload.refundId === undefined ? {} : { refundId: payload.refundId }),
  };
}

function hostStatus(value: string): HostVerificationStatus {
  switch (value) {
    case "NOT_STARTED":
    case "PENDING":
    case "VERIFIED":
    case "REJECTED":
    case "EXPIRED":
    case "NEEDS_INFORMATION":
      return value;
    default:
      throw new Error("Unknown host verification status.");
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function mapWriteError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return idempotencyConflict();
  }
  return error;
}
