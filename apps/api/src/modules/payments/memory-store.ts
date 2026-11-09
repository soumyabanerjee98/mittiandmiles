import type { PaymentDatabase, PaymentTx, WebhookPayload } from "./tx.js";
import type {
  ExceptionRecord,
  IdempotencyRecord,
  LedgerLine,
  LedgerPost,
  PaymentAttempt,
  PaymentBooking,
  PayoutRecord,
  ReconciliationKind,
  RefundRecord,
  WebhookRecord,
} from "./types.js";

type LedgerRow = LedgerPost & { lines: LedgerLine[] };

type StoredWebhook = WebhookRecord & { payload: WebhookPayload };

export class MemoryPaymentStore implements PaymentDatabase {
  private readonly bookings: PaymentBooking[] = [];
  private readonly holds: { bookingId: string; state: "HELD" | "CONFIRMED" }[] =
    [];
  private readonly attempts: PaymentAttempt[] = [];
  private readonly refunds: RefundRecord[] = [];
  private readonly payouts: PayoutRecord[] = [];
  private readonly idempotency: IdempotencyRecord[] = [];
  private readonly webhooks: StoredWebhook[] = [];
  private readonly ledger: LedgerRow[] = [];
  private readonly exceptions: ExceptionRecord[] = [];
  private readonly events: { bookingId: string; eventType: string }[] = [];
  private readonly tails = new Map<string, Promise<void>>();

  transaction<T>(run: (tx: PaymentTx) => Promise<T>): Promise<T> {
    return run(this.tx());
  }

  seedAttempt(row: PaymentAttempt): void {
    this.attempts.push(structuredClone(row));
  }

  seedBooking(booking: PaymentBooking, hold = false): void {
    this.bookings.push(structuredClone(booking));
    if (hold) {
      this.holds.push({ bookingId: booking.id, state: "HELD" });
    }
  }

  seedLedger(post: LedgerPost): void {
    this.ledger.push(structuredClone(post));
  }

  seedPayout(row: PayoutRecord): void {
    this.payouts.push(structuredClone(row));
  }

  bookingStatus(id: string): string | null {
    return this.bookings.find((row) => row.id === id)?.status ?? null;
  }

  holdState(bookingId: string): string | null {
    return this.holds.find((row) => row.bookingId === bookingId)?.state ?? null;
  }

  ledgerTransactionCount(): number {
    return this.ledger.length;
  }

  exceptionKinds(): string[] {
    return this.exceptions.map((row) => row.kind);
  }

