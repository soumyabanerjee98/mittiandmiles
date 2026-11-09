/**
 * Provider and legal questions that must be confirmed before a real
 * marketplace settlement path. This list does not answer them.
 * The sandbox adapter does not hold funds or delay settlement.
 */
export const UNCONFIRMED_PROVIDER_CAPABILITIES = [
  "marketplace eligibility",
  "host onboarding and KYC",
  "collection, split, and settlement mechanics",
  "whether delayed or conditional settlement is supported",
  "refund, chargeback, and reserve handling",
  "international card acceptance",
  "tax reports and reconciliation exports",
  "contractual responsibilities and applicable regulatory requirements",
] as const;

/** No settlement timing is approved. Responses repeat this marker. */
export const SETTLEMENT_MODEL = "unconfirmed" as const;
