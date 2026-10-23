import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryAuditWriter } from "../src/modules/audit/memory-audit-writer.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";
import { MemoryBookingStore } from "../src/modules/bookings/memory-store.js";
import type { BookingSeed } from "../src/modules/bookings/memory-store.js";
import { BookingService } from "../src/modules/bookings/service.js";
import { decideTransition } from "../src/modules/bookings/state.js";
import type { BookingRow } from "../src/modules/bookings/types.js";
import { MemoryUserRepository } from "../src/modules/users/memory-user-repository.js";
import type { UserRecord } from "../src/modules/users/user-repository.js";
import { createLogger } from "../src/shared/logger.js";

const now = new Date("2030-06-01T00:00:00.000Z");
const travellerId = "11111111-1111-4111-8111-111111111111";
const otherTravellerId = "11111111-1111-4111-8111-111111111112";
const hostUserId = "22222222-2222-4222-8222-222222222222";
const otherHostUserId = "22222222-2222-4222-8222-222222222224";
const hostId = "22222222-2222-4222-8222-222222222223";
const otherHostId = "22222222-2222-4222-8222-222222222225";
const cityId = "10000000-0000-4000-8000-000000000001";
const experienceId = "30000000-0000-4000-8000-000000000001";
const draftId = "30000000-0000-4000-8000-000000000002";
const slotId = "40000000-0000-4000-8000-000000000001";
const lastSlotId = "40000000-0000-4000-8000-000000000002";
const seededBookingId = "50000000-0000-4000-8000-000000000099";
const draftSlotId = "40000000-0000-4000-8000-000000000003";

const users: UserRecord[] = [
  user(travellerId, "dev-traveller", "TRAVELLER"),
  user(otherTravellerId, "dev-traveller-2", "TRAVELLER"),
  user(hostUserId, "dev-host", "HOST", "TRAVELLER"),
  user(otherHostUserId, "dev-host-2", "HOST"),
];

function user(
  id: string,
  subject: string,
  role: UserRecord["roles"][number]["role"],
  extra?: UserRecord["roles"][number]["role"],
): UserRecord {
  return {
    id,
    email: `${subject}@example.com`,
    authProvider: "development",
    authSubject: subject,
    accountStatus: "ACTIVE",
    locale: "en",
    roles:
      extra === undefined
        ? [{ role, scope: "" }]
        : [
            { role, scope: "" },
            { role: extra, scope: "" },
          ],
  };
}

function token(subject: string): string {
  return `Bearer dev:development:${subject}`;
}

function seed(policy = false): BookingSeed {
  return {
    cities: [{ id: cityId, timezone: "Asia/Kolkata", status: "ACTIVE" }],
    hosts: [
      {
        id: hostId,
        userId: hostUserId,
        verificationStatus: "VERIFIED",
        publicProfileStatus: "VISIBLE",
      },
      {
        id: otherHostId,
        userId: otherHostUserId,
        verificationStatus: "VERIFIED",
        publicProfileStatus: "VISIBLE",
      },
    ],
    experiences: [
      experience(experienceId, hostId, "PUBLISHED", [
        {
          id: slotId,
          startsAt: "2030-06-15T04:30:00.000Z",
          endsAt: "2030-06-15T06:30:00.000Z",
          capacity: 4,
          status: "OPEN",
        },
        {
          id: lastSlotId,
          startsAt: "2030-06-16T04:30:00.000Z",
          endsAt: "2030-06-16T06:30:00.000Z",
          capacity: 1,
          status: "OPEN",
        },
      ]),
      experience(draftId, hostId, "DRAFT", [
        {
          id: draftSlotId,
          startsAt: "2030-06-15T04:30:00.000Z",
          endsAt: "2030-06-15T06:30:00.000Z",
          capacity: 4,
          status: "OPEN",
        },
      ]),
    ],
    ...(policy
      ? {
          policies: [
            {
              id: "60000000-0000-4000-8000-000000000001",
              version: "fixture-10",
              rateBps: 1000,
              effectiveFrom: "2020-01-01T00:00:00.000Z",
              effectiveTo: null,
            },
          ],
        }
      : {}),
  };
}

