import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryAuditWriter } from "../src/modules/audit/memory-audit-writer.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";
import { captureLines, refundSplit } from "../src/modules/payments/ledger.js";
import { MemoryPaymentStore } from "../src/modules/payments/memory-store.js";
import { findDiscrepancies } from "../src/modules/payments/reconcile.js";
import { SandboxPaymentProvider } from "../src/modules/payments/sandbox-provider.js";
import { UnconfiguredPaymentProvider } from "../src/modules/payments/sandbox-provider.js";
import { PaymentService } from "../src/modules/payments/service.js";
import type { PaymentBooking } from "../src/modules/payments/types.js";
import { MemoryUserRepository } from "../src/modules/users/memory-user-repository.js";
import type { UserRecord } from "../src/modules/users/user-repository.js";
import { createLogger } from "../src/shared/logger.js";

const travellerId = "11111111-1111-4111-8111-111111111111";
const otherId = "11111111-1111-4111-8111-111111111112";
const hostUserId = "22222222-2222-4222-8222-222222222222";
const hostId = "22222222-2222-4222-8222-222222222223";
const financeId = "33333333-3333-4333-8333-333333333333";
const bookingId = "50000000-0000-4000-8000-000000000001";
const refreshId = "50000000-0000-4000-8000-000000000002";
const completedId = "50000000-0000-4000-8000-000000000003";
const disputedId = "50000000-0000-4000-8000-000000000004";
const failedId = "50000000-0000-4000-8000-000000000005";
const heldId = "50000000-0000-4000-8000-000000000006";
const webhookSecret = "sandbox-webhook-secret";

const users: UserRecord[] = [
  user(travellerId, "dev-traveller", "TRAVELLER"),
  user(otherId, "dev-other", "TRAVELLER"),
  user(hostUserId, "dev-host", "HOST"),
  user(financeId, "dev-finance", "FINANCE"),
];

function user(
  id: string,
  subject: string,
  role: UserRecord["roles"][number]["role"],
): UserRecord {
  return {
    id,
    email: `${subject}@example.com`,
    authProvider: "development",
    authSubject: subject,
    accountStatus: "ACTIVE",
    locale: "en",
    roles: [{ role, scope: "" }],
  };
}

function token(subject: string): string {
  return `Bearer dev:development:${subject}`;
}

function booking(id: string, status: PaymentBooking["status"]): PaymentBooking {
  return {
    id,
    travellerId,
    hostId,
    hostUserId,
    hostVerificationStatus: "VERIFIED",
    status,
    currency: "INR",
    totalMinor: 2000,
    commissionMinor: 200,
    hostGrossMinor: 1800,
  };
}

function harness() {
  const store = new MemoryPaymentStore();
  store.seedBooking(booking(bookingId, "AWAITING_PAYMENT"), true);
  store.seedBooking(booking(refreshId, "AWAITING_PAYMENT"), true);
  store.seedBooking(booking(completedId, "COMPLETED"));
  store.seedBooking(booking(disputedId, "DISPUTED"));
  store.seedBooking(booking(heldId, "COMPLETED"));
  store.seedBooking(booking(failedId, "AWAITING_PAYMENT"), true);
  const captured = captureLines({
    currency: "INR",
    totalMinor: 2000,
    hostGrossMinor: 1800,
    commissionMinor: 200,
  });
  for (const id of [completedId, disputedId, heldId]) {
    store.seedLedger({
      id: randomUUID(),
      transactionType: "BOOKING_CHARGE",
      bookingId: id,
      idempotencyKey: `capture:${id}`,
      currency: "INR",
      createdAt: "2030-01-01T00:00:00.000Z",
      lines: captured,
    });
    store.seedAttempt({
      id: randomUUID(),
      bookingId: id,
      provider: "sandbox",
      providerOrderRef: `ord_${id}`,
      providerPaymentRef: `pay_${id}`,
      amountMinor: 2000,
      currency: "INR",
      status: "SUCCEEDED",
      idempotencyKey: `paid-${id}`,
      createdAt: "2030-01-01T00:00:00.000Z",
    });
  }
  const sandbox = new SandboxPaymentProvider({
    keyId: "sandbox-key",
    keySecret: "sandbox-key-secret-value",
    webhookSecret,
  });
  const audit = new MemoryAuditWriter();
  const payments = new PaymentService(store, sandbox);
  const app = createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode: "development", jwt: null }),
    users: new MemoryUserRepository(users),
    audit,
    auth: null,
    payments,
  });
  return { app, store, sandbox, audit };
}

