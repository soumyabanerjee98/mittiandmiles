import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  MemoryAuditWriter,
  FailingAuditWriter,
} from "../src/modules/audit/memory-audit-writer.js";
import type { AuditWriter } from "../src/modules/audit/audit-writer.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";
import { MemoryUserRepository } from "../src/modules/users/memory-user-repository.js";
import type { UserRecord } from "../src/modules/users/user-repository.js";
import { createLogger } from "../src/shared/logger.js";

const travellerId = "11111111-1111-4111-8111-111111111111";
const otherId = "88888888-8888-4888-8888-888888888888";
const operationsId = "33333333-3333-4333-8333-333333333333";
const suspendedId = "99999999-9999-4999-8999-999999999999";

const users: UserRecord[] = [
  {
    id: travellerId,
    email: "dev.traveller@example.com",
    authProvider: "development",
    authSubject: "dev-traveller",
    accountStatus: "ACTIVE",
    locale: "en",
    roles: [{ role: "TRAVELLER", scope: "" }],
  },
  {
    id: otherId,
    email: "dev.other@example.com",
    authProvider: "development",
    authSubject: "dev-other",
    accountStatus: "ACTIVE",
    locale: "en",
    roles: [{ role: "TRAVELLER", scope: "" }],
  },
  {
    id: operationsId,
    email: "dev.operations@example.com",
    authProvider: "development",
    authSubject: "dev-operations",
    accountStatus: "ACTIVE",
    locale: "en",
    roles: [{ role: "OPERATIONS", scope: "" }],
  },
  {
    id: suspendedId,
    email: "dev.suspended@example.com",
    authProvider: "development",
    authSubject: "dev-suspended",
    accountStatus: "SUSPENDED",
    locale: "en",
    roles: [{ role: "SUPER_ADMIN", scope: "" }],
  },
];

function token(subject: string): string {
  return `Bearer dev:development:${subject}`;
}

function createTestApp(
  audit: AuditWriter = new MemoryAuditWriter(),
  mode: "development" | "jwt" = "development",
) {
  return createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode, jwt: null }),
    users: new MemoryUserRepository(users),
    audit,
    auth: null,
  });
}

type ErrorPayload = {
  code: string;
  message: string;
  requestId: string;
  details?: { field: string; message: string }[];
};

type MeBody = {
  adminAccess: boolean;
  roles: string[];
  email: string;
  locale: string;
};

function readMe(body: unknown): MeBody {
  assert.ok(typeof body === "object" && body !== null);
  assert.ok("adminAccess" in body && typeof body.adminAccess === "boolean");
  assert.ok("roles" in body && Array.isArray(body.roles));
  assert.ok(body.roles.every((role: unknown) => typeof role === "string"));
  assert.ok("email" in body && typeof body.email === "string");
  assert.ok("locale" in body && typeof body.locale === "string");
  return {
    adminAccess: body.adminAccess,
    roles: body.roles,
    email: body.email,
    locale: body.locale,
  };
}

function onlyAudit(audit: MemoryAuditWriter) {
  assert.equal(audit.entries.length, 1);
  const entry = audit.entries[0];
  assert.ok(entry);
  return entry;
}

function readError(body: unknown): ErrorPayload {
  assert.ok(typeof body === "object" && body !== null && "error" in body);
  const error: unknown = body.error;
  assert.ok(typeof error === "object" && error !== null);
  assert.ok("code" in error && "message" in error && "requestId" in error);
  assert.equal(typeof error.code, "string");
  assert.equal(typeof error.message, "string");
  assert.equal(typeof error.requestId, "string");
  return error as ErrorPayload;
}

test("missing and client-supplied credentials do not authenticate", async () => {
  const app = createTestApp();
  const response = await request(app)
    .get("/api/v1/me")
    .set("X-Roles", "SUPER_ADMIN")
    .set("X-User-Id", operationsId)
    .send({ role: "SUPER_ADMIN" });

  assert.equal(response.status, 401);
  assert.equal(readError(response.body).code, "UNAUTHENTICATED");
});

test("development tokens are rejected when only jwt mode is enabled", async () => {
  const response = await request(createTestApp(new MemoryAuditWriter(), "jwt"))
    .get("/api/v1/me")
    .set("Authorization", token("dev-traveller"));

  assert.equal(response.status, 401);
  assert.equal(readError(response.body).code, "UNAUTHENTICATED");
});

test("an unknown subject and a disabled account stay out", async () => {
  const app = createTestApp();
  const unknown = await request(app)
    .get("/api/v1/me")
    .set("Authorization", token("missing-person"));
  assert.equal(unknown.status, 401);

  const suspended = await request(app)
    .get("/api/v1/me")
    .set("Authorization", token("dev-suspended"));
  assert.equal(suspended.status, 403);
  assert.equal(readError(suspended.body).code, "ACCOUNT_DISABLED");
  assert.equal(JSON.stringify(suspended.body).includes("SUPER_ADMIN"), false);
});

