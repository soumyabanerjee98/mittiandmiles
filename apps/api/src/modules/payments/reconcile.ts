import type {
  ExceptionRecord,
  PaymentAttempt,
  PayoutRecord,
  ReconciliationKind,
  RefundRecord,
} from "./types.js";
import type { ProviderReport } from "./provider.js";

export type ExceptionDraft = {
  kind: ReconciliationKind;
  resourceRef: string;
  currency: string | null;
  expectedMinor: number | null;
  actualMinor: number | null;
  detail: string;
};

export function findDiscrepancies(input: {
  providerName: string;
  attempts: readonly PaymentAttempt[];
  refunds: readonly RefundRecord[];
  payouts: readonly PayoutRecord[];
  report: ProviderReport;
  ledgerDebitMinor: number;
  ledgerCreditMinor: number;
}): ExceptionDraft[] {
  const found: ExceptionDraft[] = [];
  comparePayments(input.attempts, input.report, found);
  compareRefunds(input.refunds, input.report, found);
  comparePayouts(input.payouts, input.report, found);
  if (input.ledgerDebitMinor !== input.ledgerCreditMinor) {
    found.push(
      draft(
        "LEDGER_IMBALANCE",
        input.providerName,
        input.ledgerDebitMinor,
        input.ledgerCreditMinor,
        "Posted ledger debits and credits are not equal.",
      ),
    );
  }
  return found;
}

function comparePayments(
  attempts: readonly PaymentAttempt[],
  report: ProviderReport,
  found: ExceptionDraft[],
): void {
  const captured = report.payments.filter((row) => row.status === "captured");
  const seenProvider = new Set<string>();
  for (const fact of captured) {
    const ref = fact.providerPaymentRef ?? fact.providerOrderRef;
    if (seenProvider.has(ref)) {
      found.push(
        draft(
          "DUPLICATE_CAPTURE",
          ref,
          fact.amountMinor,
          fact.amountMinor,
          "The provider report repeats a captured payment.",
        ),
      );
      continue;
    }
    seenProvider.add(ref);
    const internal = attempts.find(
      (row) =>
        row.providerPaymentRef === fact.providerPaymentRef ||
        row.providerOrderRef === fact.providerOrderRef,
    );
    if (internal === undefined || internal.status !== "SUCCEEDED") {
      found.push(
        draft(
          "PROVIDER_PAYMENT_MISSING_INTERNAL",
          ref,
          fact.amountMinor,
          internal?.amountMinor ?? null,
          "A provider capture has no succeeded internal attempt.",
        ),
      );
      continue;
    }
    if (
      internal.amountMinor !== fact.amountMinor ||
      internal.currency !== fact.currency
    ) {
      found.push(
        draft(
          "AMOUNT_MISMATCH",
          ref,
          fact.amountMinor,
          internal.amountMinor,
          "Provider and internal payment amounts differ.",
          fact.currency,
        ),
      );
    }
  }

  const succeededByBooking = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.status === "CREATED" || attempt.status === "PENDING") {
      found.push(
        draft(
          "UNRESOLVED_PENDING",
          attempt.id,
          attempt.amountMinor,
          null,
          "A payment attempt is still pending.",
          attempt.currency,
        ),
      );
    }
    if (attempt.status !== "SUCCEEDED") {
      continue;
    }
    succeededByBooking.set(
      attempt.bookingId,
      (succeededByBooking.get(attempt.bookingId) ?? 0) + 1,
    );
    const ref = attempt.providerPaymentRef;
    if (ref === null) {
      continue;
    }
    const fact = captured.find((row) => row.providerPaymentRef === ref);
    if (fact === undefined) {
      found.push(
        draft(
          "INTERNAL_PAYMENT_MISSING_PROVIDER",
          ref,
          attempt.amountMinor,
          null,
          "A succeeded internal payment is missing from the provider report.",
          attempt.currency,
        ),
      );
    }
  }
  for (const [bookingId, count] of succeededByBooking) {
    if (count > 1) {
      found.push(
        draft(
          "DUPLICATE_CAPTURE",
          bookingId,
          null,
          count,
          "More than one succeeded attempt exists for a booking.",
        ),
      );
    }
  }
}