  private tx(): PaymentTx {
    return {
      exclusive: (keys, run) => this.exclusive(keys, run),
      findIdempotency: (actorUserId, scope, idempotencyKey) =>
        Promise.resolve(
          clone(
            this.idempotency.find(
              (row) =>
                row.actorUserId === actorUserId &&
                row.scope === scope &&
                row.idempotencyKey === idempotencyKey,
            ) ?? null,
          ),
        ),
      insertIdempotency: (row) => {
        this.idempotency.push(structuredClone(row));
        return Promise.resolve();
      },
      findBooking: (id) => Promise.resolve(this.booking(id)),
      findHost: (hostId) => {
        const booking = this.bookings.find((row) => row.hostId === hostId);
        if (booking === undefined) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: booking.hostId,
          userId: booking.hostUserId,
          verificationStatus: booking.hostVerificationStatus,
        });
      },
      listBookingsForHostUser: (userId) =>
        Promise.resolve(
          this.bookings
            .filter((row) => row.hostUserId === userId)
            .map((row) => clone(row)),
        ),
      findAttempt: (id) =>
        Promise.resolve(
          clone(this.attempts.find((row) => row.id === id) ?? null),
        ),
      findAttemptByKey: (idempotencyKey) =>
        Promise.resolve(
          clone(
            this.attempts.find(
              (row) => row.idempotencyKey === idempotencyKey,
            ) ?? null,
          ),
        ),
      findAttemptByOrder: (provider, providerOrderRef) =>
        Promise.resolve(
          clone(
            this.attempts.find(
              (row) =>
                row.provider === provider &&
                row.providerOrderRef === providerOrderRef,
            ) ?? null,
          ),
        ),
      findOpenAttempt: (bookingId) =>
        Promise.resolve(
          clone(
            this.attempts.find(
              (row) =>
                row.bookingId === bookingId &&
                (row.status === "CREATED" || row.status === "PENDING"),
            ) ?? null,
          ),
        ),
      latestAttempt: (bookingId) => {
        const rows = this.attempts.filter((row) => row.bookingId === bookingId);
        return Promise.resolve(clone(rows[rows.length - 1] ?? null));
      },
      listAttempts: (bookingId) =>
        Promise.resolve(
          this.attempts
            .filter(
              (row) => bookingId === undefined || row.bookingId === bookingId,
            )
            .map((row) => clone(row)),
        ),
      insertAttempt: (row) => {
        this.attempts.push(structuredClone(row));
        return Promise.resolve();
      },
      attachOrder: (attemptId, providerOrderRef) => {
        const row = this.attempts.find((item) => item.id === attemptId);
        if (row === undefined || row.status !== "CREATED") {
          return Promise.resolve(false);
        }
        row.providerOrderRef = providerOrderRef;
        row.status = "PENDING";
        return Promise.resolve(true);
      },
      markAttempt: (attemptId, status, providerPaymentRef) => {
        const row = this.attempts.find((item) => item.id === attemptId);
        if (
          row === undefined ||
          (row.status !== "CREATED" && row.status !== "PENDING")
        ) {
          return Promise.resolve(false);
        }
        row.status = status;
        row.providerPaymentRef = providerPaymentRef;
        return Promise.resolve(true);
      },
      confirmBooking: (bookingId) => {
        const booking = this.bookings.find((row) => row.id === bookingId);
        if (booking === undefined || booking.status !== "AWAITING_PAYMENT") {
          return Promise.resolve(false);
        }
        booking.status = "CONFIRMED";
        for (const hold of this.holds) {
          if (hold.bookingId === bookingId && hold.state === "HELD") {
            hold.state = "CONFIRMED";
          }
        }
        return Promise.resolve(true);
      },
      insertBookingEvent: (_id, bookingId, eventType) => {
        this.events.push({ bookingId, eventType });
        return Promise.resolve();
      },
      insertOutbox: () => Promise.resolve(),
      findWebhook: (provider, providerEventId) =>
        Promise.resolve(
          clone(
            this.webhooks.find(
              (row) =>
                row.provider === provider &&
                row.providerEventId === providerEventId,
            ) ?? null,
          ),
        ),
      insertWebhook: (row) => {
        this.webhooks.push(structuredClone(row));
        return Promise.resolve();
      },
      finishWebhook: (id, status) => {
        const row = this.webhooks.find((item) => item.id === id);
        if (row !== undefined) {
          row.processingStatus = status;
        }
        return Promise.resolve();
      },
      refundedMinor: (bookingId) =>
        Promise.resolve(
          this.refunds
            .filter(
              (row) => row.bookingId === bookingId && row.status !== "FAILED",
            )
            .reduce((sum, row) => sum + row.amountMinor, 0),
        ),
      capturedMinor: (bookingId) =>
        Promise.resolve(
          this.attempts
            .filter(
              (row) =>
                row.bookingId === bookingId && row.status === "SUCCEEDED",
            )
            .reduce((sum, row) => sum + row.amountMinor, 0),
        ),
      refundDebits: (bookingId) => Promise.resolve(this.debits(bookingId)),
      hostPayable: (bookingId) => Promise.resolve(this.movement(bookingId)),
      allocatedMinor: (bookingId) => Promise.resolve(this.allocated(bookingId)),
      hasOpenRefund: (bookingId) =>
        Promise.resolve(
          this.refunds.some(
            (row) =>
              row.bookingId === bookingId &&
              (row.status === "REQUESTED" || row.status === "PENDING"),
          ),
        ),
      insertRefund: (row) => {
        this.refunds.push(structuredClone(row));
        return Promise.resolve();
      },
      findRefund: (id) =>
        Promise.resolve(
          clone(this.refunds.find((row) => row.id === id) ?? null),
        ),
      findRefundByKey: (idempotencyKey) =>
        Promise.resolve(
          clone(
            this.refunds.find((row) => row.idempotencyKey === idempotencyKey) ??
              null,
          ),
        ),
      findRefundByProviderRef: (provider, providerRefundRef) =>
        Promise.resolve(
          clone(
            this.refunds.find(
              (row) =>
                row.provider === provider &&
                row.providerRefundRef === providerRefundRef,
            ) ?? null,
          ),
        ),
      updateRefund: (id, patch) => {
        const row = this.refunds.find((item) => item.id === id);
        if (row !== undefined) {
          if (patch.amountMinor !== undefined) {
            row.amountMinor = patch.amountMinor;
          }
          if (patch.status !== undefined) {
            row.status = patch.status;
          }
          if (patch.providerRefundRef !== undefined) {
            row.providerRefundRef = patch.providerRefundRef;
          }
        }
        return Promise.resolve();
      },
      listRefunds: (bookingId) =>
        Promise.resolve(
          this.refunds
            .filter(
              (row) => bookingId === undefined || row.bookingId === bookingId,
            )
            .map((row) => clone(row)),
        ),
      findPayoutByKey: (idempotencyKey) =>
        Promise.resolve(
          clone(
            this.payouts.find((row) => row.idempotencyKey === idempotencyKey) ??
              null,
          ),
        ),
      insertPayout: (row) => {
        this.payouts.push(structuredClone(row));
        return Promise.resolve();
      },
      listPayoutsForHostUser: (userId) =>
        Promise.resolve(
          this.payouts
            .filter((row) => row.hostUserId === userId)
            .map((row) => clone(row)),
        ),
      listPayouts: () => Promise.resolve(this.payouts.map((row) => clone(row))),
      hostEarnings: (userId) => Promise.resolve(this.earnings(userId)),
      postLedger: (post) => {
        if (
          this.ledger.some((row) => row.idempotencyKey === post.idempotencyKey)
        ) {
          return Promise.resolve("exists");
        }
        this.ledger.push(structuredClone(post));
        return Promise.resolve("posted");
      },
      ledgerTotals: () => {
        let debitMinor = 0;
        let creditMinor = 0;
        for (const post of this.ledger) {
          for (const entry of post.lines) {
            debitMinor += entry.debitMinor;
            creditMinor += entry.creditMinor;
          }
        }
        return Promise.resolve({ debitMinor, creditMinor });
      },
      hasOpenException: (kind, resourceRef) =>
        Promise.resolve(this.openException(kind, resourceRef)),
      insertException: (row) => {
        this.exceptions.push(structuredClone(row));
        return Promise.resolve();
      },
      listExceptions: () =>
        Promise.resolve(this.exceptions.map((row) => clone(row))),
    };
  }

  private booking(id: string): PaymentBooking | null {
    return clone(this.bookings.find((row) => row.id === id) ?? null);
  }

  private debits(bookingId: string): {
    hostMinor: number;
    commissionMinor: number;
  } {
    let hostMinor = 0;
    let commissionMinor = 0;
    for (const post of this.ledger) {
      if (post.bookingId !== bookingId || post.transactionType !== "REFUND") {
        continue;
      }
      for (const entry of post.lines) {
        if (entry.code === "host_payable") {
          hostMinor += entry.debitMinor;
        }
        if (entry.code === "commission_revenue") {
          commissionMinor += entry.debitMinor;
        }
      }
    }
    return { hostMinor, commissionMinor };
  }

  private movement(bookingId: string): {
    currency: string;
    debitMinor: number;
    creditMinor: number;
  } | null {
    let currency: string | null = null;
    let debitMinor = 0;
    let creditMinor = 0;
    for (const post of this.ledger) {
      if (post.bookingId !== bookingId) {
        continue;
      }
      for (const entry of post.lines) {
        if (entry.code !== "host_payable") {
          continue;
        }
        currency = entry.currency;
        debitMinor += entry.debitMinor;
        creditMinor += entry.creditMinor;
      }
    }
    if (currency === null) {
      return null;
    }
    return { currency, debitMinor, creditMinor };
  }

  private allocated(bookingId: string): number {
    let total = 0;
    for (const payout of this.payouts) {
      if (payout.status === "FAILED") {
        continue;
      }
      for (const allocation of payout.allocations) {
        if (allocation.bookingId === bookingId) {
          total += allocation.amountMinor;
        }
      }
    }
    return total;
  }

  private earnings(userId: string): {
    currency: string;
    payableMinor: number;
    allocatedMinor: number;
  }[] {
    const bookingIds = new Set(
      this.bookings
        .filter((row) => row.hostUserId === userId)
        .map((row) => row.id),
    );
    const byCurrency = new Map<
      string,
      { payableMinor: number; allocatedMinor: number }
    >();
    for (const post of this.ledger) {
      if (!bookingIds.has(post.bookingId)) {
        continue;
      }
      for (const entry of post.lines) {
        if (entry.code !== "host_payable") {
          continue;
        }
        const current = byCurrency.get(entry.currency) ?? {
          payableMinor: 0,
          allocatedMinor: 0,
        };
        current.payableMinor += entry.creditMinor - entry.debitMinor;
        byCurrency.set(entry.currency, current);
      }
    }
    for (const payout of this.payouts) {
      if (payout.hostUserId !== userId || payout.status === "FAILED") {
        continue;
      }
      const current = byCurrency.get(payout.currency) ?? {
        payableMinor: 0,
        allocatedMinor: 0,
      };
      current.allocatedMinor += payout.amountMinor;
      byCurrency.set(payout.currency, current);
    }
    return [...byCurrency.entries()].map(([rowCurrency, amounts]) => ({
      currency: rowCurrency,
      payableMinor: amounts.payableMinor,
      allocatedMinor: amounts.allocatedMinor,
    }));
  }

  private openException(
    kind: ReconciliationKind,
    resourceRef: string,
  ): boolean {
    return this.exceptions.some(
      (row) => row.kind === kind && row.resourceRef === resourceRef,
    );
  }

  private async exclusive<T>(
    keys: readonly string[],
    run: () => Promise<T>,
  ): Promise<T> {
    const ordered = [...new Set(keys)].sort();
    const releases: (() => void)[] = [];
    try {
      for (const key of ordered) {
        const previous = this.tails.get(key) ?? Promise.resolve();
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        this.tails.set(
          key,
          previous.then(() => gate),
        );
        await previous;
        releases.push(release);
      }
      return await run();
    } finally {
      for (const release of releases) {
        release();
      }
    }
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
