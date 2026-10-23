import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl === undefined ? "TEST_DATABASE_URL is not set" : false;

let prisma: PrismaClient | undefined;

test.before(async () => {
  if (databaseUrl === undefined) {
    return;
  }
  process.env.DATABASE_URL = databaseUrl;
  const client = await import("@prisma/client");
  prisma = new client.PrismaClient();
  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
  `;
  assert.ok(
    rows.some((row) => row.migration_name.includes("domain_foundation")),
    "Apply prisma migrate deploy before constraint tests.",
  );
});

test.after(async () => {
  await prisma?.$disconnect();
});

type Tx = Prisma.TransactionClient;

test(
  "foreign keys, self-booking, capacity, ledger, refunds and payouts are enforced",
  { skip },
  async () => {
    assert.ok(prisma);
    const db = prisma;

    await assert.rejects(
      db.$transaction((tx) => createBookingGraph(tx, { self: true })),
      /host cannot accept own booking/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        const graph = await createBookingGraph(tx);
        const slotId = randomUUID();
        await tx.experienceSlot.create({
          data: {
            id: slotId,
            experienceId: graph.experienceId,
            startsAt: new Date("2026-12-01T04:30:00.000Z"),
            endsAt: new Date("2026-12-01T06:30:00.000Z"),
            capacity: 1,
          },
        });
        await tx.slotReservation.create({
          data: {
            slotId,
            bookingId: graph.bookingId,
            quantity: 1,
            state: "HELD",
            expiresAt: new Date("2026-12-01T04:00:00.000Z"),
          },
        });
        await tx.slotReservation.create({
          data: {
            slotId,
            bookingId: graph.bookingId,
            quantity: 1,
            state: "CONFIRMED",
          },
        });
      }),
      /slot capacity exceeded/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        await createUnbalancedLedger(tx);
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      }),
      /ledger transaction is not balanced/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        await createBalancedLedger(tx);
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
        throw new Error("rollback-test");
      }),
      /rollback-test/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        const graph = await createBookingGraph(tx);
        await tx.paymentAttempt.create({
          data: {
            bookingId: graph.bookingId,
            provider: "unconfigured",
            amountMinor: 500,
            currency: "INR",
            status: "SUCCEEDED",
            idempotencyKey: randomUUID(),
          },
        });
        await tx.refund.create({
          data: {
            bookingId: graph.bookingId,
            provider: "unconfigured",
            amountMinor: 600,
            reasonCode: "TEST",
          },
        });
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      }),
      /refund total exceeds captured amount/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        const graph = await createBookingGraph(tx, { hostGrossMinor: 100 });
        const payout = await tx.payout.create({
          data: {
            hostId: graph.hostId,
            provider: "unconfigured",
            amountMinor: 100,
            currency: "INR",
          },
        });
        await tx.payoutAllocation.create({
          data: {
            payoutId: payout.id,
            bookingId: graph.bookingId,
            amountMinor: 101,
          },
        });
        await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      }),
      /payout allocation exceeds payout amount/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        const eventId = randomUUID();
        await tx.webhookEvent.create({
          data: {
            provider: "unconfigured",
            providerEventId: eventId,
            signatureValid: true,
            processingStatus: "VERIFIED",
          },
        });
        await tx.webhookEvent.create({
          data: {
            provider: "unconfigured",
            providerEventId: eventId,
            signatureValid: false,
            processingStatus: "REJECTED",
          },
        });
      }),
      /Unique constraint/,
    );

    await assert.rejects(
      db.$transaction(async (tx) => {
        const row = await tx.auditLog.create({
          data: {
            action: "user.read",
            resourceType: "user",
            resourceId: randomUUID(),
            requestId: "migration-test",
            outcome: "DENIED",
          },
        });
        await tx.auditLog.delete({ where: { id: row.id } });
      }),
      /audit_logs is append-only/,
    );
  },
);

test("concurrent holds cannot oversell the last slot", { skip }, async () => {
  assert.ok(prisma);
  const db = prisma;
  const slotId = randomUUID();
  const secondBookingId = randomUUID();
  const graph = await db.$transaction((tx) => createBookingGraph(tx));
  const created: string[] = [graph.bookingId];
  try {
    await db.experienceSlot.create({
      data: {
        id: slotId,
        experienceId: graph.experienceId,
        startsAt: new Date("2026-12-01T04:30:00.000Z"),
        endsAt: new Date("2026-12-01T06:30:00.000Z"),
        capacity: 1,
      },
    });
    const second = await db.booking.create({
      data: {
        travellerId: (
          await db.booking.findUniqueOrThrow({
            where: { id: graph.bookingId },
            select: { travellerId: true, hostId: true },
          })
        ).travellerId,
        hostId: (
          await db.booking.findUniqueOrThrow({
            where: { id: graph.bookingId },
            select: { hostId: true },
          })
        ).hostId,
        experienceId: graph.experienceId,
        id: secondBookingId,
        startsAt: new Date("2026-12-02T04:30:00.000Z"),
        endsAt: new Date("2026-12-02T06:30:00.000Z"),
        participantCount: 1,
        currency: "INR",
        subtotalMinor: 1000,
        totalMinor: 1000,
        commissionMinor: 0,
        hostGrossMinor: 1000,
        cancellationPolicySnapshot: { fixture: true },
        experienceSnapshot: { fixture: true },
      },
    });
    created.push(second.id);
    const expiresAt = new Date("2099-01-01T00:00:00.000Z");
    const results = await Promise.allSettled([
      db.$transaction((tx) =>
        tx.slotReservation.create({
          data: {
            slotId,
            bookingId: graph.bookingId,
            quantity: 1,
            state: "HELD",
            expiresAt,
          },
        }),
      ),
      db.$transaction((tx) =>
        tx.slotReservation.create({
          data: {
            slotId,
            bookingId: second.id,
            quantity: 1,
            state: "HELD",
            expiresAt,
          },
        }),
      ),
    ]);
    const succeeded = results.filter((result) => result.status === "fulfilled");
    assert.equal(succeeded.length, 1);
    const held = await db.slotReservation.count({
      where: { slotId, state: "HELD" },
    });
    assert.equal(held, 1);
  } finally {
    const experience = await db.experience.findUnique({
      where: { id: graph.experienceId },
      select: { cityId: true },
    });
    const host = await db.hostProfile.findUnique({
      where: { id: graph.hostId },
      select: { userId: true },
    });
    const booking = await db.booking.findUnique({
      where: { id: graph.bookingId },
      select: { travellerId: true },
    });
    await db.slotReservation.deleteMany({ where: { slotId } });
    await db.booking.deleteMany({ where: { id: { in: created } } });
    await db.experienceSlot.deleteMany({ where: { id: slotId } });
    await db.experience.deleteMany({ where: { id: graph.experienceId } });
    await db.hostProfile.deleteMany({ where: { id: graph.hostId } });
    if (experience !== null) {
      await db.city.deleteMany({ where: { id: experience.cityId } });
    }
    const userIds = [host?.userId, booking?.travellerId].filter(
      (id): id is string => id !== undefined,
    );
    if (userIds.length > 0) {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }
});

async function createBookingGraph(
  tx: Tx,
  options: { self?: boolean; hostGrossMinor?: number } = {},
): Promise<{ bookingId: string; hostId: string; experienceId: string }> {
  const travellerId = randomUUID();
  const hostUserId = options.self === true ? travellerId : randomUUID();
  const hostId = randomUUID();
  const cityId = randomUUID();
  const experienceId = randomUUID();
  const bookingId = randomUUID();
  const snapshot = { fixture: true };

  await tx.user.create({
    data: {
      id: travellerId,
      email: `${travellerId}@example.com`,
      authProvider: "test",
      authSubject: travellerId,
    },
  });
  if (options.self !== true) {
    await tx.user.create({
      data: {
        id: hostUserId,
        email: `${hostUserId}@example.com`,
        authProvider: "test",
        authSubject: hostUserId,
      },
    });
  }
  await tx.hostProfile.create({
    data: { id: hostId, userId: hostUserId, publicName: "Test Host" },
  });
  await tx.city.create({
    data: {
      id: cityId,
      slug: cityId,
      name: "Test City",
      state: "Test",
      countryCode: "IN",
      timezone: "Asia/Kolkata",
    },
  });
  await tx.experience.create({
    data: {
      id: experienceId,
      hostId,
      cityId,
      category: "food",
      title: "Test walk",
      description: "Development fixture",
      durationMinutes: 60,
      basePriceMinor: 1000,
      currency: "INR",
      capacity: 4,
      inclusions: "tea",
      exclusions: "transport",
      meetingArea: "a public square",
    },
  });
  await tx.booking.create({
    data: {
      id: bookingId,
      travellerId,
      hostId,
      experienceId,
      startsAt: new Date("2026-12-01T04:30:00.000Z"),
      endsAt: new Date("2026-12-01T06:30:00.000Z"),
      participantCount: 1,
      currency: "INR",
      subtotalMinor: 1000,
      totalMinor: 1000,
      commissionMinor: 0,
      hostGrossMinor: options.hostGrossMinor ?? 1000,
      cancellationPolicySnapshot: snapshot,
      experienceSnapshot: snapshot,
    },
  });
  return { bookingId, hostId, experienceId };
}

async function createUnbalancedLedger(tx: Tx): Promise<void> {
  const account = await tx.ledgerAccount.create({
    data: {
      code: `test-${randomUUID()}`,
      accountType: "LIABILITY",
      currency: "INR",
    },
  });
  const transaction = await tx.ledgerTransaction.create({
    data: {
      transactionType: "ADJUSTMENT",
      idempotencyKey: randomUUID(),
      currency: "INR",
    },
  });
  await tx.ledgerEntry.create({
    data: {
      transactionId: transaction.id,
      accountId: account.id,
      debitMinor: 100,
      creditMinor: 0,
    },
  });
}

async function createBalancedLedger(tx: Tx): Promise<void> {
  const debit = await tx.ledgerAccount.create({
    data: {
      code: `test-debit-${randomUUID()}`,
      accountType: "ASSET",
      currency: "INR",
    },
  });
  const credit = await tx.ledgerAccount.create({
    data: {
      code: `test-credit-${randomUUID()}`,
      accountType: "LIABILITY",
      currency: "INR",
    },
  });
  const transaction = await tx.ledgerTransaction.create({
    data: {
      transactionType: "ADJUSTMENT",
      idempotencyKey: randomUUID(),
      currency: "INR",
    },
  });
  await tx.ledgerEntry.create({
    data: {
      transactionId: transaction.id,
      accountId: debit.id,
      debitMinor: 100,
      creditMinor: 0,
    },
  });
  await tx.ledgerEntry.create({
    data: {
      transactionId: transaction.id,
      accountId: credit.id,
      debitMinor: 0,
      creditMinor: 100,
    },
  });
}
