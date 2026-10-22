import assert from "node:assert/strict";
import test from "node:test";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";

test("unconfigured mode rejects a well-formed development token", async () => {
  const verifier = createAuthVerifier("unconfigured");
  const identity = await verifier.verify(
    "Bearer dev:development:dev-traveller",
  );
  assert.equal(identity, null);
});

test("development mode returns only the provider subject", async () => {
  const verifier = createAuthVerifier("development");
  const identity = await verifier.verify(
    "Bearer dev:development:dev-traveller",
  );
  assert.deepEqual(identity, {
    provider: "development",
    subject: "dev-traveller",
  });
});

test("development mode rejects tokens that try to carry a role", async () => {
  const verifier = createAuthVerifier("development");
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
