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