test("capture lines balance and a refund split stays inside the snapshot", () => {
  const lines = captureLines({
    currency: "INR",
    totalMinor: 2000,
    hostGrossMinor: 1800,
    commissionMinor: 200,
  });
  const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0);
  const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0);
  assert.equal(debit, credit);
  assert.deepEqual(
    refundSplit({
      refundMinor: 500,
      totalMinor: 2000,
      hostGrossMinor: 1800,
      commissionMinor: 200,
      hostAlreadyMinor: 0,
      commissionAlreadyMinor: 0,
    }),
    { hostMinor: 450, commissionMinor: 50 },
  );
});

test("reconciliation reports a mismatch and does not describe a correction", () => {
  const found = findDiscrepancies({
    providerName: "sandbox",
    attempts: [],
    refunds: [],
    payouts: [],
    report: {
      payments: [
        {
          providerOrderRef: "ord_missing",
          providerPaymentRef: "pay_missing",
          status: "captured",
          amountMinor: 2000,
          currency: "INR",
        },
      ],
      refunds: [],
      payouts: [
        {
          providerPayoutRef: "po_missing",
          amountMinor: 100,
          currency: "INR",
          status: "settled",
        },
      ],
    },
    ledgerDebitMinor: 1,
    ledgerCreditMinor: 2,
  });
  assert.equal(
    found.some((row) => row.kind === "PROVIDER_PAYMENT_MISSING_INTERNAL"),
    true,
  );
  assert.equal(
    found.some((row) => row.kind === "PAYOUT_MISMATCH"),
    true,
  );
  assert.equal(
    found.some((row) => row.kind === "LEDGER_IMBALANCE"),
    true,
  );
});

