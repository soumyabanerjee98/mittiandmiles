import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDevelopmentSeed,
  developmentCatalogue,
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

test("catalogue fixtures are development-only drafts", () => {
  assert.equal(developmentCatalogue.marker, "development-only");
  for (const city of developmentCatalogue.cities) {
    assert.equal(city.name.startsWith("Dev "), true);
    assert.equal(city.slug.startsWith("dev-"), true);
  }
  for (const experience of developmentCatalogue.experiences) {
    assert.equal(experience.listingStatus, "DRAFT");
    assert.equal(experience.title.startsWith("Dev "), true);
  }
  const serialized = JSON.stringify(developmentCatalogue);
  assert.equal(serialized.includes("VERIFIED"), false);
  assert.equal(serialized.includes("PUBLISHED"), false);
  assert.equal(serialized.includes("password"), false);
});
