import assert from "node:assert/strict";
import test from "node:test";
import {
  Permission,
  hasAdminAccess,
  hasPermission,
  permissionsFor,
} from "../src/modules/auth/permissions.js";

test("traveller and host grants stay on their own resources", () => {
  const traveller = [{ role: "TRAVELLER" as const, scope: "" }];
  const host = [{ role: "HOST" as const, scope: "" }];

  assert.equal(hasPermission(traveller, Permission.REQUEST_WRITE_OWN), true);
  assert.equal(hasPermission(traveller, Permission.USER_READ), false);
  assert.equal(hasPermission(traveller, Permission.REFUND_REVIEW), false);
  assert.equal(hasPermission(traveller, Permission.ROLE_ASSIGN), false);
  assert.equal(hasAdminAccess(traveller), false);

  assert.equal(hasPermission(host, Permission.EXPERIENCE_WRITE_OWN), true);
  assert.equal(hasPermission(host, Permission.USER_READ), false);
  assert.equal(hasPermission(host, Permission.HOST_VERIFY), false);
  assert.equal(hasAdminAccess(host), false);
});

test("staff permissions stay separated and deny by default", () => {
  const operations = [{ role: "OPERATIONS" as const, scope: "" }];
  const support = [{ role: "SUPPORT" as const, scope: "" }];
  const verification = [{ role: "VERIFICATION" as const, scope: "" }];
  const finance = [{ role: "FINANCE" as const, scope: "" }];
  const superAdmin = [{ role: "SUPER_ADMIN" as const, scope: "" }];

  assert.equal(hasPermission(operations, Permission.EXPERIENCE_MODERATE), true);
  assert.equal(hasPermission(operations, Permission.REFUND_REVIEW), false);
  assert.equal(hasPermission(operations, Permission.ROLE_ASSIGN), false);

  assert.equal(hasPermission(support, Permission.TICKET_MANAGE), true);
  assert.equal(hasPermission(support, Permission.LEDGER_READ), false);

  assert.equal(hasPermission(verification, Permission.HOST_VERIFY), true);
  assert.equal(hasPermission(verification, Permission.DOCUMENT_READ), true);
  assert.equal(hasPermission(verification, Permission.REFUND_REVIEW), false);

  assert.equal(hasPermission(finance, Permission.REFUND_REVIEW), true);
  assert.equal(hasPermission(finance, Permission.PAYOUT_REVIEW), true);
  assert.equal(hasPermission(finance, Permission.LEDGER_READ), true);
  assert.equal(hasPermission(finance, Permission.HOST_VERIFY), false);
  assert.equal(hasPermission(finance, Permission.ROLE_ASSIGN), false);

  assert.equal(hasPermission(superAdmin, Permission.ROLE_ASSIGN), true);
  assert.equal(hasAdminAccess(superAdmin), true);
  assert.equal(hasPermission([], Permission.USER_READ), false);
  assert.equal(permissionsFor([]).size, 0);
});

test("a scoped grant is ignored until scoping rules exist", () => {
  const scoped = [{ role: "SUPER_ADMIN" as const, scope: "kolkata" }];
  assert.equal(hasPermission(scoped, Permission.ROLE_ASSIGN), false);
  assert.equal(hasAdminAccess(scoped), false);
});

test("grants from more than one global role are combined", () => {
  const grants = [
    { role: "HOST" as const, scope: "" },
    { role: "FINANCE" as const, scope: "city:jaipur" },
    { role: "SUPPORT" as const, scope: "" },
  ];
  assert.equal(hasPermission(grants, Permission.EXPERIENCE_WRITE_OWN), true);
  assert.equal(hasPermission(grants, Permission.TICKET_MANAGE), true);
  assert.equal(hasPermission(grants, Permission.REFUND_REVIEW), false);
});
