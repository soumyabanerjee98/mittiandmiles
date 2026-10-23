import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryAuditWriter } from "../src/modules/audit/memory-audit-writer.js";
import { createAuthVerifier } from "../src/modules/auth/verifier.js";
import { MemoryCatalogueStore } from "../src/modules/catalogue/memory-store.js";
import { CatalogueService } from "../src/modules/catalogue/service.js";
import { UnconfiguredPrivateStorage } from "../src/modules/catalogue/document-storage.js";
import type { CatalogueSeed } from "../src/modules/catalogue/memory-store.js";
import type {
  HostRecord,
  StoredExperience,
} from "../src/modules/catalogue/types.js";
import { MemoryUserRepository } from "../src/modules/users/memory-user-repository.js";
import type { UserRecord } from "../src/modules/users/user-repository.js";
import { createLogger } from "../src/shared/logger.js";

const travellerId = "11111111-1111-4111-8111-111111111111";
const hostUserId = "22222222-2222-4222-8222-222222222222";
const hostId = "22222222-2222-4222-8222-222222222223";
const otherUserId = "88888888-8888-4888-8888-888888888881";
const otherHostId = "88888888-8888-4888-8888-888888888882";
const operationsId = "33333333-3333-4333-8333-333333333333";
const verificationId = "55555555-5555-4555-8555-555555555555";
const supportId = "66666666-6666-4666-8666-666666666666";
const cityId = "10000000-0000-4000-8000-000000000001";
const inactiveCityId = "10000000-0000-4000-8000-000000000002";

const users: UserRecord[] = [
  user(travellerId, "dev-traveller", "TRAVELLER"),
  user(hostUserId, "dev-host", "HOST"),
  user(otherUserId, "dev-other-host", "HOST"),
  user(operationsId, "dev-operations", "OPERATIONS"),
  user(verificationId, "dev-verification", "VERIFICATION"),
  user(supportId, "dev-support", "SUPPORT"),
];

function user(
  id: string,
  subject: string,
  role: UserRecord["roles"][number]["role"],
): UserRecord {
  return {
    id,
    email: `${subject}@example.com`,
    authProvider: "development",
    authSubject: subject,
    accountStatus: "ACTIVE",
    locale: "en",
    roles: [{ role, scope: "" }],
  };
}

function token(subject: string): string {
  return `Bearer dev:development:${subject}`;
}

function hostRecord(
  id: string,
  userId: string,
  status: HostRecord["verificationStatus"] = "NOT_STARTED",
): HostRecord {
  return {
    id,
    userId,
    publicName: "Dev Host",
    bio: null,
    verificationStatus: status,
    onboardingStatus: status === "VERIFIED" ? "COMPLETE" : "NOT_STARTED",
    publicProfileStatus: status === "VERIFIED" ? "VISIBLE" : "HIDDEN",
    verificationNote: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    documents: [],
  };
}

function listing(input: {
  id: string;
  hostId: string;
  cityId: string;
  status: StoredExperience["listingStatus"];
  createdAt: string;
  capacity?: number;
  price?: number;
  slots?: StoredExperience["slots"];
  blackouts?: StoredExperience["blackouts"];
}): StoredExperience {
  return {
    id: input.id,
    hostId: input.hostId,
    cityId: input.cityId,
    category: "dev-walk",
    title: "Dev Walk",
    description: "A development listing.",
    durationMinutes: 120,
    basePriceMinor: input.price ?? 150000,
    currency: "INR",
    capacity: input.capacity ?? 4,
    listingStatus: input.status,
    inclusions: "",
    exclusions: "",
    meetingArea: "Dev meeting area",
    accessibilityNotes: "",
    safetyNotes: "",
    cancellationPolicy: "Free cancellation one day before.",
    moderationNote: null,
    languageCodes: ["en"],
    images: [],
    slots: input.slots ?? [],
    blackouts: input.blackouts ?? [],
    createdAt: input.createdAt,
  };
}

