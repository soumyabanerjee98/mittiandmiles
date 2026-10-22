import assert from "node:assert/strict";
import test from "node:test";
import { JwtService } from "../src/modules/auth/jwt-service.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";

const testJwt = new JwtService({
  secret: new TextEncoder().encode("test-jwt-secret-at-least-32-chars!!"),
  issuer: "test-issuer",
  audience: "test-audience",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604_800,
});

test("jwt mode rejects development tokens when only JWT is configured", async () => {
  const verifier = createAuthVerifier({ mode: "jwt", jwt: testJwt });
  const identity = await verifier.verify(
    "Bearer dev:development:dev-traveller",
  );
  assert.equal(identity, null);
});

test("development mode returns only the provider subject", async () => {
  const verifier = createAuthVerifier({ mode: "development", jwt: null });
  const identity = await verifier.verify(
    "Bearer dev:development:dev-traveller",
  );
  assert.deepEqual(identity, {
    provider: "development",
    subject: "dev-traveller",
  });
});

test("development mode accepts JWT when JWT service is configured", async () => {
  const verifier = createAuthVerifier({ mode: "development", jwt: testJwt });
  const access = await testJwt.issueAccessToken(
    "11111111-1111-4111-8111-111111111111",
  );
  const identity = await verifier.verify(`Bearer ${access.token}`);
  assert.deepEqual(identity, {
    provider: "jwt",
    subject: "11111111-1111-4111-8111-111111111111",
  });
});

test("development mode rejects tokens that try to carry a role", async () => {
  const verifier = createAuthVerifier({ mode: "development", jwt: null });
  const rejected = [
    undefined,
    "dev:development:dev-traveller",
    "Basic dev:development:dev-traveller",
    "Bearer dev:development:dev-traveller:SUPER_ADMIN",
    "Bearer dev:Development:dev-traveller",
    "Bearer dev:development:dev traveller",
  ];
  for (const header of rejected) {
    assert.equal(await verifier.verify(header), null);
  }
});

test("jwt access tokens do not embed roles in the payload", async () => {
  const access = await testJwt.issueAccessToken(
    "11111111-1111-4111-8111-111111111111",
  );
  const payload = JSON.parse(
    Buffer.from(access.token.split(".")[1] ?? "", "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  assert.equal(payload.sub, "11111111-1111-4111-8111-111111111111");
  assert.equal(payload.typ, "access");
  assert.equal("roles" in payload, false);
  assert.equal("admin" in payload, false);
});
