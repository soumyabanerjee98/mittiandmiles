import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationSql = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../prisma/migrations/20261022123000_domain_foundation/migration.sql",
  ),
  "utf8",
);

test("the initial migration contains the domain integrity rules", () => {
  const required = [
    "reject_row_mutation",
    "prevent_host_self_booking",
    "enforce_slot_capacity",
    "assert_ledger_transaction_balanced",
    "assert_refund_within_captured",
    "assert_payout_allocation_limits",
    "payment_attempts_provider_payment_ref_key",
    "webhook_events_provider_provider_event_id_key",
    "reviews_booking_id_reviewer_id_reviewee_id_key",
  ];
  for (const snippet of required) {
    assert.equal(migrationSql.includes(snippet), true, snippet);
  }
  assert.equal(migrationSql.includes("@example.com"), false);
  assert.equal(migrationSql.toLowerCase().includes("password"), false);
});

test("the catalogue migration adds reference data without document bytes", () => {
  const catalogueSql = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../prisma/migrations/20261022210000_catalogue/migration.sql",
    ),
    "utf8",
  );
  for (const snippet of [
    "NEEDS_INFORMATION",
    'CREATE TABLE "languages"',
    'CREATE TABLE "categories"',
    'CREATE TABLE "experience_blackouts"',
    "experiences_category_fkey",
    "cancellation_policy",
  ]) {
    assert.equal(catalogueSql.includes(snippet), true, snippet);
  }
  assert.equal(catalogueSql.toLowerCase().includes("bytea"), false);
  assert.equal(catalogueSql.includes("@example.com"), false);
});

test("the booking command migration keeps idempotency and one pending offer", () => {
  const sql = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../prisma/migrations/20261023120000_booking_commands/migration.sql",
    ),
    "utf8",
  );
  for (const snippet of [
    'CREATE TABLE "command_idempotency"',
    "command_idempotency_actor_user_id_scope_idempotency_key_key",
    "offers_one_pending_per_host",
    "status\" = 'PENDING'",
  ]) {
    assert.equal(sql.includes(snippet), true, snippet);
  }
  assert.equal(sql.toLowerCase().includes("succeeded"), false);
});
