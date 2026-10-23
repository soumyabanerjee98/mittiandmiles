import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/shared/logger.js";

const app = createApp(createLogger("silent"));

type ErrorPayload = {
  code: string;
  message: string;
  requestId: string;
};

function readError(body: unknown): ErrorPayload {
  assert.ok(typeof body === "object" && body !== null && "error" in body);
  const error: unknown = body.error;
  assert.ok(typeof error === "object" && error !== null);
  assert.ok("code" in error && "message" in error && "requestId" in error);
  assert.equal(typeof error.code, "string");
  assert.equal(typeof error.message, "string");
  assert.equal(typeof error.requestId, "string");
  return {
    code: error.code,
    message: error.message,
    requestId: error.requestId,
  };
}

test("GET /health returns ok and a request id", async () => {
  const response = await request(app)
    .get("/health")
    .set("X-Request-Id", "req-health-1");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "mittiandmiles-api",
  });
  assert.equal(response.headers["x-request-id"], "req-health-1");
  assert.equal(response.headers["x-powered-by"], undefined);
});

test("unknown routes use the error envelope and echo a safe request id", async () => {
  const response = await request(app).get("/api/v1/bookings");

  assert.equal(response.status, 404);
  const error = readError(response.body);
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.message, "Not found.");
  assert.equal(error.requestId, response.headers["x-request-id"]);
});

test("malformed request ids are replaced", async () => {
  const response = await request(app)
    .get("/health")
    .set("X-Request-Id", "bad id");

  assert.equal(response.status, 200);
  assert.notEqual(response.headers["x-request-id"], "bad id");
  assert.match(String(response.headers["x-request-id"]), /^[0-9a-f-]{36}$/);
});

test("invalid JSON returns a safe client error", async () => {
  const response = await request(app)
    .post("/health")
    .set("Content-Type", "application/json")
    .send("{");

  assert.equal(response.status, 400);
  const error = readError(response.body);
  assert.equal(error.code, "INVALID_JSON");
  assert.equal(error.requestId, response.headers["x-request-id"]);
  assert.equal(JSON.stringify(response.body).includes("SyntaxError"), false);
});
