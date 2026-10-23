/**
 * The listing base price and the offer price are booking totals.
 * Party size reserves seats and does not multiply the price.
 * Per-person pricing is not configured.
 * Discount and tax stay zero until those rules are confirmed.
 * A missing commission policy snapshots zero. That is not a chosen rate.
 */
export type PricingBasis = "LISTED_TOTAL" | "OFFER_TOTAL";

export type CommissionPolicy = {
  id: string;
  version: string;
  rateBps: number;
};

export type PriceQuote = {
  pricingBasis: PricingBasis;
  subtotalMinor: number;
  discountMinor: 0;
  taxMinor: 0;
  totalMinor: number;
  commissionPolicyId: string | null;
  commissionVersion: string | null;
  commissionMinor: number;
  hostGrossMinor: number;
};

export function quoteTotal(
  subtotalMinor: number,
  pricingBasis: PricingBasis,
  policy: CommissionPolicy | null,
): PriceQuote {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new Error("Subtotal must be a non-negative integer of minor units.");
  }
  const commissionMinor =
    policy === null ? 0 : commissionFromPolicy(subtotalMinor, policy.rateBps);
  return {
    pricingBasis,
    subtotalMinor,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: subtotalMinor,
    commissionPolicyId: policy === null ? null : policy.id,
    commissionVersion: policy === null ? null : policy.version,
    commissionMinor,
    hostGrossMinor: subtotalMinor - commissionMinor,
  };
}

function commissionFromPolicy(amount: number, rateBps: number): number {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new Error("Commission rate must be an integer from 0 to 10000.");
  }
  return Math.floor((amount * rateBps) / 10_000);
}