function experience(
  id: string,
  ownerHostId: string,
  listingStatus: string,
  slots: {
    id: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    status: string;
  }[],
) {
  return {
    id,
    hostId: ownerHostId,
    cityId,
    title: "Dev Walk",
    inclusions: "tea",
    exclusions: "transport",
    meetingArea: "Dev meeting area",
    cancellationPolicy: "Free cancellation one day before.",
    basePriceMinor: 150000,
    currency: "INR",
    listingStatus,
    slots,
    blackouts: [],
  };
}

function appFor(store: MemoryBookingStore, clock: () => Date = () => now) {
  return createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode: "development", jwt: null }),
    users: new MemoryUserRepository(users),
    audit: new MemoryAuditWriter(),
    auth: null,
    bookings: new BookingService(store, clock),
  });
}

function errorCode(body: unknown): string {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && "error" in body);
  const error: unknown = body.error;
  assert.equal(typeof error, "object");
  assert.ok(error !== null && "code" in error);
  assert.equal(typeof error.code, "string");
  return error.code;
}

function text(body: unknown, key: string): string {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && key in body);
  const value = (body as Record<string, unknown>)[key];
  assert.equal(typeof value, "string");
  return value;
}

const requestBody = {
  cityId,
  startsOn: "2030-06-10",
  endsOn: "2030-06-20",
  partySize: 2,
  currency: "INR",
  preferences: { interests: ["food"] },
};

test("awaiting payment has no transition into confirmed", () => {
  const actions = [
    "cancel",
    "expire",
    "check_in",
    "complete",
    "no_show",
    "dispute",
  ] as const;
  for (const action of actions) {
    const decision = decideTransition("AWAITING_PAYMENT", action);
    if (decision.type === "apply") {
      assert.notEqual(decision.status, "CONFIRMED");
    }
  }
  assert.equal(decideTransition("AWAITING_PAYMENT", "complete").type, "reject");
  assert.equal(decideTransition("COMPLETED", "complete").type, "replay");
});

test("duplicate trip requests with one idempotency key return the original", async () => {
  const store = new MemoryBookingStore(seed());
  const app = appFor(store);
  const first = await request(app)
    .post("/api/v1/trip-requests")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "request-key-1")
    .send(requestBody);
  assert.equal(first.status, 201);
  const second = await request(app)
    .post("/api/v1/trip-requests")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "request-key-1")
    .send(requestBody);
  assert.equal(second.status, 200);
  assert.equal(text(second.body, "id"), text(first.body, "id"));

  const changed = await request(app)
    .post("/api/v1/trip-requests")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "request-key-1")
    .send({ ...requestBody, partySize: 3 });
  assert.equal(changed.status, 409);
  assert.equal(errorCode(changed.body), "IDEMPOTENCY_CONFLICT");
});

test("expired offers cannot be accepted and acceptance does not confirm payment", async () => {
  const store = new MemoryBookingStore(seed(true));
  const early = appFor(store, () => now);
  const late = appFor(
    store,
    () => new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
  );
  const created = await request(early)
    .post("/api/v1/trip-requests")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "request-key-2")
    .send(requestBody);
  assert.equal(created.status, 201);
  const requestId = text(created.body, "id");
  const offer = await request(early)
    .post(`/api/v1/trip-requests/${requestId}/offers`)
    .set("authorization", token("dev-host"))
    .send(offerBody("2030-06-02T00:00:00.000Z"));
  assert.equal(offer.status, 201);
  const offerId = text(offer.body, "id");

  const expired = await request(late)
    .post(`/api/v1/offers/${offerId}/accept`)
    .set("authorization", token("dev-traveller"));
  assert.equal(expired.status, 409);
  assert.equal(errorCode(expired.body), "OFFER_EXPIRED");

  const fresh = await request(early)
    .post(`/api/v1/trip-requests/${requestId}/offers`)
    .set("authorization", token("dev-host"))
    .send(offerBody("2030-06-03T00:00:00.000Z"));
  assert.equal(fresh.status, 201);
  const duplicate = await request(early)
    .post(`/api/v1/trip-requests/${requestId}/offers`)
    .set("authorization", token("dev-host"))
    .send(offerBody("2030-06-04T00:00:00.000Z"));
  assert.equal(duplicate.status, 409);
  assert.equal(errorCode(duplicate.body), "DUPLICATE_OFFER");

  const accepted = await request(early)
    .post(`/api/v1/offers/${text(fresh.body, "id")}/accept`)
    .set("authorization", token("dev-traveller"));
  assert.equal(accepted.status, 201);
  assert.equal(text(accepted.body, "status"), "AWAITING_PAYMENT");
  assert.equal(paymentState(accepted.body), "NOT_STARTED");
  assert.equal(numberField(accepted.body, "totalMinor"), 180000);
  assert.equal(numberField(accepted.body, "commissionMinor"), 18000);
  assert.equal(text(accepted.body, "cancellationPolicy"), "Host terms.");
  assert.equal(store.outboxTypes().includes("booking.confirmed"), false);
  assert.equal(store.outboxTypes().includes("booking.awaiting_payment"), true);

  const again = await request(early)
    .post(`/api/v1/offers/${text(fresh.body, "id")}/accept`)
    .set("authorization", token("dev-traveller"));
  assert.equal(again.status, 200);
  assert.equal(text(again.body, "id"), text(accepted.body, "id"));
});

