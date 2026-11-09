export type ProviderOrder = {
  providerOrderRef: string;
  keyId: string;
};

export type ProviderPaymentFact = {
  providerOrderRef: string;
  providerPaymentRef: string | null;
  status: "pending" | "captured" | "failed";
  amountMinor: number;
  currency: string;
};

export type ProviderRefundFact = {
  providerRefundRef: string;
  providerPaymentRef: string;
  status: "pending" | "processed" | "failed";
  amountMinor: number;
  currency: string;
};

export type ProviderPayoutFact = {
  providerPayoutRef: string;
  amountMinor: number;
  currency: string;
  status: string;
};

export type ProviderReport = {
  payments: ProviderPaymentFact[];
  refunds: ProviderRefundFact[];
  payouts: ProviderPayoutFact[];
};

export type ProviderPaymentEvent = {
  id: string;
  type: "payment.captured" | "payment.failed";
  orderId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
};

export type ProviderRefundEvent = {
  id: string;
  type: "refund.processed" | "refund.failed";
  refundId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
};

export type ProviderEvent = ProviderPaymentEvent | ProviderRefundEvent;

export type PaymentProvider = {
  readonly name: string;
  readonly configured: boolean;
  readonly publicKeyId: string | null;
  createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    idempotencyKey: string;
  }): Promise<ProviderOrder>;
  fetchPayment(providerOrderRef: string): Promise<ProviderPaymentFact | null>;
  createRefund(input: {
    providerPaymentRef: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ providerRefundRef: string }>;
  fetchRefund(providerRefundRef: string): Promise<ProviderRefundFact | null>;
  report(): Promise<ProviderReport>;
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean;
  parseWebhook(rawBody: Buffer): ProviderEvent | null;
};
