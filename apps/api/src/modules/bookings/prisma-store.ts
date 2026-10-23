import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../../shared/http-error.js";
import {
  duplicateOffer,
  idempotencyConflict,
  selfBooking,
  unavailable,
} from "./errors.js";
import { outboxType, isBookingStatus, type BookingStatus } from "./state.js";
import type { BookingDatabase, BookingTx } from "./tx.js";
import type {
  BookingRow,
  CheckInMethod,
  CityRow,
  EventRow,
  HostGate,
  IdempotencyRow,
  OfferRow,
  OfferStatus,
  PolicyRow,
  ReservationRow,
  ReservationState,
  SlotContext,
  TripPreferences,
  TripRequestRow,
  TripRequestStatus,
} from "./types.js";

const bookingInclude = {
  host: { select: { userId: true } },
  reservations: true,
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

type BookingRecord = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export class PrismaBookingStore implements BookingDatabase {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(run: (tx: BookingTx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction((tx) =>
        run(new PrismaBookingTx(tx)),
      );
    } catch (error: unknown) {
      throw mapWriteError(error);
    }
  }
}

class PrismaBookingTx implements BookingTx {
  constructor(private readonly db: Prisma.TransactionClient) {}

  checkpoint(): Promise<void> {
    return Promise.resolve();
  }

  async exclusive<T>(
    keys: readonly string[],
    run: () => Promise<T>,
  ): Promise<T> {
    for (const key of [...new Set(keys)].sort()) {
      const split = key.indexOf(":");
      const kind = split < 0 ? key : key.slice(0, split);
      const id = split < 0 ? "" : key.slice(split + 1);
      if (kind === "slot") {
        await this.lock("experience_slots", id);
      } else if (kind === "request") {
        await this.lock("trip_requests", id);
      } else if (kind === "offer") {
        await this.lock("offers", id);
      } else if (kind === "booking") {
        await this.lock("bookings", id);
      }
    }
    return run();
  }

  async findIdempotency(
    actorUserId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRow | null> {
    const row = await this.db.commandIdempotency.findUnique({
      where: {
        actorUserId_scope_idempotencyKey: {
          actorUserId,
          scope,
          idempotencyKey,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      scope: row.scope,
      idempotencyKey: row.idempotencyKey,
      requestHash: row.requestHash,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async insertIdempotency(row: IdempotencyRow): Promise<void> {
    await this.db.commandIdempotency.create({
      data: {
        id: row.id,
        actorUserId: row.actorUserId,
        scope: row.scope,
        idempotencyKey: row.idempotencyKey,
        requestHash: row.requestHash,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async findCity(id: string): Promise<CityRow | null> {
    const row = await this.db.city.findUnique({ where: { id } });
    if (row === null) {
      return null;
    }
    return { id: row.id, timezone: row.timezone, status: row.status };
  }

  async insertTripRequest(row: TripRequestRow): Promise<void> {
    await this.db.tripRequest.create({
      data: {
        id: row.id,
        travellerId: row.travellerId,
        cityId: row.cityId,
        startsOn: asDay(row.startsOn),
        endsOn: asDay(row.endsOn),
        partySize: row.partySize,
        budgetMinor: row.budgetMinor,
        currency: row.currency,
        preferences: preferencesJson(row.preferences),
        status: row.status,
        expiresAt: new Date(row.expiresAt),
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async findTripRequest(id: string): Promise<TripRequestRow | null> {
    const row = await this.db.tripRequest.findUnique({ where: { id } });
    return row === null ? null : toTripRequest(row);
  }

  async updateTripRequestStatus(
    id: string,
    status: TripRequestStatus,
  ): Promise<void> {
    await this.db.tripRequest.update({ where: { id }, data: { status } });
  }

  async hostGate(userId: string, cityId: string): Promise<HostGate | null> {
    const host = await this.db.hostProfile.findUnique({ where: { userId } });
    if (host === null) {
      return null;
    }
    const published = await this.db.experience.count({
      where: { hostId: host.id, cityId, listingStatus: "PUBLISHED" },
    });
    return {
      hostId: host.id,
      userId: host.userId,
      eligible:
        host.verificationStatus === "VERIFIED" &&
        host.publicProfileStatus === "VISIBLE" &&
        published > 0,
    };
  }

  async findPendingOffer(
    requestId: string,
    hostId: string,
  ): Promise<OfferRow | null> {
    const row = await this.db.offer.findFirst({
      where: { requestId, hostId, status: "PENDING" },
      include: { host: { select: { userId: true } } },
    });
    return row === null ? null : toOffer(row);
  }

  async insertOffer(row: OfferRow): Promise<void> {
    await this.db.offer.create({
      data: {
        id: row.id,
        requestId: row.requestId,
        hostId: row.hostId,
        proposedStartsAt: new Date(row.proposedStartsAt),
        proposedEndsAt: new Date(row.proposedEndsAt),
        priceMinor: row.priceMinor,
        currency: row.currency,
        inclusions: row.inclusions,
        exclusions: row.exclusions,
        policySnapshot: {
          cancellationPolicy: row.cancellationPolicy,
        },
        expiresAt: new Date(row.expiresAt),
        status: row.status,
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async findOffer(id: string): Promise<OfferRow | null> {
    const row = await this.db.offer.findUnique({
      where: { id },
      include: { host: { select: { userId: true } } },
    });
    return row === null ? null : toOffer(row);
  }

  async updateOfferStatus(id: string, status: OfferStatus): Promise<void> {
    await this.db.offer.update({ where: { id }, data: { status } });
  }

  async rejectOtherOffers(
    requestId: string,
    acceptedOfferId: string,
  ): Promise<void> {
    await this.db.offer.updateMany({
      where: { requestId, status: "PENDING", id: { not: acceptedOfferId } },
      data: { status: "REJECTED" },
    });
  }

  async findBooking(id: string): Promise<BookingRow | null> {
    const row = await this.db.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    return row === null ? null : toBooking(row);
  }

  async findBookingByOffer(offerId: string): Promise<BookingRow | null> {
    const row = await this.db.booking.findUnique({
      where: { offerId },
      include: bookingInclude,
    });
    return row === null ? null : toBooking(row);
  }

  async listOffers(requestId: string): Promise<OfferRow[]> {
    const rows = await this.db.offer.findMany({
      where: { requestId },
      include: { host: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOffer);
  }

  async listBookingsForTraveller(userId: string): Promise<BookingRow[]> {
    const rows = await this.db.booking.findMany({
      where: { travellerId: userId },
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toBooking);
  }

  async listBookingsForHostUser(userId: string): Promise<BookingRow[]> {
    const rows = await this.db.booking.findMany({
      where: { host: { userId } },
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toBooking);
  }

  async loadSlot(
    experienceId: string,
    slotId: string,
  ): Promise<SlotContext | null> {
    const experience = await this.db.experience.findUnique({
      where: { id: experienceId },
      include: {
        host: true,
        city: true,
        blackouts: true,
        slots: { where: { id: slotId } },
      },
    });
    const slot = experience?.slots[0];
    if (experience === null || slot === undefined) {
      return null;
    }
    return {
      experienceId: experience.id,
      hostId: experience.hostId,
      hostUserId: experience.host.userId,
      cityId: experience.cityId,
      cityTimezone: experience.city.timezone,
      listingStatus: experience.listingStatus,
      hostVerificationStatus: experience.host.verificationStatus,
      hostPublicProfileStatus: experience.host.publicProfileStatus,
      cityStatus: experience.city.status,
      title: experience.title,
      inclusions: experience.inclusions,
      exclusions: experience.exclusions,
      meetingArea: experience.meetingArea,
      cancellationPolicy: experience.cancellationPolicy,
      basePriceMinor: experience.basePriceMinor,
      currency: experience.currency,
      slotId: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      slotStatus: slot.status,
      blackouts: experience.blackouts.map((blackout) => ({
        startsAt: blackout.startsAt.toISOString(),
        endsAt: blackout.endsAt.toISOString(),
      })),
    };
  }

  async activePolicy(now: Date): Promise<PolicyRow | null> {
    const row = await this.db.commissionPolicy.findFirst({
      where: {
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (row === null) {
      return null;
    }
    return {
      id: row.id,
      version: row.version,
      rateBps: row.rateBps,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo:
        row.effectiveTo === null ? null : row.effectiveTo.toISOString(),
    };
  }

  async expireDueHolds(slotId: string, now: Date): Promise<void> {
    const stale = await this.db.slotReservation.findMany({
      where: { slotId, state: "HELD", expiresAt: { lte: now } },
    });
    for (const reservation of stale) {
      await this.db.slotReservation.update({
        where: { id: reservation.id },
        data: { state: "EXPIRED" },
      });
      const changed = await this.db.booking.updateMany({
        where: { id: reservation.bookingId, status: "AWAITING_PAYMENT" },
        data: { status: "EXPIRED" },
      });
      if (changed.count !== 1) {
        continue;
      }
      const createdAt = now;
      await this.db.bookingEvent.create({
        data: {
          id: randomUUID(),
          bookingId: reservation.bookingId,
          eventType: outboxType("EXPIRED"),
          metadata: { status: "EXPIRED" },
          createdAt,
        },
      });
      await this.db.outboxEvent.create({
        data: {
          id: randomUUID(),
          eventType: outboxType("EXPIRED"),
          aggregateId: reservation.bookingId,
          payload: { bookingId: reservation.bookingId, status: "EXPIRED" },
          createdAt,
        },
      });
    }
  }

  async activeQuantity(slotId: string, now: Date): Promise<number> {
    const rows = await this.db.slotReservation.findMany({
      where: {
        slotId,
        state: { in: ["HELD", "CONFIRMED"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { quantity: true },
    });
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  }

  async insertBooking(row: BookingRow): Promise<void> {
    await this.db.booking.create({
      data: {
        id: row.id,
        travellerId: row.travellerId,
        hostId: row.hostId,
        experienceId: row.experienceId,
        offerId: row.offerId,
        status: row.status,
        startsAt: new Date(row.startsAt),
        endsAt: new Date(row.endsAt),
        participantCount: row.participantCount,
        currency: row.currency,
        subtotalMinor: row.subtotalMinor,
        discountMinor: row.discountMinor,
        taxMinor: row.taxMinor,
        totalMinor: row.totalMinor,
        commissionPolicyId: row.commissionPolicyId,
        commissionMinor: row.commissionMinor,
        hostGrossMinor: row.hostGrossMinor,
        cancellationPolicySnapshot: {
          text: row.cancellationPolicy,
          capturedAt: row.termsCapturedAt,
        },
        experienceSnapshot: {
          pricingBasis: row.pricingBasis,
          title: row.title,
          inclusions: row.inclusions,
          exclusions: row.exclusions,
          meetingArea: row.meetingArea,
          commissionVersion: row.commissionVersion,
        },
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async insertReservation(row: ReservationRow): Promise<void> {
    await this.db.slotReservation.create({
      data: {
        id: row.id,
        slotId: row.slotId,
        bookingId: row.bookingId,
        quantity: row.quantity,
        expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt),
        state: row.state,
      },
    });
  }

  async insertEvent(row: EventRow): Promise<void> {
    await this.db.bookingEvent.create({
      data: {
        id: row.id,
        bookingId: row.bookingId,
        eventType: row.eventType,
        actorId: row.actorId,
        metadata: { eventType: row.eventType },
        createdAt: new Date(row.createdAt),
      },
    });
  }

  async insertOutbox(
    id: string,
    eventType: string,
    aggregateId: string,
    payload: { bookingId: string; status: string },
    createdAt: string,
  ): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id,
        eventType,
        aggregateId,
        payload,
        createdAt: new Date(createdAt),
      },
    });
  }

  async insertCheckIn(input: {
    id: string;
    bookingId: string;
    actorId: string;
    method: CheckInMethod;
    verifiedAt: string;
  }): Promise<void> {
    await this.db.checkIn.create({
      data: {
        id: input.id,
        bookingId: input.bookingId,
        actorId: input.actorId,
        method: input.method,
        verifiedAt: new Date(input.verifiedAt),
        policyResult: "ACCEPTED",
      },
    });
  }

  async updateBookingStatusIf(
    id: string,
    from: BookingStatus,
    to: BookingStatus,
  ): Promise<boolean> {
    const result = await this.db.booking.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    return result.count === 1;
  }

  async releaseReservations(bookingId: string): Promise<void> {
    await this.db.slotReservation.updateMany({
      where: { bookingId, state: { in: ["HELD", "CONFIRMED"] } },
      data: { state: "RELEASED" },
    });
  }

  async hasCheckIn(bookingId: string): Promise<boolean> {
    const count = await this.db.checkIn.count({ where: { bookingId } });
    return count > 0;
  }

  private async lock(
    table: "experience_slots" | "trip_requests" | "offers" | "bookings",
    id: string,
  ): Promise<void> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return;
    }
    if (table === "experience_slots") {
      await this.db
        .$queryRaw`SELECT id FROM experience_slots WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
      return;
    }
    if (table === "trip_requests") {
      await this.db
        .$queryRaw`SELECT id FROM trip_requests WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
      return;
    }
    if (table === "offers") {
      await this.db
        .$queryRaw`SELECT id FROM offers WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
      return;
    }
    await this.db
      .$queryRaw`SELECT id FROM bookings WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
  }
}

function mapWriteError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error;
  }
  const text = error instanceof Error ? error.message : "";
  if (text.includes("slot capacity exceeded")) {
    return unavailable();
  }
  if (text.includes("host cannot accept own booking")) {
    return selfBooking();
  }
  if (text.includes("offers_one_pending_per_host")) {
    return duplicateOffer();
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    text.includes("command_idempotency")
  ) {
    return idempotencyConflict();
  }
  return error;
}

function toTripRequest(row: {
  id: string;
  travellerId: string;
  cityId: string;
  startsOn: Date;
  endsOn: Date;
  partySize: number;
  budgetMinor: number | null;
  currency: string;
  preferences: Prisma.JsonValue;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}): TripRequestRow {
  return {
    id: row.id,
    travellerId: row.travellerId,
    cityId: row.cityId,
    startsOn: readDay(row.startsOn),
    endsOn: readDay(row.endsOn),
    partySize: row.partySize,
    budgetMinor: row.budgetMinor,
    currency: row.currency,
    preferences: readPreferences(row.preferences),
    status: requestStatus(row.status),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toOffer(row: {
  id: string;
  requestId: string;
  hostId: string;
  host: { userId: string };
  proposedStartsAt: Date;
  proposedEndsAt: Date;
  priceMinor: number;
  currency: string;
  inclusions: string;
  exclusions: string;
  policySnapshot: Prisma.JsonValue;
  expiresAt: Date;
  status: string;
  createdAt: Date;
}): OfferRow {
  return {
    id: row.id,
    requestId: row.requestId,
    hostId: row.hostId,
    hostUserId: row.host.userId,
    proposedStartsAt: row.proposedStartsAt.toISOString(),
    proposedEndsAt: row.proposedEndsAt.toISOString(),
    priceMinor: row.priceMinor,
    currency: row.currency,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    cancellationPolicy: jsonText(row.policySnapshot, "cancellationPolicy"),
    expiresAt: row.expiresAt.toISOString(),
    status: offerStatus(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

function toBooking(row: BookingRecord): BookingRow {
  const reservation = [...row.reservations].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0];
  const basis = jsonText(row.experienceSnapshot, "pricingBasis");
  return {
    id: row.id,
    travellerId: row.travellerId,
    hostId: row.hostId,
    hostUserId: row.host.userId,
    experienceId: row.experienceId,
    offerId: row.offerId,
    status: bookingStatus(row.status),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    participantCount: row.participantCount,
    currency: row.currency,
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    taxMinor: row.taxMinor,
    totalMinor: row.totalMinor,
    commissionPolicyId: row.commissionPolicyId,
    commissionVersion: blankToNull(
      jsonText(row.experienceSnapshot, "commissionVersion"),
    ),
    commissionMinor: row.commissionMinor,
    hostGrossMinor: row.hostGrossMinor,
    pricingBasis: basis === "OFFER_TOTAL" ? "OFFER_TOTAL" : "LISTED_TOTAL",
    title: jsonText(row.experienceSnapshot, "title"),
    inclusions: jsonText(row.experienceSnapshot, "inclusions"),
    exclusions: jsonText(row.experienceSnapshot, "exclusions"),
    meetingArea: jsonText(row.experienceSnapshot, "meetingArea"),
    cancellationPolicy: jsonText(row.cancellationPolicySnapshot, "text"),
    termsCapturedAt: jsonText(row.cancellationPolicySnapshot, "capturedAt"),
    createdAt: row.createdAt.toISOString(),
    reservation: reservation === undefined ? null : toReservation(reservation),
    events: row.events.map((event) => ({
      id: event.id,
      bookingId: event.bookingId,
      eventType: event.eventType,
      actorId: event.actorId,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function toReservation(row: {
  id: string;
  slotId: string;
  bookingId: string;
  quantity: number;
  expiresAt: Date | null;
  state: string;
}): ReservationRow {
  return {
    id: row.id,
    slotId: row.slotId,
    bookingId: row.bookingId,
    quantity: row.quantity,
    expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
    state: reservationState(row.state),
  };
}

function preferencesJson(value: TripPreferences): Prisma.InputJsonObject {
  return {
    ...(value.interests === undefined
      ? {}
      : { interests: [...value.interests] }),
    ...(value.languages === undefined
      ? {}
      : { languages: [...value.languages] }),
    ...(value.accessibility === undefined
      ? {}
      : { accessibility: value.accessibility }),
    ...(value.notes === undefined ? {} : { notes: value.notes }),
  };
}

function readPreferences(value: Prisma.JsonValue): TripPreferences {
  const record = jsonRecord(value);
  const preferences: TripPreferences = {};
  const interests = stringArray(record.interests);
  const languages = stringArray(record.languages);
  if (interests !== undefined) {
    preferences.interests = interests;
  }
  if (languages !== undefined) {
    preferences.languages = languages;
  }
  if (typeof record.accessibility === "string") {
    preferences.accessibility = record.accessibility;
  }
  if (typeof record.notes === "string") {
    preferences.notes = record.notes;
  }
  return preferences;
}

function stringArray(
  value: Prisma.JsonValue | undefined,
): string[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    return undefined;
  }
  return value;
}

function jsonText(value: Prisma.JsonValue, key: string): string {
  const field = jsonRecord(value)[key];
  return typeof field === "string" ? field : "";
}

function jsonRecord(
  value: Prisma.JsonValue,
): Record<string, Prisma.JsonValue | undefined> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value;
}

function asDay(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

function readDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function requestStatus(value: string): TripRequestStatus {
  if (
    value === "OPEN" ||
    value === "CLOSED" ||
    value === "EXPIRED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  throw new Error("Stored trip request status is invalid.");
}

function offerStatus(value: string): OfferStatus {
  if (
    value === "PENDING" ||
    value === "ACCEPTED" ||
    value === "WITHDRAWN" ||
    value === "EXPIRED" ||
    value === "REJECTED"
  ) {
    return value;
  }
  throw new Error("Stored offer status is invalid.");
}

function bookingStatus(value: string): BookingStatus {
  if (!isBookingStatus(value)) {
    throw new Error("Stored booking status is invalid.");
  }
  return value;
}

function blankToNull(value: string): string | null {
  return value === "" ? null : value;
}

function reservationState(value: string): ReservationState {
  if (
    value === "HELD" ||
    value === "CONFIRMED" ||
    value === "RELEASED" ||
    value === "EXPIRED"
  ) {
    return value;
  }
  throw new Error("Stored reservation state is invalid.");
}