function compareRefunds(
  refunds: readonly RefundRecord[],
  report: ProviderReport,
  found: ExceptionDraft[],
): void {
  const processed = report.refunds.filter((row) => row.status === "processed");
  const seen = new Set<string>();
  for (const fact of processed) {
    if (seen.has(fact.providerRefundRef)) {
      found.push(
        draft(
          "DUPLICATE_REFUND",
          fact.providerRefundRef,
          fact.amountMinor,
          fact.amountMinor,
          "The provider report repeats a refund.",
          fact.currency,
        ),
      );
      continue;
    }
    seen.add(fact.providerRefundRef);
    const internal = refunds.find(
      (row) => row.providerRefundRef === fact.providerRefundRef,
    );
    if (internal === undefined || internal.status !== "SUCCEEDED") {
      found.push(
        draft(
          "PROVIDER_PAYMENT_MISSING_INTERNAL",
          fact.providerRefundRef,
          fact.amountMinor,
          internal?.amountMinor ?? null,
          "A provider refund has no succeeded internal refund.",
          fact.currency,
        ),
      );
      continue;
    }
    if (
      internal.amountMinor !== fact.amountMinor ||
      internal.currency !== fact.currency
    ) {
      found.push(
        draft(
          "AMOUNT_MISMATCH",
          fact.providerRefundRef,
          fact.amountMinor,
          internal.amountMinor,
          "Provider and internal refund amounts differ.",
          fact.currency,
        ),
      );
    }
  }
  for (const refund of refunds) {
    if (refund.status !== "SUCCEEDED" || refund.providerRefundRef === null) {
      continue;
    }
    const fact = processed.find(
      (row) => row.providerRefundRef === refund.providerRefundRef,
    );
    if (fact === undefined) {
      found.push(
        draft(
          "INTERNAL_PAYMENT_MISSING_PROVIDER",
          refund.providerRefundRef,
          refund.amountMinor,
          null,
          "A succeeded internal refund is missing from the provider report.",
          refund.currency,
        ),
      );
    }
  }
}

function comparePayouts(
  payouts: readonly PayoutRecord[],
  report: ProviderReport,
  found: ExceptionDraft[],
): void {
  const seen = new Set<string>();
  for (const fact of report.payouts) {
    if (seen.has(fact.providerPayoutRef)) {
      found.push(
        draft(
          "DUPLICATE_PAYOUT",
          fact.providerPayoutRef,
          fact.amountMinor,
          fact.amountMinor,
          "The provider report repeats a payout.",
          fact.currency,
        ),
      );
      continue;
    }
    seen.add(fact.providerPayoutRef);
    const internal = payouts.find(
      (row) => row.providerPayoutRef === fact.providerPayoutRef,
    );
    if (
      internal === undefined ||
      internal.amountMinor !== fact.amountMinor ||
      internal.currency !== fact.currency
    ) {
      found.push(
        draft(
          "PAYOUT_MISMATCH",
          fact.providerPayoutRef,
          fact.amountMinor,
          internal?.amountMinor ?? null,
          "A provider payout does not match an internal payout record.",
          fact.currency,
        ),
      );
    }
  }
  for (const payout of payouts) {
    if (
      (payout.status !== "SUBMITTED" && payout.status !== "SETTLED") ||
      payout.providerPayoutRef === null
    ) {
      continue;
    }
    const fact = report.payouts.find(
      (row) => row.providerPayoutRef === payout.providerPayoutRef,
    );
    if (fact === undefined) {
      found.push(
        draft(
          "PAYOUT_MISMATCH",
          payout.providerPayoutRef,
          payout.amountMinor,
          null,
          "A submitted payout is missing from the provider report.",
          payout.currency,
        ),
      );
    }
  }
}

function draft(
  kind: ReconciliationKind,
  resourceRef: string,
  expectedMinor: number | null,
  actualMinor: number | null,
  detail: string,
  currency: string | null = null,
): ExceptionDraft {
  return {
    kind,
    resourceRef,
    currency,
    expectedMinor,
    actualMinor,
    detail,
  };
}

export function exceptionView(row: ExceptionRecord) {
  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    resourceRef: row.resourceRef,
    currency: row.currency,
    expectedMinor: row.expectedMinor,
    actualMinor: row.actualMinor,
    detail: row.detail,
    createdAt: row.createdAt,
  };
}
