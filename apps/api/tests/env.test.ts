import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "../src/config/env.js";

test("loadEnv accepts a Supabase Postgres URL", () => {
  const env = loadEnv({
    NODE_ENV: "development",
    PORT: "3000",
    LOG_LEVEL: "info",
    DATABASE_URL:
      "postgresql://postgres.projectref:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require",
  });

  assert.equal(env.PORT, 3000);
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.LOG_LEVEL, "info");
});

test("loadEnv reports variable names and omits values", () => {
  const secret = "super-secret-value";
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: secret,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DATABASE_URL/);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test("loadEnv rejects a port outside the valid range", () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: "test",
        PORT: "0",
        DATABASE_URL:
          "postgresql://postgres.projectref:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /PORT/);
      return true;
    },
  );
});