test("the last slot can be reserved only once, including under overlap", async () => {
  const store = new MemoryBookingStore(seed());
  store.criticalSectionDelayMs = 40;
  const app = appFor(store);
  const [first, second] = await Promise.all([
    request(app)
      .post("/api/v1/bookings")
      .set("authorization", token("dev-traveller"))
      .set("idempotency-key", "slot-key-a")
      .send(bookingBody(lastSlotId, 1)),
    request(app)
      .post("/api/v1/bookings")
      .set("authorization", token("dev-traveller-2"))
      .set("idempotency-key", "slot-key-b")
      .send(bookingBody(lastSlotId, 1)),
  ]);
  const statuses = [first.status, second.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  const failure = first.status === 409 ? first : second;
  assert.equal(errorCode(failure.body), "BOOKING_NOT_AVAILABLE");
  assert.equal(store.heldQuantity(lastSlotId, now), 1);
  const winner = first.status === 201 ? first : second;
  assert.equal(text(winner.body, "status"), "AWAITING_PAYMENT");
  assert.equal(paymentState(winner.body), "NOT_STARTED");
  assert.equal(numberField(winner.body, "totalMinor"), 150000);
  assert.equal(numberField(winner.body, "commissionMinor"), 0);
  assert.equal(numberField(winner.body, "participantCount"), 1);

  const replay = await request(app)
    .post("/api/v1/bookings")
    .set(
      "authorization",
      token(first.status === 201 ? "dev-traveller" : "dev-traveller-2"),
    )
    .set("idempotency-key", first.status === 201 ? "slot-key-a" : "slot-key-b")
    .send(bookingBody(lastSlotId, 1));
  assert.equal(replay.status, 200);
  assert.equal(store.heldQuantity(lastSlotId, now), 1);
});

test("a lapsed hold releases the seat and invalid transitions fail", async () => {
  const store = new MemoryBookingStore(seed());
  const early = appFor(store, () => now);
  const later = appFor(store, () => new Date(now.getTime() + 16 * 60 * 1000));
  const held = await request(early)
    .post("/api/v1/bookings")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "hold-key-1")
    .send(bookingBody(lastSlotId, 1));
  assert.equal(held.status, 201);
  const bookingId = text(held.body, "id");

  const complete = await request(early)
    .post(`/api/v1/bookings/${bookingId}/complete`)
    .set("authorization", token("dev-host"));
  assert.equal(complete.status, 409);
  assert.equal(errorCode(complete.body), "INVALID_STATE");
  const noShow = await request(early)
    .post(`/api/v1/bookings/${bookingId}/no-show`)
    .set("authorization", token("dev-host"))
    .send({});
  assert.equal(noShow.status, 409);
  assert.equal(errorCode(noShow.body), "INVALID_STATE");

  const replacement = await request(later)
    .post("/api/v1/bookings")
    .set("authorization", token("dev-traveller-2"))
    .set("idempotency-key", "hold-key-2")
    .send(bookingBody(lastSlotId, 1));
  assert.equal(replacement.status, 201);
  const expired = await request(later)
    .get(`/api/v1/bookings/${bookingId}`)
    .set("authorization", token("dev-traveller"));
  assert.equal(expired.status, 200);
  assert.equal(text(expired.body, "status"), "EXPIRED");
  assert.equal(
    store.heldQuantity(lastSlotId, new Date(now.getTime() + 16 * 60 * 1000)),
    1,
  );

  const hidden = await request(early)
    .get(`/api/v1/bookings/${bookingId}`)
    .set("authorization", token("dev-host-2"));
  assert.equal(hidden.status, 404);

  const draft = await request(early)
    .post("/api/v1/bookings")
    .set("authorization", token("dev-traveller"))
    .set("idempotency-key", "draft-key-1")
    .send({
      experienceId: draftId,
      slotId: draftSlotId,
      participantCount: 1,
      currency: "INR",
    });
  assert.equal(draft.status, 409);
  assert.equal(errorCode(draft.body), "BOOKING_NOT_AVAILABLE");

  const own = await request(early)
    .post("/api/v1/bookings")
    .set("authorization", token("dev-host"))
    .set("idempotency-key", "self-key-11")
    .send(bookingBody(slotId, 1));
  assert.equal(own.status, 409);
  assert.equal(errorCode(own.body), "CONFLICT");

  const confirm = await request(early).post(
    `/api/v1/bookings/${bookingId}/confirm`,
  );
  assert.equal(confirm.status, 404);
});