test("a client payload cannot confirm payment and a forged webhook is rejected", async () => {
  const { app, store } = harness();
  const forgedBody = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .send({ status: "SUCCEEDED", amountMinor: 1 });
  assert.equal(forgedBody.status, 400);

  const callback = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-callback`)
    .set("Authorization", token("dev-traveller"))
    .send({ status: "SUCCEEDED" });
  assert.equal(callback.status, 404);

  const created = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-key-1")
    .send({});
  assert.equal(created.status, 201);
  assert.equal(text(created, "status"), "PENDING");
  assert.equal(numberValue(created, "amountMinor"), 2000);
  assert.equal(text(created, "settlement"), "unconfirmed");
  assert.equal(store.bookingStatus(bookingId), "AWAITING_PAYMENT");

  const replay = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-key-1")
    .send({});
  assert.equal(replay.status, 200);
  assert.equal(text(replay, "attemptId"), text(created, "attemptId"));

  const other = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-other"))
    .set("Idempotency-Key", "intent-key-2")
    .send({});
  assert.equal(other.status, 404);

  const pending = await request(app)
    .get(`/api/v1/bookings/${bookingId}/payment-status`)
    .set("Authorization", token("dev-traveller"));
  assert.equal(pending.status, 200);
  assert.equal(text(pending, "bookingStatus"), "AWAITING_PAYMENT");
  assert.equal(stringField(child(pending, "payment"), "status"), "PENDING");

  const forged = await request(app)
    .post("/api/v1/webhooks/payments/sandbox")
    .set("Content-Type", "application/json")
    .set("X-Sandbox-Signature", "00")
    .send(Buffer.from('{"id":"evt_forged"}'));
  assert.equal(forged.status, 401);
  assert.equal(store.bookingStatus(bookingId), "AWAITING_PAYMENT");
  assert.equal(store.ledgerTransactionCount(), 3);
});

test("only a matching provider fact confirms payment once", async () => {
  const { app, store, sandbox } = harness();
  const created = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-match")
    .send({});
  assert.equal(created.status, 201);
  const orderRef = stringField(child(created, "checkout"), "providerOrderRef");
  sandbox.recordCapture(orderRef, "pay_match");
  const tampered = sandbox.paymentEvent({
    id: "evt_tampered",
    orderRef,
    type: "payment.captured",
    amountMinor: 1,
  });
  const rejected = await postWebhook(app, tampered.raw, tampered.signature);
  assert.equal(rejected.status, 200);
  assert.equal(store.bookingStatus(bookingId), "AWAITING_PAYMENT");
  assert.equal(store.exceptionKinds().includes("AMOUNT_MISMATCH"), true);

  const signed = sandbox.paymentEvent({
    id: "evt_captured",
    orderRef,
    type: "payment.captured",
  });
  const accepted = await postWebhook(app, signed.raw, signed.signature);
  assert.equal(accepted.status, 200);
  assert.equal(store.bookingStatus(bookingId), "CONFIRMED");
  assert.equal(store.holdState(bookingId), "CONFIRMED");
  const ledgerCount = store.ledgerTransactionCount();
  const duplicate = await postWebhook(app, signed.raw, signed.signature);
  assert.equal(duplicate.status, 200);
  assert.equal(store.ledgerTransactionCount(), ledgerCount);

  const status = await request(app)
    .get(`/api/v1/bookings/${bookingId}/payment-status`)
    .set("Authorization", token("dev-host"));
  assert.equal(text(status, "bookingStatus"), "CONFIRMED");
  assert.equal(stringField(child(status, "payment"), "status"), "SUCCEEDED");
  assert.equal(text(status, "settlement"), "unconfirmed");
});

test("reading status uses the provider record and ignores a client success body", async () => {
  const { app, store, sandbox } = harness();
  const created = await request(app)
    .post(`/api/v1/bookings/${refreshId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-refresh")
    .send({});
  const orderRef = stringField(child(created, "checkout"), "providerOrderRef");
  const early = await request(app)
    .get(`/api/v1/bookings/${refreshId}/payment-status`)
    .set("Authorization", token("dev-traveller"))
    .send({ status: "SUCCEEDED" });
  assert.equal(stringField(child(early, "payment"), "status"), "PENDING");
  sandbox.recordCapture(orderRef, "pay_refresh");
  const refreshed = await request(app)
    .get(`/api/v1/bookings/${refreshId}/payment-status`)
    .set("Authorization", token("dev-traveller"));
  assert.equal(text(refreshed, "bookingStatus"), "CONFIRMED");
  assert.equal(stringField(child(refreshed, "payment"), "status"), "SUCCEEDED");
  assert.equal(store.ledgerTransactionCount(), 4);
  const again = await request(app)
    .get(`/api/v1/bookings/${refreshId}/payment-status`)
    .set("Authorization", token("dev-traveller"));
  assert.equal(stringField(child(again, "payment"), "status"), "SUCCEEDED");
  assert.equal(store.ledgerTransactionCount(), 4);
});

test("a failed provider payment does not release the booking or confirm it", async () => {
  const { app, store, sandbox } = harness();
  const created = await request(app)
    .post(`/api/v1/bookings/${failedId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-failed")
    .send({});
  const orderRef = stringField(child(created, "checkout"), "providerOrderRef");
  sandbox.recordFailure(orderRef, "pay_failed");
  const signed = sandbox.paymentEvent({
    id: "evt_failed",
    orderRef,
    type: "payment.failed",
  });
  const failed = await postWebhook(app, signed.raw, signed.signature);
  assert.equal(failed.status, 200);
  assert.equal(store.bookingStatus(failedId), "AWAITING_PAYMENT");
  const retry = await request(app)
    .post(`/api/v1/bookings/${failedId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-failed-2")
    .send({});
  assert.equal(retry.status, 201);
});

test("refunds are reviewed, idempotent, and capped by the captured amount", async () => {
  const { app, store, sandbox, audit } = harness();
  const created = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-refund")
    .send({});
  const orderRef = stringField(child(created, "checkout"), "providerOrderRef");
  sandbox.recordCapture(orderRef, "pay_refund");
  const signed = sandbox.paymentEvent({
    id: "evt_refund_payment",
    orderRef,
    type: "payment.captured",
  });
  await postWebhook(app, signed.raw, signed.signature);

  const tooMuch = await request(app)
    .post(`/api/v1/bookings/${bookingId}/refund-requests`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "refund-too-much")
    .send({ amountMinor: 2500, reasonCode: "traveller_request" });
  assert.equal(tooMuch.status, 409);

  const requested = await request(app)
    .post(`/api/v1/bookings/${bookingId}/refund-requests`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "refund-500")
    .send({ amountMinor: 500, reasonCode: "traveller_request" });
  assert.equal(requested.status, 201);
  assert.equal(text(requested, "status"), "REQUESTED");
  const replay = await request(app)
    .post(`/api/v1/bookings/${bookingId}/refund-requests`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "refund-500")
    .send({ amountMinor: 500, reasonCode: "traveller_request" });
  assert.equal(replay.status, 200);
  assert.equal(text(replay, "id"), text(requested, "id"));

  const denied = await request(app)
    .post(`/api/v1/admin/refunds/${text(requested, "id")}/review`)
    .set("Authorization", token("dev-traveller"))
    .send({ decision: "approve" });
  assert.equal(denied.status, 403);

  const approved = await request(app)
    .post(`/api/v1/admin/refunds/${text(requested, "id")}/review`)
    .set("Authorization", token("dev-finance"))
    .send({ decision: "approve" });
  assert.equal(approved.status, 200);
  assert.equal(text(approved, "status"), "PENDING");
  assert.equal(sandbox.refundCount(), 1);
  const approvedAgain = await request(app)
    .post(`/api/v1/admin/refunds/${text(requested, "id")}/review`)
    .set("Authorization", token("dev-finance"))
    .send({ decision: "approve" });
  assert.equal(approvedAgain.status, 200);
  assert.equal(sandbox.refundCount(), 1);
  assert.equal(
    audit.entries.some(
      (entry) =>
        entry.action === "refund.review" && entry.outcome === "ALLOWED",
    ),
    true,
  );

  const refundRef = text(approved, "providerRefundRef");
  sandbox.recordRefundResult(refundRef, "processed");
  const refundEvent = sandbox.refundEvent({
    id: "evt_refund",
    refundRef,
    type: "refund.processed",
  });
  const before = store.ledgerTransactionCount();
  const processed = await postWebhook(
    app,
    refundEvent.raw,
    refundEvent.signature,
  );
  assert.equal(processed.status, 200);
  assert.equal(store.ledgerTransactionCount(), before + 1);
  const again = await postWebhook(app, refundEvent.raw, refundEvent.signature);
  assert.equal(again.status, 200);
  assert.equal(store.ledgerTransactionCount(), before + 1);

  const rest = await request(app)
    .post(`/api/v1/bookings/${bookingId}/refund-requests`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "refund-rest-too-much")
    .send({ amountMinor: 1600, reasonCode: "traveller_request" });
  assert.equal(rest.status, 409);
});

test("payout records stay eligible and cannot exceed the ledger or ignore a hold", async () => {
  const { app, store } = harness();
  const settle = await request(app)
    .post("/api/v1/admin/payouts/50000000-0000-4000-8000-000000000099/settle")
    .set("Authorization", token("dev-finance"))
    .send({ status: "SETTLED" });
  assert.equal(settle.status, 404);

  const denied = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-host"))
    .set("Idempotency-Key", "payout-host")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: completedId, amountMinor: 1800 }],
    });
  assert.equal(denied.status, 403);

  const recorded = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-finance"))
    .set("Idempotency-Key", "payout-once")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: completedId, amountMinor: 1800 }],
    });
  assert.equal(recorded.status, 201);
  assert.equal(text(recorded, "status"), "ELIGIBLE");
  assert.equal(text(recorded, "settlement"), "unconfirmed");
  assert.equal(body(recorded).providerPayoutRef, null);
  const replay = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-finance"))
    .set("Idempotency-Key", "payout-once")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: completedId, amountMinor: 1800 }],
    });
  assert.equal(replay.status, 200);
  assert.equal(text(replay, "id"), text(recorded, "id"));

  const over = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-finance"))
    .set("Idempotency-Key", "payout-over")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: completedId, amountMinor: 1 }],
    });
  assert.equal(over.status, 409);

  const disputed = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-finance"))
    .set("Idempotency-Key", "payout-dispute")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: disputedId, amountMinor: 100 }],
    });
  assert.equal(disputed.status, 409);
  assert.equal(errorCode(disputed), "DISPUTE_HOLD");

  const openRefund = await request(app)
    .post(`/api/v1/bookings/${heldId}/refund-requests`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "refund-held")
    .send({ amountMinor: 100, reasonCode: "traveller_request" });
  assert.equal(openRefund.status, 201);
  const held = await request(app)
    .post("/api/v1/admin/payouts")
    .set("Authorization", token("dev-finance"))
    .set("Idempotency-Key", "payout-held")
    .send({
      hostId,
      currency: "INR",
      allocations: [{ bookingId: heldId, amountMinor: 100 }],
    });
  assert.equal(held.status, 409);
  assert.equal(errorCode(held), "REFUND_HOLD");

  const earnings = await request(app)
    .get("/api/v1/hosts/me/earnings")
    .set("Authorization", token("dev-host"));
  assert.equal(earnings.status, 200);
  assert.equal(text(earnings, "settlement"), "unconfirmed");
  const inr = rows(earnings).find(
    (item) => stringField(item, "currency") === "INR",
  );
  assert.ok(inr !== undefined);
  assert.equal(numberField(inr, "hostPayableMinor"), 5400);
  assert.equal(numberField(inr, "allocatedMinor"), 1800);
  const payouts = await request(app)
    .get("/api/v1/hosts/me/payouts")
    .set("Authorization", token("dev-host"));
  assert.equal(rows(payouts).length, 1);
  assert.equal(store.bookingStatus(completedId), "COMPLETED");
});

