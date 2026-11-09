import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  PaymentProvider,
  ProviderEvent,
  ProviderOrder,
  ProviderPaymentFact,
  ProviderPayoutFact,
  ProviderRefundFact,
  ProviderReport,
} from "./provider.js";

const API_ROOT = "https://api.razorpay.com/v1";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int().nonnegative();
const ref = z.string().min(1).max(128);

const paymentEntitySchema = z.looseObject({
  id: ref,
  order_id: ref.nullable().optional(),
  amount: minor,
  currency,
  status: z.string(),
});

const refundEntitySchema = z.looseObject({
  id: ref,
  payment_id: ref,
  amount: z.number().int().positive(),
  currency,
  status: z.string(),
});

const payoutEntitySchema = z.looseObject({
  id: ref,
  amount: minor,
  currency,
  status: z.string(),
});

const webhookSchema = z.looseObject({
  event: z.string(),
  payload: z
    .looseObject({
      payment: z.looseObject({ entity: paymentEntitySchema }).optional(),
      refund: z.looseObject({ entity: refundEntitySchema }).optional(),
      payout: z.looseObject({ entity: payoutEntitySchema }).optional(),
    })
    .optional(),
});

export class PayoutAccountUnconfiguredError extends Error {
  constructor() {
    super("RazorpayX account number is not configured.");
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Razorpay Orders, payments, and refunds.
 * Standard checkout only. This does not use Razorpay Route, hold funds,
 * or decide payout timing.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly configured = true;
  readonly signatureHeader = "x-razorpay-signature";
  readonly eventIdHeader = "x-razorpay-event-id";
  readonly publicKeyId: string;
  private readonly fetchImpl: FetchLike;

  private readonly accountNumber: string | null;

  constructor(
    private readonly secrets: {
      keyId: string;
      keySecret: string;
      webhookSecret: string;
      accountNumber?: string | null;
    },
    fetchImpl: FetchLike = fetch,
  ) {
    this.publicKeyId = secrets.keyId;
    this.accountNumber = secrets.accountNumber ?? null;
    this.fetchImpl = fetchImpl;
  }

  async createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    idempotencyKey: string;
  }): Promise<ProviderOrder> {
    const body = await this.request("POST", "/orders", {
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: { idempotency_key: input.idempotencyKey.slice(0, 256) },
    });
    const parsed = z
      .looseObject({ id: ref, amount: minor, currency })
      .safeParse(body);
    if (!parsed.success || parsed.data.amount !== input.amountMinor) {
      throw new Error("Razorpay order response did not match the request.");
    }
    return { providerOrderRef: parsed.data.id, keyId: this.publicKeyId };
  }

  async fetchPayment(
    providerOrderRef: string,
  ): Promise<ProviderPaymentFact | null> {
    const orderBody = await this.request(
      "GET",
      `/orders/${encodeURIComponent(providerOrderRef)}`,
    );
    const order = z
      .looseObject({ id: ref, amount: minor, currency, status: z.string() })
      .safeParse(orderBody);
    if (!order.success) {
      return null;
    }
    const paymentsBody = await this.request(
      "GET",
      `/orders/${encodeURIComponent(providerOrderRef)}/payments`,
    );
    const payments = z
      .looseObject({ items: z.array(paymentEntitySchema).optional() })
      .safeParse(paymentsBody);
    const items = payments.success ? (payments.data.items ?? []) : [];
    const chosen = pickPayment(items);
    if (chosen === undefined) {
      return {
        providerOrderRef: order.data.id,
        providerPaymentRef: null,
        status: "pending",
        amountMinor: order.data.amount,
        currency: order.data.currency,
      };
    }
    return {
      providerOrderRef: order.data.id,
      providerPaymentRef: chosen.id,
      status: paymentStatus(chosen.status),
      amountMinor: chosen.amount,
      currency: chosen.currency,
    };
  }

  async createRefund(input: {
    providerPaymentRef: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ providerRefundRef: string }> {
    const body = await this.request(
      "POST",
      `/payments/${encodeURIComponent(input.providerPaymentRef)}/refund`,
      {
        amount: input.amountMinor,
        notes: { idempotency_key: input.idempotencyKey.slice(0, 256) },
      },
    );
    const parsed = refundEntitySchema.safeParse(body);
    if (
      !parsed.success ||
      parsed.data.amount !== input.amountMinor ||
      parsed.data.currency !== input.currency
    ) {
      throw new Error("Razorpay refund response did not match the request.");
    }
    return { providerRefundRef: parsed.data.id };
  }

  async fetchRefund(
    providerRefundRef: string,
  ): Promise<ProviderRefundFact | null> {
    const body = await this.request(
      "GET",
      `/refunds/${encodeURIComponent(providerRefundRef)}`,
    );
    const parsed = refundEntitySchema.safeParse(body);
    if (!parsed.success) {
      return null;
    }
    return {
      providerRefundRef: parsed.data.id,
      providerPaymentRef: parsed.data.payment_id,
      status: refundStatus(parsed.data.status),
      amountMinor: parsed.data.amount,
      currency: parsed.data.currency,
    };
  }

  async createPayout(input: {
    fundAccountId: string;
    amountMinor: number;
    currency: string;
    mode: "NEFT" | "IMPS" | "RTGS" | "UPI";
    idempotencyKey: string;
    referenceId: string;
  }): Promise<ProviderPayoutFact> {
    if (this.accountNumber === null) {
      throw new PayoutAccountUnconfiguredError();
    }
    const body = await this.request(
      "POST",
      "/payouts",
      {
        account_number: this.accountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amountMinor,
        currency: input.currency,
        mode: input.mode,
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: input.referenceId.slice(0, 40),
        narration: "Host payout",
      },
      { "x-payout-idempotency": input.idempotencyKey.slice(0, 36) },
    );
    const parsed = payoutEntitySchema.safeParse(body);
    if (!parsed.success || parsed.data.amount !== input.amountMinor) {
      throw new Error("Razorpay payout response did not match the request.");
    }
    return {
      providerPayoutRef: parsed.data.id,
      amountMinor: parsed.data.amount,
      currency: parsed.data.currency,
      status: payoutState(parsed.data.status),
    };
  }

  async fetchPayout(
    providerPayoutRef: string,
  ): Promise<ProviderPayoutFact | null> {
    const body = await this.request(
      "GET",
      `/payouts/${encodeURIComponent(providerPayoutRef)}`,
    );
    const parsed = payoutEntitySchema.safeParse(body);
    if (!parsed.success) {
      return null;
    }
    return {
      providerPayoutRef: parsed.data.id,
      amountMinor: parsed.data.amount,
      currency: parsed.data.currency,
      status: payoutState(parsed.data.status),
    };
  }

  async report(): Promise<ProviderReport> {
    const payments = await this.eachPage("/payments", paymentEntitySchema);
    const refunds = await this.eachPage("/refunds", refundEntitySchema);
    const payouts =
      this.accountNumber === null
        ? []
        : await this.eachPage(
            `/payouts?account_number=${encodeURIComponent(this.accountNumber)}`,
            payoutEntitySchema,
          );
    return {
      payments: payments.flatMap((item) => {
        if (item.order_id === null || item.order_id === undefined) {
          return [];
        }
        return [
          {
            providerOrderRef: item.order_id,
            providerPaymentRef: item.id,
            status: paymentStatus(item.status),
            amountMinor: item.amount,
            currency: item.currency,
          },
        ];
      }),
      refunds: refunds.map((item) => ({
        providerRefundRef: item.id,
        providerPaymentRef: item.payment_id,
        status: refundStatus(item.status),
        amountMinor: item.amount,
        currency: item.currency,
      })),
      payouts: payouts.map((item) => ({
        providerPayoutRef: item.id,
        amountMinor: item.amount,
        currency: item.currency,
        status: payoutState(item.status),
      })),
    };
  }

  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (signatureHeader === undefined) {
      return false;
    }
    const received = decodeHex(signatureHeader.trim());
    const expected = Buffer.from(
      createHmac("sha256", this.secrets.webhookSecret)
        .update(rawBody)
        .digest("hex"),
      "hex",
    );
    if (received === null || received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(received, expected);
  }

  parseWebhook(
    rawBody: Buffer,
    eventId: string | undefined,
  ): ProviderEvent | null {
    const parsed = readWebhook(rawBody, eventId);
    if (parsed === null || eventId === undefined) {
      return null;
    }
    const payment = parsed.payload?.payment?.entity;
    const refund = parsed.payload?.refund?.entity;
    const payout = parsed.payload?.payout?.entity;
    if (
      parsed.event === "payment.captured" ||
      parsed.event === "payment.failed" ||
      parsed.event === "order.paid"
    ) {
      if (payment === undefined || payment.order_id == null) {
        return null;
      }
      return {
        id: eventId,
        type:
          parsed.event === "payment.failed"
            ? "payment.failed"
            : "payment.captured",
        orderId: payment.order_id,
        paymentId: payment.id,
        amountMinor: payment.amount,
        currency: payment.currency,
      };
    }
    if (
      parsed.event === "payout.processed" ||
      parsed.event === "payout.failed" ||
      parsed.event === "payout.reversed" ||
      parsed.event === "payout.rejected"
    ) {
      if (payout === undefined) {
        return null;
      }
      return {
        id: eventId,
        type:
          parsed.event === "payout.processed"
            ? "payout.processed"
            : "payout.failed",
        payoutId: payout.id,
        amountMinor: payout.amount,
        currency: payout.currency,
      };
    }
    if (
      parsed.event === "refund.processed" ||
      parsed.event === "refund.failed"
    ) {
      if (refund === undefined) {
        return null;
      }
      return {
        id: eventId,
        type:
          parsed.event === "refund.failed"
            ? "refund.failed"
            : "refund.processed",
        refundId: refund.id,
        paymentId: refund.payment_id,
        amountMinor: refund.amount,
        currency: refund.currency,
      };
    }
    return null;
  }

  ignoreWebhook(rawBody: Buffer, eventId: string | undefined): boolean {
    const parsed = readWebhook(rawBody, eventId);
    if (parsed === null) {
      return false;
    }
    return !APPLIED_EVENTS.has(parsed.event);
  }

  private async eachPage<T>(
    path: string,
    itemSchema: z.ZodType<T>,
  ): Promise<T[]> {
    const items: T[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const join = path.includes("?") ? "&" : "?";
      const body = await this.request(
        "GET",
        `${path}${join}count=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`,
      );
      const parsed = z
        .looseObject({ items: z.array(itemSchema).optional() })
        .safeParse(body);
      const batch = parsed.success ? (parsed.data.items ?? []) : [];
      items.push(...batch);
      if (batch.length < PAGE_SIZE) {
        return items;
      }
    }
    throw new Error("Razorpay report exceeded the page limit.");
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    jsonBody?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown> {
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`${this.secrets.keyId}:${this.secrets.keySecret}`).toString("base64")}`,
        accept: "application/json",
        ...(extraHeaders ?? {}),
        ...(jsonBody === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      ...(jsonBody === undefined ? {} : { body: JSON.stringify(jsonBody) }),
    };
    const response = await this.fetchImpl(`${API_ROOT}${path}`, init);
    if (!response.ok) {
      throw new Error(`Razorpay request failed (${response.status}).`);
    }
    return await response.json();
  }
}

const APPLIED_EVENTS = new Set([
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.processed",
  "refund.failed",
  "payout.processed",
  "payout.failed",
  "payout.reversed",
  "payout.rejected",
]);

function readWebhook(
  rawBody: Buffer,
  eventId: string | undefined,
): z.infer<typeof webhookSchema> | null {
  if (eventId === undefined || !/^[\w-]{1,128}$/.test(eventId)) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    return null;
  }
  const parsed = webhookSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function pickPayment(
  items: readonly z.infer<typeof paymentEntitySchema>[],
): z.infer<typeof paymentEntitySchema> | undefined {
  const captured = items.find(
    (item) => paymentStatus(item.status) === "captured",
  );
  if (captured !== undefined) {
    return captured;
  }
  const failed = items.find((item) => paymentStatus(item.status) === "failed");
  return failed ?? items[0];
}

function payoutState(status: string): ProviderPayoutFact["status"] {
  if (status === "processed") {
    return "processed";
  }
  if (
    status === "failed" ||
    status === "rejected" ||
    status === "reversed" ||
    status === "cancelled"
  ) {
    return "failed";
  }
  return "pending";
}

function paymentStatus(status: string): ProviderPaymentFact["status"] {
  if (status === "captured" || status === "refunded") {
    return "captured";
  }
  if (status === "failed") {
    return "failed";
  }
  return "pending";
}

function refundStatus(status: string): ProviderRefundFact["status"] {
  if (status === "processed") {
    return "processed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "pending";
}

function decodeHex(value: string): Buffer | null {
  if (
    value.length === 0 ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(value)
  ) {
    return null;
  }
  return Buffer.from(value, "hex");
}