test("completion is idempotent and a traveller cannot complete", async () => {
  const store = new MemoryBookingStore(seed());
  store.seedBooking(progressBooking());
  const app = appFor(store);
  const traveller = await request(app)
    .post(`/api/v1/bookings/${seededBookingId}/complete`)
    .set("authorization", token("dev-traveller"));
  assert.equal(traveller.status, 403);

  const first = await request(app)
    .post(`/api/v1/bookings/${seededBookingId}/complete`)
    .set("authorization", token("dev-host"));
  assert.equal(first.status, 200);
  assert.equal(text(first.body, "status"), "COMPLETED");
  const second = await request(app)
    .post(`/api/v1/bookings/${seededBookingId}/complete`)
    .set("authorization", token("dev-host"));
  assert.equal(second.status, 200);
  assert.equal(completedEvents(second.body), 1);
  assert.equal(paymentState(second.body), "NOT_STARTED");
});

function offerBody(expiresAt: string) {
  return {
    proposedStartsAt: "2030-06-15T04:30:00.000Z",
    proposedEndsAt: "2030-06-15T08:30:00.000Z",
    priceMinor: 180000,
    currency: "INR",
    inclusions: "tea",
    exclusions: "transport",
    cancellationPolicy: "Host terms.",
    expiresAt,
  };
}

function bookingBody(slot: string, participantCount: number) {
  return {
    experienceId,
    slotId: slot,
    participantCount,
    currency: "INR",
  };
}

function paymentState(body: unknown): string {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && "payment" in body);
  const payment: unknown = body.payment;
  assert.equal(typeof payment, "object");
  assert.ok(payment !== null && "state" in payment);
  assert.equal(typeof payment.state, "string");
  return payment.state;
}

function numberField(body: unknown, key: string): number {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && key in body);
  const value = (body as Record<string, unknown>)[key];
  assert.equal(typeof value, "number");
  return value;
}

function completedEvents(body: unknown): number {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && "events" in body);
  const events: unknown = body.events;
  assert.ok(Array.isArray(events));
  return events.filter((event: unknown) => {
    if (
      typeof event !== "object" ||
      event === null ||
      !("eventType" in event)
    ) {
      return false;
    }
    return event.eventType === "booking.completed";
  }).length;
}

function progressBooking(): BookingRow {
  return {
    id: seededBookingId,
    travellerId,
    hostId,
    hostUserId,
    experienceId,
    offerId: null,
    status: "IN_PROGRESS",
    startsAt: "2030-06-15T04:30:00.000Z",
    endsAt: "2030-06-15T06:30:00.000Z",
    participantCount: 1,
    currency: "INR",
    subtotalMinor: 150000,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 150000,
    commissionPolicyId: null,
    commissionVersion: null,
    commissionMinor: 0,
    hostGrossMinor: 150000,
    pricingBasis: "LISTED_TOTAL",
    title: "Dev Walk",
    inclusions: "tea",
    exclusions: "transport",
    meetingArea: "Dev meeting area",
    cancellationPolicy: "Free cancellation one day before.",
    termsCapturedAt: now.toISOString(),
    createdAt: now.toISOString(),
    reservation: null,
    events: [],
  };
}
