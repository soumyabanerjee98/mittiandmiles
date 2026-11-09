-- Phase 5. Refund and payout idempotency, plus a reconciliation queue.
-- This migration does not confirm a payment, hold customer funds,
-- or choose a settlement time.

ALTER TABLE "refunds" ADD COLUMN "idempotency_key" VARCHAR(128);
ALTER TABLE "refunds" ADD COLUMN "requested_by_id" UUID;

CREATE UNIQUE INDEX "refunds_idempotency_key_key"
  ON "refunds"("idempotency_key");

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payouts" ADD COLUMN "idempotency_key" VARCHAR(128);

CREATE UNIQUE INDEX "payouts_idempotency_key_key"
  ON "payouts"("idempotency_key");

CREATE TYPE "ReconciliationKind" AS ENUM (
  'PROVIDER_PAYMENT_MISSING_INTERNAL',
  'INTERNAL_PAYMENT_MISSING_PROVIDER',
  'AMOUNT_MISMATCH',
  'DUPLICATE_CAPTURE',
  'DUPLICATE_REFUND',
  'DUPLICATE_PAYOUT',
  'PAYOUT_MISMATCH',
  'UNRESOLVED_PENDING',
  'LEDGER_IMBALANCE',
  'CAPTURED_BOOKING_NOT_CONFIRMABLE'
);

CREATE TABLE "reconciliation_exceptions" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "kind" "ReconciliationKind" NOT NULL,
    "resource_ref" VARCHAR(128) NOT NULL,
    "currency" VARCHAR(3),
    "expected_minor" INTEGER,
    "actual_minor" INTEGER,
    "detail" VARCHAR(240) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "reconciliation_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reconciliation_exceptions_kind_resource_ref_idx"
  ON "reconciliation_exceptions"("kind", "resource_ref");