test("reconciliation records provider gaps without changing payment state", async () => {
  const { app, store, sandbox } = harness();
  const created = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-recon")
    .send({});
  const orderRef = stringField(child(created, "checkout"), "providerOrderRef");
  sandbox.recordCapture(orderRef, "pay_recon");
  sandbox.notePayout({
    providerPayoutRef: "po_external",
    amountMinor: 50,
    currency: "INR",
    status: "settled",
  });
  const run = await request(app)
    .post("/api/v1/admin/reconciliation/runs")
    .set("Authorization", token("dev-finance"));
  assert.equal(run.status, 200);
  const kinds = rows(run).map((item) => stringField(item, "kind"));
  assert.equal(kinds.includes("PROVIDER_PAYMENT_MISSING_INTERNAL"), true);
  assert.equal(kinds.includes("UNRESOLVED_PENDING"), true);
  assert.equal(kinds.includes("PAYOUT_MISMATCH"), true);
  assert.equal(store.bookingStatus(bookingId), "AWAITING_PAYMENT");
  const again = await request(app)
    .post("/api/v1/admin/reconciliation/runs")
    .set("Authorization", token("dev-finance"));
  assert.equal(rows(again).length, 0);
  const queued = await request(app)
    .get("/api/v1/admin/reconciliation/exceptions")
    .set("Authorization", token("dev-finance"));
  assert.equal(rows(queued).length, rows(run).length);
});