const referenceSeed: CatalogueSeed = {
  cities: [
    {
      id: cityId,
      slug: "dev-city",
      name: "Dev City",
      state: "Dev State",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:03.000Z",
    },
    {
      id: inactiveCityId,
      slug: "dev-city-inactive",
      name: "Dev City Inactive",
      state: "Dev State",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
      status: "INACTIVE",
      createdAt: "2026-01-01T00:00:04.000Z",
    },
  ],
  languages: [
    {
      code: "en",
      name: "English",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  categories: [
    {
      slug: "dev-walk",
      name: "Dev Walk",
      active: true,
      createdAt: "2026-01-01T00:00:02.000Z",
    },
  ],
  hosts: [hostRecord(hostId, hostUserId), hostRecord(otherHostId, otherUserId)],
};

function createTestApp(
  seed: CatalogueSeed = referenceSeed,
  audit = new MemoryAuditWriter(),
) {
  return createApp(createLogger("silent"), {
    verifier: createAuthVerifier({ mode: "development", jwt: null }),
    users: new MemoryUserRepository(users),
    audit,
    auth: null,
    catalogue: new CatalogueService(
      new MemoryCatalogueStore(seed),
      new UnconfiguredPrivateStorage(),
    ),
  });
}

function experienceBody(city: string) {
  return {
    cityId: city,
    category: "dev-walk",
    title: "Dev Morning Walk",
    description: "A short walk for the development test.",
    durationMinutes: 120,
    basePriceMinor: 150000,
    currency: "INR",
    capacity: 4,
    inclusions: "Water",
    exclusions: "Transport",
    meetingArea: "Dev meeting area",
    cancellationPolicy: "Cancel one day before the start.",
    languageCodes: ["en"],
  };
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.ok(value !== null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function textField(value: unknown, key: string): string {
  const field = record(value)[key];
  assert.equal(typeof field, "string");
  return field;
}

function recordsField(value: unknown, key: string): Record<string, unknown>[] {
  const field = record(value)[key];
  assert.ok(Array.isArray(field));
  return field.map((item) => record(item));
}

function ids(value: unknown): string[] {
  return recordsField(value, "items").map((item) => {
    const id = item.id;
    assert.equal(typeof id, "string");
    return id;
  });
}

test("a new city stays hidden until an authorised admin activates it", async () => {
  const audit = new MemoryAuditWriter();
  const app = createTestApp(
    { cities: [], languages: [], categories: [] },
    audit,
  );

  const denied = await request(app)
    .post("/api/v1/admin/cities")
    .set("authorization", token("dev-support"))
    .send({
      slug: "dev-harbour",
      name: "Dev Harbour",
      state: "Dev State",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
    });
  assert.equal(denied.status, 403);
  assert.equal(
    audit.entries.some((entry) => entry.outcome === "DENIED"),
    true,
  );

  const created = await request(app)
    .post("/api/v1/admin/cities")
    .set("authorization", token("dev-operations"))
    .send({
      slug: "dev-harbour",
      name: "Dev Harbour",
      state: "Dev State",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
    });
  assert.equal(created.status, 201);
  assert.equal(textField(created.body, "status"), "INACTIVE");

  const hidden = await request(app).get("/api/v1/cities");
  assert.equal(hidden.status, 200);
  assert.equal(recordsField(hidden.body, "items").length, 0);

  const activated = await request(app)
    .post(`/api/v1/admin/cities/${textField(created.body, "id")}/activation`)
    .set("authorization", token("dev-operations"))
    .send({ status: "ACTIVE", reason: "Open the development city." });
  assert.equal(activated.status, 200);
  assert.equal(textField(activated.body, "status"), "ACTIVE");
  assert.equal(
    audit.entries.some(
      (entry) =>
        entry.action === "city.activate" && entry.outcome === "ALLOWED",
    ),
    true,
  );

  const visible = await request(app).get("/api/v1/cities");
  const visibleItems = recordsField(visible.body, "items");
  assert.equal(visibleItems.length, 1);
  assert.equal(visibleItems[0]?.slug, "dev-harbour");
});

test("host onboarding, ownership, and moderation keep unpublished listings private", async () => {
  const audit = new MemoryAuditWriter();
  const app = createTestApp(referenceSeed, audit);

  const traveller = await request(app)
    .post("/api/v1/hosts/onboarding")
    .set("authorization", token("dev-traveller"))
    .send({ publicName: "Dev Traveller", submit: false });
  assert.equal(traveller.status, 403);

  const early = await request(app)
    .post("/api/v1/hosts/onboarding")
    .set("authorization", token("dev-host"))
    .send({ publicName: "Dev Host", submit: true });
  assert.equal(early.status, 409);
  assert.equal(
    textField(record(early.body).error, "code"),
    "IDENTITY_DOCUMENT_REQUIRED",
  );

  const document = await request(app)
    .post("/api/v1/hosts/me/documents")
    .set("authorization", token("dev-host"))
    .send({ documentType: "IDENTITY" });
  assert.equal(document.status, 201);
  assert.equal(
    textField(record(document.body).upload, "status"),
    "unavailable",
  );
  assert.equal(JSON.stringify(document.body).includes("private://"), false);

  const submitted = await request(app)
    .post("/api/v1/hosts/onboarding")
    .set("authorization", token("dev-host"))
    .send({
      publicName: "Dev Host",
      submit: true,
      verificationStatus: "VERIFIED",
    });
  assert.equal(submitted.status, 400);

  const pending = await request(app)
    .post("/api/v1/hosts/onboarding")
    .set("authorization", token("dev-host"))
    .send({ publicName: "Dev Host", submit: true });
  assert.equal(pending.status, 200);
  assert.equal(textField(pending.body, "verificationStatus"), "PENDING");

  const opsDecision = await request(app)
    .post(`/api/v1/admin/hosts/${hostId}/verification`)
    .set("authorization", token("dev-operations"))
    .send({ decision: "APPROVE", reason: "Operations cannot verify hosts." });
  assert.equal(opsDecision.status, 403);

  const approved = await request(app)
    .post(`/api/v1/admin/hosts/${hostId}/verification`)
    .set("authorization", token("dev-verification"))
    .send({ decision: "APPROVE", reason: "Development identity accepted." });
  assert.equal(approved.status, 200);
  assert.equal(textField(approved.body, "verificationStatus"), "VERIFIED");
  assert.equal(textField(approved.body, "publicProfileStatus"), "VISIBLE");

  const documents = await request(app)
    .get(`/api/v1/admin/hosts/${hostId}/documents`)
    .set("authorization", token("dev-verification"));
  assert.equal(documents.status, 200);
  const reviewed = recordsField(documents.body, "items");
  assert.equal(textField(reviewed[0]?.access, "scheme"), "unconfigured");
  assert.equal(JSON.stringify(documents.body).includes("private://"), false);
  assert.equal(
    audit.entries.some((entry) => entry.action === "host.document.read"),
    true,
  );

  const supportDocs = await request(app)
    .get(`/api/v1/admin/hosts/${hostId}/documents`)
    .set("authorization", token("dev-support"));
  assert.equal(supportDocs.status, 403);

  const created = await request(app)
    .post("/api/v1/hosts/me/experiences")
    .set("authorization", token("dev-host"))
    .send(experienceBody(cityId));
  assert.equal(created.status, 201);
  assert.equal(textField(created.body, "listingStatus"), "DRAFT");
  const experienceId = textField(created.body, "id");

  const privileged = await request(app)
    .patch(`/api/v1/hosts/me/experiences/${experienceId}`)
    .set("authorization", token("dev-host"))
    .send({ listingStatus: "PUBLISHED" });
  assert.equal(privileged.status, 400);

  const stolen = await request(app)
    .patch(`/api/v1/hosts/me/experiences/${experienceId}`)
    .set("authorization", token("dev-other-host"))
    .send({ title: "Taken over" });
  assert.equal(stolen.status, 404);
  assert.equal(
    audit.entries.some(
      (entry) =>
        entry.action === "experience.update" && entry.outcome === "DENIED",
    ),
    true,
  );

  const privateRead = await request(app).get(
    `/api/v1/experiences/${experienceId}`,
  );
  assert.equal(privateRead.status, 404);

  const submittedListing = await request(app)
    .post(`/api/v1/hosts/me/experiences/${experienceId}/submit`)
    .set("authorization", token("dev-host"));
  assert.equal(submittedListing.status, 200);
  assert.equal(textField(submittedListing.body, "listingStatus"), "IN_REVIEW");

  const verificationPublish = await request(app)
    .post(`/api/v1/admin/experiences/${experienceId}/moderation`)
    .set("authorization", token("dev-verification"))
    .send({ decision: "PUBLISH", reason: "Verification cannot publish." });
  assert.equal(verificationPublish.status, 403);

  const published = await request(app)
    .post(`/api/v1/admin/experiences/${experienceId}/moderation`)
    .set("authorization", token("dev-operations"))
    .send({
      decision: "PUBLISH",
      reason: "Listing matches the development policy.",
    });
  assert.equal(published.status, 200);
  assert.equal(textField(published.body, "listingStatus"), "PUBLISHED");

  const found = await request(app).get("/api/v1/experiences");
  assert.equal(found.status, 200);
  assert.equal(recordsField(found.body, "items").length, 1);
  assert.equal(JSON.stringify(found.body).includes("example.com"), false);
  assert.equal(JSON.stringify(found.body).includes("private://"), false);

  const profile = await request(app).get(`/api/v1/hosts/${hostId}`);
  assert.equal(profile.status, 200);
  assert.equal(textField(profile.body, "verificationStatus"), "VERIFIED");
  assert.equal(JSON.stringify(profile.body).includes("example.com"), false);
});

test("discovery returns only bookable listings and honours city-local dates", async () => {
  const visibleId = "10000000-0000-4000-8000-000000000021";
  const draftId = "10000000-0000-4000-8000-000000000022";
  const hiddenHostId = "10000000-0000-4000-8000-000000000023";
  const laterId = "10000000-0000-4000-8000-000000000024";
  const slotStart = "2030-01-14T20:30:00.000Z";
  const slotEnd = "2030-01-14T22:30:00.000Z";
  const app = createTestApp({
    ...referenceSeed,
    hosts: [
      hostRecord(hostId, hostUserId, "VERIFIED"),
      hostRecord(otherHostId, otherUserId, "NOT_STARTED"),
    ],
    experiences: [
      listing({
        id: visibleId,
        hostId,
        cityId,
        status: "PUBLISHED",
        createdAt: "2030-01-03T00:00:00.000Z",
        slots: [
          {
            id: "10000000-0000-4000-8000-000000000031",
            startsAt: slotStart,
            endsAt: slotEnd,
            capacity: 4,
            status: "OPEN",
          },
        ],
      }),
      listing({
        id: draftId,
        hostId,
        cityId,
        status: "DRAFT",
        createdAt: "2030-01-02T00:00:00.000Z",
      }),
      listing({
        id: hiddenHostId,
        hostId: otherHostId,
        cityId,
        status: "PUBLISHED",
        createdAt: "2030-01-01T00:00:00.000Z",
      }),
      listing({
        id: laterId,
        hostId,
        cityId,
        status: "PUBLISHED",
        createdAt: "2030-01-04T00:00:00.000Z",
        price: 90000,
        capacity: 2,
      }),
    ],
  });

  const localDay = await request(app).get("/api/v1/experiences").query({
    date: "2030-01-15",
    city: "dev-city",
    verifiedHost: "false",
  });
  assert.equal(localDay.status, 200);
  assert.deepEqual(ids(localDay.body), [visibleId]);

  const utcDay = await request(app)
    .get("/api/v1/experiences")
    .query({ date: "2030-01-14" });
  assert.equal(ids(utcDay.body).length, 0);

  const tooLarge = await request(app)
    .get("/api/v1/experiences")
    .query({ partySize: "5" });
  assert.equal(ids(tooLarge.body).includes(visibleId), false);

  const priced = await request(app)
    .get("/api/v1/experiences")
    .query({ maxPrice: "100000" });
  assert.deepEqual(ids(priced.body), [laterId]);

  const first = await request(app)
    .get("/api/v1/experiences")
    .query({ limit: "1" });
  assert.deepEqual(ids(first.body), [laterId]);
  const nextCursor = textField(first.body, "nextCursor");

  const second = await request(app)
    .get("/api/v1/experiences")
    .query({ limit: "1", cursor: nextCursor });
  assert.deepEqual(ids(second.body), [visibleId]);

  const availability = await request(app)
    .get(`/api/v1/experiences/${visibleId}/availability`)
    .query({ from: "2030-01-15", to: "2030-01-15" });
  assert.equal(availability.status, 200);
  assert.equal(textField(availability.body, "timezone"), "Asia/Kolkata");
  assert.equal(recordsField(availability.body, "slots").length, 1);

  const draft = await request(app).get(`/api/v1/experiences/${draftId}`);
  assert.equal(draft.status, 404);
});

test("availability rejects overlapping slots and slots inside a blackout", async () => {
  const app = createTestApp({
    ...referenceSeed,
    hosts: [hostRecord(hostId, hostUserId, "VERIFIED")],
  });
  const created = await request(app)
    .post("/api/v1/hosts/me/experiences")
    .set("authorization", token("dev-host"))
    .send(experienceBody(cityId));
  assert.equal(created.status, 201);
  const experienceId = textField(created.body, "id");

  const overlap = await request(app)
    .put(`/api/v1/hosts/me/experiences/${experienceId}/availability`)
    .set("authorization", token("dev-host"))
    .send({
      slots: [
        {
          startsAt: "2030-01-15T04:30:00.000Z",
          endsAt: "2030-01-15T06:30:00.000Z",
          capacity: 2,
        },
        {
          startsAt: "2030-01-15T05:30:00.000Z",
          endsAt: "2030-01-15T07:30:00.000Z",
          capacity: 2,
        },
      ],
      blackouts: [],
    });
  assert.equal(overlap.status, 400);

  const blackout = await request(app)
    .put(`/api/v1/hosts/me/experiences/${experienceId}/availability`)
    .set("authorization", token("dev-host"))
    .send({
      slots: [
        {
          startsAt: "2030-01-15T04:30:00.000Z",
          endsAt: "2030-01-15T06:30:00.000Z",
          capacity: 2,
        },
      ],
      blackouts: [
        {
          startsAt: "2030-01-15T04:00:00.000Z",
          endsAt: "2030-01-15T08:00:00.000Z",
        },
      ],
    });
  assert.equal(blackout.status, 400);

  const saved = await request(app)
    .put(`/api/v1/hosts/me/experiences/${experienceId}/availability`)
    .set("authorization", token("dev-host"))
    .send({
      slots: [
        {
          startsAt: "2030-01-15T04:30:00.000Z",
          endsAt: "2030-01-15T06:30:00.000Z",
          capacity: 2,
        },
      ],
      blackouts: [
        {
          startsAt: "2030-01-16T04:00:00.000Z",
          endsAt: "2030-01-16T08:00:00.000Z",
        },
      ],
    });
  assert.equal(saved.status, 200);
  const savedSlots = recordsField(saved.body, "slots");
  assert.equal(savedSlots.length, 1);
  assert.equal(savedSlots[0]?.status, "OPEN");
});
