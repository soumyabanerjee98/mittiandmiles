import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { RazorpayPaymentProvider } from "../src/modules/payments/razorpay-provider.js";

const secrets = {
  keyId: "rzp_test_example",
  keySecret: "razorpay-key-secret",
  webhookSecret: "razorpay-webhook-secret",
};

test("Razorpay createOrder sends the server amount and basic auth", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = new RazorpayPaymentProvider(secrets, (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(
      Response.json({ id: "order_123", amount: 2000, currency: "INR" }),
    );
  });

  const order = await provider.createOrder({
    amountMinor: 2000,
    currency: "INR",
    receipt: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "intent-1",
  });

  assert.equal(order.providerOrderRef, "order_123");
  assert.equal(order.keyId, secrets.keyId);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.url, "https://api.razorpay.com/v1/orders");
  const headers = new Headers(call.init.headers);
  assert.equal(
    headers.get("authorization"),
    `Basic ${Buffer.from(`${secrets.keyId}:${secrets.keySecret}`).toString("base64")}`,
  );
  assert.equal(typeof call.init.body, "string");
  if (typeof call.init.body !== "string") {
    return;
  }
  assert.deepEqual(JSON.parse(call.init.body), {
    amount: 2000,
    currency: "INR",
    receipt: "11111111-1111-4111-8111-111111111111",
    notes: { idempotency_key: "intent-1" },
  });
});

test("Razorpay fetchPayment prefers a captured payment", async () => {
  const provider = new RazorpayPaymentProvider(secrets, (url) => {
    if (url.endsWith("/payments")) {
      return Promise.resolve(
        Response.json({
          items: [
            {
              id: "pay_pending",
              order_id: "order_123",
              amount: 2000,
              currency: "INR",
              status: "authorized",
            },
            {
              id: "pay_done",
              order_id: "order_123",
              amount: 2000,
              currency: "INR",
              status: "captured",
            },
          ],
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        id: "order_123",
        amount: 2000,
        currency: "INR",
        status: "paid",
      }),
    );
  });

  const fact = await provider.fetchPayment("order_123");
  assert.deepEqual(fact, {
    providerOrderRef: "order_123",
    providerPaymentRef: "pay_done",
    status: "captured",
    amountMinor: 2000,
    currency: "INR",
  });
});

test("Razorpay webhook uses the raw body and event id header", () => {
  const provider = new RazorpayPaymentProvider(secrets, () => {
    return Promise.reject(new Error("webhook parsing must not call Razorpay"));
  });
  const raw = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_done",
            order_id: "order_123",
            amount: 2000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    }),
  );
  const signature = createHmac("sha256", secrets.webhookSecret)
    .update(raw)
    .digest("hex");

  assert.equal(provider.verifyWebhook(raw, signature), true);
  assert.equal(provider.verifyWebhook(raw, "00"), false);
  assert.deepEqual(provider.parseWebhook(raw, "evt_1"), {
    id: "evt_1",
    type: "payment.captured",
    orderId: "order_123",
    paymentId: "pay_done",
    amountMinor: 2000,
    currency: "INR",
  });
  assert.equal(provider.parseWebhook(raw, undefined), null);
});

test("Razorpay authorized and unknown events are acknowledged without capture", () => {
  const provider = new RazorpayPaymentProvider(secrets, () => {
    return Promise.reject(new Error("unused"));
  });
  const authorized = Buffer.from(
    JSON.stringify({
      event: "payment.authorized",
      payload: {
        payment: {
          entity: {
            id: "pay_auth",
            order_id: "order_123",
            amount: 2000,
            currency: "INR",
            status: "authorized",
          },
        },
      },
    }),
  );
  assert.equal(provider.parseWebhook(authorized, "evt_auth"), null);
  assert.equal(provider.ignoreWebhook(authorized, "evt_auth"), true);

  const unknown = Buffer.from(JSON.stringify({ event: "payment.downtime" }));
  assert.equal(provider.ignoreWebhook(unknown, "evt_down"), true);
  assert.equal(provider.ignoreWebhook(unknown, undefined), false);
});

test("Razorpay createPayout uses the platform account and host fund account", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = new RazorpayPaymentProvider(
    { ...secrets, accountNumber: "2323230000000000" },
    (url, init) => {
      calls.push({ url, init });
      const path = url;
      if (path.endsWith("/payouts")) {
        return Promise.resolve(
          Response.json({
            id: "pout_1",
            amount: 1800,
            currency: "INR",
            status: "processing",
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          id: "pout_1",
          amount: 1800,
          currency: "INR",
          status: "processing",
        }),
      );
    },
  );
  const payoutId = "50000000-0000-4000-8000-000000000099";
  const fact = await provider.createPayout({
    fundAccountId: "fa_host_1",
    amountMinor: 1800,
    currency: "INR",
    mode: "NEFT",
    idempotencyKey: payoutId,
    referenceId: payoutId,
  });
  assert.equal(fact.status, "pending");
  assert.equal(fact.providerPayoutRef, "pout_1");
  const call = calls[0];
  assert.ok(call);
  const headers = new Headers(call.init.headers);
  assert.equal(headers.get("x-payout-idempotency"), payoutId);
  assert.equal(typeof call.init.body, "string");
  if (typeof call.init.body !== "string") {
    return;
  }
  assert.deepEqual(JSON.parse(call.init.body), {
    account_number: "2323230000000000",
    fund_account_id: "fa_host_1",
    amount: 1800,
    currency: "INR",
    mode: "NEFT",
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: payoutId,
    narration: "Host payout",
  });

  await assert.rejects(
    () =>
      new RazorpayPaymentProvider(secrets).createPayout({
        fundAccountId: "fa_host_1",
        amountMinor: 1800,
        currency: "INR",
        mode: "NEFT",
        idempotencyKey: payoutId,
        referenceId: payoutId,
      }),
    /RazorpayX account number is not configured/,
  );
});

test("Razorpay report fails closed when a page stays full", async () => {
  const provider = new RazorpayPaymentProvider(secrets, () =>
    Promise.resolve(
      Response.json({
        items: Array.from({ length: 100 }, (_item, index) => ({
          id: `pay_${index}`,
          order_id: "order_123",
          amount: 2000,
          currency: "INR",
          status: "captured",
        })),
      }),
    ),
  );

  await assert.rejects(
    () => provider.report(),
    /Razorpay report exceeded the page limit/,
  );
});