test("an unconfigured provider refuses orders and webhooks", async () => {
  const store = new MemoryPaymentStore();
  store.seedBooking(booking(bookingId, "AWAITING_PAYMENT"));
  const app = createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode: "development", jwt: null }),
    users: new MemoryUserRepository(users),
    audit: new MemoryAuditWriter(),
    auth: null,
    payments: new PaymentService(store, new UnconfiguredPaymentProvider()),
  });
  const intent = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment-intent`)
    .set("Authorization", token("dev-traveller"))
    .set("Idempotency-Key", "intent-unconfigured")
    .send({});
  assert.equal(intent.status, 503);
  assert.equal(errorCode(intent), "PAYMENT_PROVIDER_UNCONFIGURED");
  const webhook = await request(app)
    .post("/api/v1/webhooks/payments/sandbox")
    .set("Content-Type", "application/json")
    .set("X-Sandbox-Signature", "abcd")
    .send(Buffer.from("{}"));
  assert.equal(webhook.status, 503);
  assert.equal(store.bookingStatus(bookingId), "AWAITING_PAYMENT");
});

function body(response: { body: unknown }): Record<string, unknown> {
  assert.equal(typeof response.body, "object");
  assert.ok(response.body !== null);
  return response.body as Record<string, unknown>;
}

function text(response: { body: unknown }, key: string): string {
  return stringField(body(response), key);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  assert.equal(typeof value, "string");
  return value;
}

function numberValue(response: { body: unknown }, key: string): number {
  return numberField(body(response), key);
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  assert.equal(typeof value, "number");
  return value;
}

function child(
  response: { body: unknown },
  key: string,
): Record<string, unknown> {
  const value = body(response)[key];
  assert.equal(typeof value, "object");
  assert.ok(value !== null);
  return value as Record<string, unknown>;
}

function errorCode(response: { body: unknown }): string {
  return text({ body: child(response, "error") }, "code");
}

function rows(response: { body: unknown }): Record<string, unknown>[] {
  const value = body(response).items;
  assert.ok(Array.isArray(value));
  return value.map((item: unknown) => {
    assert.equal(typeof item, "object");
    assert.ok(item !== null);
    return item as Record<string, unknown>;
  });
}

function postWebhook(
  app: ReturnType<typeof createApp>,
  raw: Buffer,
  signature: string,
) {
  return request(app)
    .post("/api/v1/webhooks/payments/sandbox")
    .set("Content-Type", "application/json")
    .set("X-Sandbox-Signature", signature)
    .send(raw.toString("utf8"));
}
