import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryAuditWriter } from "../src/modules/audit/memory-audit-writer.js";
import { AuthService } from "../src/modules/auth/auth-service.js";
import { JwtService } from "../src/modules/auth/jwt-service.js";
import { MemoryRefreshSessionStore } from "../src/modules/auth/memory-refresh-session-store.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { MemoryAuthUserRepository } from "../src/modules/users/memory-auth-user-repository.js";
import { createLogger } from "../src/shared/logger.js";

type TokenBody = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};

function readTokens(body: unknown): TokenBody {
  assert.ok(typeof body === "object" && body !== null);
  assert.ok("accessToken" in body && typeof body.accessToken === "string");
  assert.ok("refreshToken" in body && typeof body.refreshToken === "string");
  assert.ok("tokenType" in body && typeof body.tokenType === "string");
  assert.ok("expiresIn" in body && typeof body.expiresIn === "number");
  return body as TokenBody;
}

const jwt = new JwtService({
  secret: new TextEncoder().encode("integration-jwt-secret-32-chars-min"),
  issuer: "test-issuer",
  audience: "test-audience",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604_800,
});

async function createJwtApp() {
  const passwordHash = await hashPassword("valid-password-12");
  const users = new MemoryAuthUserRepository([
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "jwt.user@example.com",
      authProvider: "local",
      authSubject: "11111111-1111-4111-8111-111111111111",
      accountStatus: "ACTIVE",
      locale: "en",
      roles: [{ role: "TRAVELLER", scope: "" }],
      passwordHash,
    },
  ]);
  const auth = new AuthService(users, new MemoryRefreshSessionStore(), jwt);
  return createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode: "jwt", jwt }),
    users,
    audit: new MemoryAuditWriter(),
    auth,
  });
}

test("login returns JWT access and refresh tokens", async () => {
  const app = await createJwtApp();
  const response = await request(app).post("/api/v1/auth/login").send({
    email: "jwt.user@example.com",
    password: "valid-password-12",
  });

  assert.equal(response.status, 200);
  const tokens = readTokens(response.body);
  assert.equal(tokens.tokenType, "Bearer");
  assert.ok(tokens.expiresIn > 0);
});

test("access JWT loads roles from the database, not the token", async () => {
  const app = await createJwtApp();
  const login = await request(app).post("/api/v1/auth/login").send({
    email: "jwt.user@example.com",
    password: "valid-password-12",
  });
  const loginTokens = readTokens(login.body);
  const response = await request(app)
    .get("/api/v1/me")
    .set("Authorization", `Bearer ${loginTokens.accessToken}`)
    .set("X-Roles", "SUPER_ADMIN");

  assert.equal(response.status, 200);
  assert.ok(typeof response.body === "object" && response.body !== null);
  assert.deepEqual((response.body as { roles: string[] }).roles, ["TRAVELLER"]);
  assert.equal((response.body as { adminAccess: boolean }).adminAccess, false);
});

test("refresh rotates the refresh token", async () => {
  const app = await createJwtApp();
  const login = await request(app).post("/api/v1/auth/login").send({
    email: "jwt.user@example.com",
    password: "valid-password-12",
  });

  const loginTokens = readTokens(login.body);
  const refreshed = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: loginTokens.refreshToken });

  assert.equal(refreshed.status, 200);
  const refreshedTokens = readTokens(refreshed.body);
  assert.notEqual(refreshedTokens.refreshToken, loginTokens.refreshToken);

  const oldRefresh = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: loginTokens.refreshToken });
  assert.equal(oldRefresh.status, 401);
});
