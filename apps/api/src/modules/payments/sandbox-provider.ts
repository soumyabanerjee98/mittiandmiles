import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  PaymentProvider,
  ProviderEvent,
  ProviderOrder,
  ProviderPaymentFact,
  ProviderRefundFact,
  ProviderReport,
} from "./provider.js";

const currency = z.string().regex(/^[A-Z]{3}$/);
const ref = z.string().min(1).max(128);

const paymentEventSchema = z
  .object({
    id: ref,
    type: z.enum(["payment.captured", "payment.failed"]),
    data: z
      .object({
        orderId: ref,
        paymentId: ref,
        amountMinor: z.number().int().nonnegative(),
        currency,
      })
      .strict(),
  })
  .strict();

const refundEventSchema = z
  .object({
    id: ref,
    type: z.enum(["refund.processed", "refund.failed"]),
    data: z
      .object({
        refundId: ref,
        paymentId: ref,
        amountMinor: z.number().int().positive(),
        currency,
      })
      .strict(),
  })
  .strict();

type SandboxOrder = {
  providerOrderRef: string;
  amountMinor: number;
  currency: string;
  receipt: string;
  idempotencyKey: string;
  seal: string;
  payment: ProviderPaymentFact | null;
};

type SandboxRefund = {
  providerRefundRef: string;
  providerPaymentRef: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  status: "pending" | "processed" | "failed";
};

export type SignedWebhook = {
  raw: Buffer;
  signature: string;
};

