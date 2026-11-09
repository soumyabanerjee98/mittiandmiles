import type { LedgerLine } from "./types.js";

export function captureLines(input: {
  currency: string;
  totalMinor: number;
  hostGrossMinor: number;
  commissionMinor: number;
}): LedgerLine[] {
  if (input.hostGrossMinor + input.commissionMinor !== input.totalMinor) {
    throw new Error("Capture lines do not match the booking total.");
  }
  const lines: LedgerLine[] = [
    line("provider_clearing", "ASSET", input.currency, input.totalMinor, 0),
  ];
  if (input.hostGrossMinor > 0) {
    lines.push(
      line(
        "host_payable",
        "LIABILITY",
        input.currency,
        0,
        input.hostGrossMinor,
      ),
    );
  }
  if (input.commissionMinor > 0) {
    lines.push(
      line(
        "commission_revenue",
        "REVENUE",
        input.currency,
        0,
        input.commissionMinor,
      ),
    );
  }
  assertBalanced(lines);
  return lines;
}

export function refundLines(input: {
  currency: string;
  refundMinor: number;
  hostMinor: number;
  commissionMinor: number;
}): LedgerLine[] {
  if (input.hostMinor + input.commissionMinor !== input.refundMinor) {
    throw new Error("Refund lines do not match the refund amount.");
  }
  const lines: LedgerLine[] = [];
  if (input.hostMinor > 0) {
    lines.push(
      line("host_payable", "LIABILITY", input.currency, input.hostMinor, 0),
    );
  }
  if (input.commissionMinor > 0) {
    lines.push(
      line(
        "commission_revenue",
        "REVENUE",
        input.currency,
        input.commissionMinor,
        0,
      ),
    );
  }
  lines.push(
    line("provider_clearing", "ASSET", input.currency, 0, input.refundMinor),
  );
  assertBalanced(lines);
  return lines;
}

/**
 * Split a refund across the snapshotted host and commission amounts.
 * Earlier refunds consume those amounts and are not rewritten.
 */
export function refundSplit(input: {
  refundMinor: number;
  totalMinor: number;
  hostGrossMinor: number;
  commissionMinor: number;
  hostAlreadyMinor: number;
  commissionAlreadyMinor: number;
}): { hostMinor: number; commissionMinor: number } {
  const hostRemaining = input.hostGrossMinor - input.hostAlreadyMinor;
  const commissionRemaining =
    input.commissionMinor - input.commissionAlreadyMinor;
  if (
    input.totalMinor <= 0 ||
    hostRemaining < 0 ||
    commissionRemaining < 0 ||
    input.refundMinor > hostRemaining + commissionRemaining
  ) {
    throw new Error("Refund split exceeds the remaining booking amounts.");
  }
  let hostMinor = Math.floor(
    (input.refundMinor * input.hostGrossMinor) / input.totalMinor,
  );
  if (hostMinor > hostRemaining) {
    hostMinor = hostRemaining;
  }
  let commissionMinor = input.refundMinor - hostMinor;
  if (commissionMinor > commissionRemaining) {
    commissionMinor = commissionRemaining;
    hostMinor = input.refundMinor - commissionMinor;
  }
  if (hostMinor > hostRemaining || hostMinor < 0 || commissionMinor < 0) {
    throw new Error("Refund split exceeds the remaining booking amounts.");
  }
  return { hostMinor, commissionMinor };
}

export function assertBalanced(lines: readonly LedgerLine[]): void {
  let debit = 0;
  let credit = 0;
  for (const entry of lines) {
    if (
      entry.debitMinor < 0 ||
      entry.creditMinor < 0 ||
      (entry.debitMinor > 0 && entry.creditMinor > 0) ||
      (entry.debitMinor === 0 && entry.creditMinor === 0)
    ) {
      throw new Error("Ledger line is not one-sided.");
    }
    debit += entry.debitMinor;
    credit += entry.creditMinor;
  }
  if (debit !== credit || lines.length < 2) {
    throw new Error("Ledger transaction is not balanced.");
  }
}

function line(
  code: string,
  accountType: LedgerLine["accountType"],
  currency: string,
  debitMinor: number,
  creditMinor: number,
): LedgerLine {
  return { code, accountType, currency, debitMinor, creditMinor };
}
