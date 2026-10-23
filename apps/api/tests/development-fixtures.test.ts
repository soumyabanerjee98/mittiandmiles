import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDevelopmentSeed,
  developmentUsers,
} from "../prisma/development-fixtures.js";

test("development fixtures are obviously fake and carry no secrets", () => {
  assert.ok(developmentUsers.length >= 2);
  for (const fixture of developmentUsers) {
    assert.match(fixture.email, /@example\.com$/);
    assert.equal(fixture.authProvider, "development");
    assert.match(fixture.authSubject, /^dev-/);
    assert.equal(JSON.stringify(fixture).includes("password"), false);
    assert.equal(JSON.stringify(fixture).includes("document"), false);
    assert.equal(
      fixture.traveller?.displayName.startsWith("Dev ") ?? true,
      true,
    );
    assert.equal(fixture.host?.publicName.startsWith("Dev ") ?? true, true);
  }
  const serialized = JSON.stringify(developmentUsers);
  assert.equal(serialized.includes("VERIFIED"), false);
  assert.equal(serialized.includes("SUPER_ADMIN"), true);
});

test("seed refuses every environment except development", () => {
  assert.doesNotThrow(() => {
    assertDevelopmentSeed("development");
  });
  for (const nodeEnv of ["production", "test", undefined]) {
    assert.throws(() => {
      assertDevelopmentSeed(nodeEnv);
    }, /NODE_ENV must be development/);
  }
});