/**
 * In-process sandbox. Capture exists only after recordCapture, which is
 * not an HTTP route. Webhook signatures use the webhook secret.
 * The key secret seals orders and is never returned.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";
  readonly configured = true;
  readonly publicKeyId: string;
  private readonly orders = new Map<string, SandboxOrder>();
  private readonly ordersByKey = new Map<string, SandboxOrder>();
  private readonly refunds = new Map<string, SandboxRefund>();
  private readonly refundsByKey = new Map<string, SandboxRefund>();
  private readonly payouts: ProviderReport["payouts"] = [];

  constructor(
    private readonly secrets: {
      keyId: string;
      keySecret: string;
      webhookSecret: string;
    },
  ) {
    this.publicKeyId = secrets.keyId;
  }

  createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    idempotencyKey: string;
  }): Promise<ProviderOrder> {
    const existing = this.ordersByKey.get(input.idempotencyKey);
    if (existing !== undefined) {
      if (
        existing.amountMinor !== input.amountMinor ||
        existing.currency !== input.currency
      ) {
        return Promise.reject(new Error("Sandbox order idempotency conflict."));
      }
      return Promise.resolve({
        providerOrderRef: existing.providerOrderRef,
        keyId: this.publicKeyId,
      });
    }
    const order: SandboxOrder = {
      providerOrderRef: `ord_${randomUUID().replaceAll("-", "")}`,
      amountMinor: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      idempotencyKey: input.idempotencyKey,
      seal: this.seal(
        input.idempotencyKey,
        input.amountMinor,
        input.currency,
        input.receipt,
      ),
      payment: null,
    };
    this.orders.set(order.providerOrderRef, order);
    this.ordersByKey.set(input.idempotencyKey, order);
    return Promise.resolve({
      providerOrderRef: order.providerOrderRef,
      keyId: this.publicKeyId,
    });
  }

  fetchPayment(providerOrderRef: string): Promise<ProviderPaymentFact | null> {
    const order = this.orders.get(providerOrderRef);
    if (order === undefined || !this.sealMatches(order)) {
      return Promise.resolve(null);
    }
    if (order.payment === null) {
      return Promise.resolve({
        providerOrderRef: order.providerOrderRef,
        providerPaymentRef: null,
        status: "pending",
        amountMinor: order.amountMinor,
        currency: order.currency,
      });
    }
    return Promise.resolve({ ...order.payment });
  }

  createRefund(input: {
    providerPaymentRef: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ providerRefundRef: string }> {
    const payment = this.paymentByRef(input.providerPaymentRef);
    if (payment === null || payment.status !== "captured") {
      return Promise.reject(new Error("Sandbox payment is not captured."));
    }
    const existing = this.refundsByKey.get(input.idempotencyKey);
    if (existing !== undefined) {
      if (
        existing.amountMinor !== input.amountMinor ||
        existing.currency !== input.currency ||
        existing.providerPaymentRef !== input.providerPaymentRef
      ) {
        return Promise.reject(
          new Error("Sandbox refund idempotency conflict."),
        );
      }
      return Promise.resolve({
        providerRefundRef: existing.providerRefundRef,
      });
    }
    const refund: SandboxRefund = {
      providerRefundRef: `rfnd_${randomUUID().replaceAll("-", "")}`,
      providerPaymentRef: input.providerPaymentRef,
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
    };
    this.refunds.set(refund.providerRefundRef, refund);
    this.refundsByKey.set(input.idempotencyKey, refund);
    return Promise.resolve({ providerRefundRef: refund.providerRefundRef });
  }

  fetchRefund(providerRefundRef: string): Promise<ProviderRefundFact | null> {
    const refund = this.refunds.get(providerRefundRef);
    if (refund === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      providerRefundRef: refund.providerRefundRef,
      providerPaymentRef: refund.providerPaymentRef,
      status: refund.status,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
    });
  }

  report(): Promise<ProviderReport> {
    const payments: ProviderPaymentFact[] = [];
    for (const order of this.orders.values()) {
      if (!this.sealMatches(order)) {
        continue;
      }
      payments.push(
        order.payment ?? {
          providerOrderRef: order.providerOrderRef,
          providerPaymentRef: null,
          status: "pending",
          amountMinor: order.amountMinor,
          currency: order.currency,
        },
      );
    }
    const refunds: ProviderRefundFact[] = [...this.refunds.values()].map(
      (refund) => ({
        providerRefundRef: refund.providerRefundRef,
        providerPaymentRef: refund.providerPaymentRef,
        status: refund.status,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
      }),
    );
    return Promise.resolve({
      payments,
      refunds,
      payouts: this.payouts.map((row) => ({ ...row })),
    });
  }

  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (signatureHeader === undefined) {
      return false;
    }
    const received = decodeHex(signatureHeader.trim());
    const expected = Buffer.from(this.signature(rawBody), "hex");
    if (received === null || received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(received, expected);
  }

  parseWebhook(rawBody: Buffer): ProviderEvent | null {
    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8")) as unknown;
    } catch {
      return null;
    }
    const payment = paymentEventSchema.safeParse(json);
    if (payment.success) {
      return {
        id: payment.data.id,
        type: payment.data.type,
        orderId: payment.data.data.orderId,
        paymentId: payment.data.data.paymentId,
        amountMinor: payment.data.data.amountMinor,
        currency: payment.data.data.currency,
      };
    }
    const refund = refundEventSchema.safeParse(json);
    if (refund.success) {
      return {
        id: refund.data.id,
        type: refund.data.type,
        refundId: refund.data.data.refundId,
        paymentId: refund.data.data.paymentId,
        amountMinor: refund.data.data.amountMinor,
        currency: refund.data.data.currency,
      };
    }
    return null;
  }

  recordCapture(orderRef: string, providerPaymentRef: string): void {
    const order = this.requireOrder(orderRef);
    order.payment = {
      providerOrderRef: order.providerOrderRef,
      providerPaymentRef,
      status: "captured",
      amountMinor: order.amountMinor,
      currency: order.currency,
    };
  }

  recordFailure(orderRef: string, providerPaymentRef: string): void {
    const order = this.requireOrder(orderRef);
    order.payment = {
      providerOrderRef: order.providerOrderRef,
      providerPaymentRef,
      status: "failed",
      amountMinor: order.amountMinor,
      currency: order.currency,
    };
  }

  recordRefundResult(
    providerRefundRef: string,
    status: "processed" | "failed",
  ): void {
    const refund = this.refunds.get(providerRefundRef);
    if (refund === undefined) {
      throw new Error("Unknown sandbox refund.");
    }
    refund.status = status;
  }

  notePayout(input: ProviderReport["payouts"][number]): void {
    this.payouts.push({ ...input });
  }

  paymentEvent(input: {
    id: string;
    orderRef: string;
    type: "payment.captured" | "payment.failed";
    amountMinor?: number;
    currency?: string;
  }): SignedWebhook {
    const order = this.requireOrder(input.orderRef);
    return this.sign({
      id: input.id,
      type: input.type,
      data: {
        orderId: order.providerOrderRef,
        paymentId: order.payment?.providerPaymentRef ?? "missing",
        amountMinor: input.amountMinor ?? order.amountMinor,
        currency: input.currency ?? order.currency,
      },
    });
  }

  refundEvent(input: {
    id: string;
    refundRef: string;
    type: "refund.processed" | "refund.failed";
    amountMinor?: number;
    currency?: string;
  }): SignedWebhook {
    const refund = this.refunds.get(input.refundRef);
    if (refund === undefined) {
      throw new Error("Unknown sandbox refund.");
    }
    return this.sign({
      id: input.id,
      type: input.type,
      data: {
        refundId: refund.providerRefundRef,
        paymentId: refund.providerPaymentRef,
        amountMinor: input.amountMinor ?? refund.amountMinor,
        currency: input.currency ?? refund.currency,
      },
    });
  }

  refundCount(): number {
    return this.refunds.size;
  }

  private sign(body: unknown): SignedWebhook {
    const raw = Buffer.from(JSON.stringify(body));
    return { raw, signature: this.signature(raw) };
  }

  private signature(raw: Buffer): string {
    return createHmac("sha256", this.secrets.webhookSecret)
      .update(raw)
      .digest("hex");
  }

  private seal(
    idempotencyKey: string,
    amountMinor: number,
    orderCurrency: string,
    receipt: string,
  ): string {
    return createHmac("sha256", this.secrets.keySecret)
      .update(`${idempotencyKey}:${amountMinor}:${orderCurrency}:${receipt}`)
      .digest("hex");
  }

  private sealMatches(order: SandboxOrder): boolean {
    const expected = this.seal(
      order.idempotencyKey,
      order.amountMinor,
      order.currency,
      order.receipt,
    );
    const left = Buffer.from(expected, "hex");
    const right = Buffer.from(order.seal, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private requireOrder(orderRef: string): SandboxOrder {
    const order = this.orders.get(orderRef);
    if (order === undefined) {
      throw new Error("Unknown sandbox order.");
    }
    return order;
  }

  private paymentByRef(providerPaymentRef: string): ProviderPaymentFact | null {
    for (const order of this.orders.values()) {
      if (order.payment?.providerPaymentRef === providerPaymentRef) {
        return order.payment;
      }
    }
    return null;
  }
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = "unconfigured";
  readonly configured = false;
  readonly publicKeyId = null;

  createOrder(): Promise<ProviderOrder> {
    return Promise.reject(new Error("Payment provider is not configured."));
  }

  fetchPayment(): Promise<ProviderPaymentFact | null> {
    return Promise.resolve(null);
  }

  createRefund(): Promise<{ providerRefundRef: string }> {
    return Promise.reject(new Error("Payment provider is not configured."));
  }

  fetchRefund(): Promise<ProviderRefundFact | null> {
    return Promise.resolve(null);
  }

  report(): Promise<ProviderReport> {
    return Promise.resolve({ payments: [], refunds: [], payouts: [] });
  }

  verifyWebhook(): boolean {
    return false;
  }

  parseWebhook(): ProviderEvent | null {
    return null;
  }
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