test("the signed-in profile comes from stored roles", async () => {
  const response = await request(createTestApp())
    .get("/api/v1/me")
    .set("Authorization", token("dev-traveller"))
    .set("X-Roles", "SUPER_ADMIN");

  assert.equal(response.status, 200);
  const me = readMe(response.body);
  assert.equal(me.adminAccess, false);
  assert.deepEqual(me.roles, ["TRAVELLER"]);
  assert.equal(me.email, "dev.traveller@example.com");
  assert.equal(JSON.stringify(response.body).includes("authSubject"), false);
});

test("profile updates reject privileged fields and keep stored roles", async () => {
  const app = createTestApp();
  const rejected = await request(app)
    .patch("/api/v1/me")
    .set("Authorization", token("dev-traveller"))
    .send({ locale: "en-IN", roles: ["SUPER_ADMIN"], accountStatus: "ACTIVE" });

  assert.equal(rejected.status, 400);
  const error = readError(rejected.body);
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(error.details?.some((detail) => detail.field === "roles"));

  const profile = await request(app)
    .get("/api/v1/me")
    .set("Authorization", token("dev-traveller"));
  const me = readMe(profile.body);
  assert.equal(me.locale, "en");
  assert.deepEqual(me.roles, ["TRAVELLER"]);
});

test("a traveller can update only their locale", async () => {
  const response = await request(createTestApp())
    .patch("/api/v1/me")
    .set("Authorization", token("dev-traveller"))
    .send({ locale: "en-IN" });

  assert.equal(response.status, 200);
  const me = readMe(response.body);
  assert.equal(me.locale, "en-IN");
  assert.deepEqual(me.roles, ["TRAVELLER"]);
});

test("a traveller cannot read another user, even with a role header", async () => {
  const audit = new MemoryAuditWriter();
  const response = await request(createTestApp(audit))
    .get(`/api/v1/users/${otherId}`)
    .set("Authorization", token("dev-traveller"))
    .set("X-Roles", "SUPER_ADMIN")
    .set("X-User-Id", otherId);

  assert.equal(response.status, 403);
  assert.equal(readError(response.body).code, "FORBIDDEN");
  assert.equal(
    JSON.stringify(response.body).includes("dev.other@example.com"),
    false,
  );
  const entry = onlyAudit(audit);
  assert.equal(entry.outcome, "DENIED");
  assert.equal(entry.actorUserId, travellerId);
  assert.equal(entry.resourceId, otherId);
});

test("a traveller can read their own user record without an audit row", async () => {
  const audit = new MemoryAuditWriter();
  const response = await request(createTestApp(audit))
    .get(`/api/v1/users/${travellerId}`)
    .set("Authorization", token("dev-traveller"));

  assert.equal(response.status, 200);
  assert.equal(readMe(response.body).email, "dev.traveller@example.com");
  assert.equal(audit.entries.length, 0);
});

test("operations can read another account and the read is audited", async () => {
  const audit = new MemoryAuditWriter();
  const response = await request(createTestApp(audit))
    .get(`/api/v1/users/${otherId}`)
    .set("Authorization", token("dev-operations"))
    .set("X-Request-Id", "req-staff-read");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    id: otherId,
    accountStatus: "ACTIVE",
  });
  const entry = onlyAudit(audit);
  assert.equal(entry.outcome, "ALLOWED");
  assert.equal(entry.actorUserId, operationsId);
  assert.equal(entry.requestId, "req-staff-read");
  assert.equal(entry.metadata?.targetUserId, otherId);
});

test("an invalid user id is a validation error", async () => {
  const response = await request(createTestApp())
    .get("/api/v1/users/not-a-uuid")
    .set("Authorization", token("dev-operations"));

  assert.equal(response.status, 400);
  const error = readError(response.body);
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.deepEqual(error.details, [
    { field: "userId", message: "Invalid value." },
  ]);
});

test("a staff read fails closed when the audit record cannot be written", async () => {
  const response = await request(createTestApp(new FailingAuditWriter()))
    .get(`/api/v1/users/${otherId}`)
    .set("Authorization", token("dev-operations"));

  assert.equal(response.status, 500);
  const error = readError(response.body);
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(response.body).includes("audit store"), false);
  assert.equal(JSON.stringify(response.body).includes(otherId), false);
});

test("payment capture and role assignment routes are not implemented", async () => {
  const app = createTestApp();
  const payment = await request(app)
    .post(
      "/api/v1/bookings/11111111-1111-4111-8111-111111111111/payment-intent",
    )
    .set("Authorization", token("dev-traveller"))
    .send({ currency: "INR" });
  assert.equal(payment.status, 404);

  const roles = await request(app)
    .post("/api/v1/admin/roles")
    .set("Authorization", token("dev-super"))
    .send({ role: "SUPER_ADMIN" });
  assert.equal(roles.status, 404);
});
