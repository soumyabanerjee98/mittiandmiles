import { randomUUID } from "node:crypto";
import { isBlackedOut, localDate } from "../catalogue/time.js";
import {
  IDEMPOTENCY_SCOPE_BOOKING,
  IDEMPOTENCY_SCOPE_REQUEST,
  MAX_OFFER_DURATION_MS,
  MAX_OFFER_TTL_MS,
  SLOT_HOLD_MS,
  TRIP_REQUEST_TTL_MS,
} from "./constants.js";
import {
  duplicateOffer,
  forbidden,
  hidden,
  idempotencyConflict,
  invalid,
  invalidState,
  notFound,
  offerExpired,
  requestExpired,
  selfBooking,
  unavailable,
} from "./errors.js";
import { quoteTotal, type PriceQuote } from "./quote.js";
import {
  decideTransition,
  outboxType,
  type BookingAction,
  type BookingStatus,
} from "./state.js";
import type { BookingTx } from "./tx.js";
import type {
  BookingRow,
  CheckInMethod,
  EventRow,
  OfferRow,
  ReservationRow,
  SlotContext,
  TripPreferences,
  TripRequestRow,
} from "./types.js";

export type Ok<T> = { replayed: boolean; value: T };

type IdempotencyCommand = {
  actorUserId: string;
  idempotencyKey: string;
  requestHash: string;
};

export async function createTripRequest(
  tx: BookingTx,
  command: IdempotencyCommand & {
    cityId: string;
    startsOn: string;
    endsOn: string;
    partySize: number;
    budgetMinor: number | null;
    currency: string;
    preferences: TripPreferences;
  },
  now: Date,
): Promise<Ok<TripRequestRow>> {
  return tx.exclusive(
    [
      idempotencyLock(
        command.actorUserId,
        IDEMPOTENCY_SCOPE_REQUEST,
        command.idempotencyKey,
      ),
    ],
    async () => {
      const existing = await replayTripRequest(tx, command);
      if (existing !== null) {
        return existing;
      }
      const city = await tx.findCity(command.cityId);
      if (city === null || city.status !== "ACTIVE") {
        throw notFound();
      }
      const today = localDate(now, city.timezone);
      if (command.endsOn < today || command.startsOn > command.endsOn) {
        throw invalid(command.endsOn < today ? "endsOn" : "startsOn");
      }
      const row: TripRequestRow = {
        id: randomUUID(),
        travellerId: command.actorUserId,
        cityId: command.cityId,
        startsOn: command.startsOn,
        endsOn: command.endsOn,
        partySize: command.partySize,
        budgetMinor: command.budgetMinor,
        currency: command.currency,
        preferences: command.preferences,
        status: "OPEN",
        expiresAt: new Date(now.getTime() + TRIP_REQUEST_TTL_MS).toISOString(),
        createdAt: now.toISOString(),
      };
      await tx.insertTripRequest(row);
      await tx.insertIdempotency({
        id: randomUUID(),
        actorUserId: command.actorUserId,
        scope: IDEMPOTENCY_SCOPE_REQUEST,
        idempotencyKey: command.idempotencyKey,
        requestHash: command.requestHash,
        resourceType: "trip_request",
        resourceId: row.id,
        createdAt: now.toISOString(),
      });
      return { replayed: false, value: row };
    },
  );
}

export async function readTripRequest(
  tx: BookingTx,
  actorUserId: string,
  requestId: string,
  now: Date,
): Promise<TripRequestRow> {
  const request = await tx.findTripRequest(requestId);
  if (request === null) {
    throw notFound();
  }
  if (request.travellerId === actorUserId) {
    return expireRequestIfNeeded(tx, request, now);
  }
  const gate = await tx.hostGate(actorUserId, request.cityId);
  if (gate === null || !gate.eligible) {
    throw hidden("trip_request", requestId);
  }
  return expireRequestIfNeeded(tx, request, now);
}

export async function createOffer(
  tx: BookingTx,
  command: {
    actorUserId: string;
    requestId: string;
    proposedStartsAt: string;
    proposedEndsAt: string;
    priceMinor: number;
    currency: string;
    inclusions: string;
    exclusions: string;
    cancellationPolicy: string;
    expiresAt: string;
  },
  now: Date,
): Promise<OfferRow> {
  const request = await tx.findTripRequest(command.requestId);
  if (request === null) {
    throw notFound();
  }
  const gate = await tx.hostGate(command.actorUserId, request.cityId);
  if (gate === null || !gate.eligible) {
    throw hidden("trip_request", command.requestId);
  }
  return tx.exclusive(
    [
      `request:${command.requestId}`,
      `host-offer:${command.requestId}:${gate.hostId}`,
    ],
    async () => {
      const current = await tx.findTripRequest(command.requestId);
      if (current === null) {
        throw notFound();
      }
      const open = await expireRequestIfNeeded(tx, current, now);
      if (open.status !== "OPEN") {
        throw open.status === "EXPIRED" ? requestExpired() : invalidState();
      }
      if (open.travellerId === command.actorUserId) {
        throw selfBooking();
      }
      if (command.currency !== open.currency) {
        throw invalid("currency");
      }
      const city = await tx.findCity(open.cityId);
      if (city === null) {
        throw notFound();
      }
      assertOfferWindow(command, open, city.timezone, now);
      const pending = await tx.findPendingOffer(open.id, gate.hostId);
      if (pending !== null) {
        throw duplicateOffer();
      }
      const row: OfferRow = {
        id: randomUUID(),
        requestId: open.id,
        hostId: gate.hostId,
        hostUserId: command.actorUserId,
        proposedStartsAt: command.proposedStartsAt,
        proposedEndsAt: command.proposedEndsAt,
        priceMinor: command.priceMinor,
        currency: command.currency,
        inclusions: command.inclusions,
        exclusions: command.exclusions,
        cancellationPolicy: command.cancellationPolicy,
        expiresAt: command.expiresAt,
        status: "PENDING",
        createdAt: now.toISOString(),
      };
      await tx.insertOffer(row);
      return row;
    },
  );
}

export async function listVisibleOffers(
  tx: BookingTx,
  actorUserId: string,
  requestId: string,
  now: Date,
): Promise<OfferRow[]> {
  const request = await readTripRequest(tx, actorUserId, requestId, now);
  const offers = await tx.listOffers(request.id);
  if (request.travellerId === actorUserId) {
    return offers;
  }
  return offers.filter((offer) => offer.hostUserId === actorUserId);
}

export async function withdrawOffer(
  tx: BookingTx,
  actorUserId: string,
  offerId: string,
  now: Date,
): Promise<OfferRow> {
  return tx.exclusive([`offer:${offerId}`], async () => {
    const offer = await tx.findOffer(offerId);
    if (offer === null || offer.hostUserId !== actorUserId) {
      throw offer === null ? notFound() : hidden("offer", offerId);
    }
    const current = await markOfferExpired(tx, offer, now);
    if (current.status === "EXPIRED") {
      throw offerExpired();
    }
    if (current.status !== "PENDING") {
      throw invalidState();
    }
    await tx.updateOfferStatus(current.id, "WITHDRAWN");
    return { ...current, status: "WITHDRAWN" };
  });
}

export async function acceptOffer(
  tx: BookingTx,
  actorUserId: string,
  offerId: string,
  now: Date,
): Promise<Ok<BookingRow>> {
  const peek = await tx.findOffer(offerId);
  if (peek === null) {
    throw notFound();
  }
  return tx.exclusive(
    [`request:${peek.requestId}`, `offer:${offerId}`],
    async () => {
      const offer = await tx.findOffer(offerId);
      if (offer === null) {
        throw notFound();
      }
      const request = await tx.findTripRequest(offer.requestId);
      if (request === null || request.travellerId !== actorUserId) {
        throw hidden("offer", offerId);
      }
      if (offer.status === "ACCEPTED") {
        const existing = await tx.findBookingByOffer(offer.id);
        if (existing !== null) {
          return { replayed: true, value: existing };
        }
      }
      const open = await expireRequestIfNeeded(tx, request, now);
      const current = await markOfferExpired(tx, offer, now);
      if (
        current.status === "EXPIRED" ||
        Date.parse(current.expiresAt) <= now.getTime()
      ) {
        throw offerExpired();
      }
      if (current.status !== "PENDING" || open.status !== "OPEN") {
        throw invalidState();
      }
      if (offer.hostUserId === actorUserId) {
        throw selfBooking();
      }
      const policy = await tx.activePolicy(now);
      const quote = quoteTotal(
        current.priceMinor,
        "OFFER_TOTAL",
        policy === null
          ? null
          : { id: policy.id, version: policy.version, rateBps: policy.rateBps },
      );
      const booking = bookingFromQuote({
        quote,
        now,
        travellerId: actorUserId,
        hostId: current.hostId,
        hostUserId: current.hostUserId,
        experienceId: null,
        offerId: current.id,
        startsAt: current.proposedStartsAt,
        endsAt: current.proposedEndsAt,
        participantCount: open.partySize,
        currency: current.currency,
        title: "Custom offer",
        inclusions: current.inclusions,
        exclusions: current.exclusions,
        meetingArea: "",
        cancellationPolicy: current.cancellationPolicy,
        reservation: null,
      });
      const event = createdEvent(booking, actorUserId);
      booking.events = [event];
      await tx.insertBooking(booking);
      await tx.insertEvent(event);
      await tx.insertOutbox(
        randomUUID(),
        outboxType(booking.status),
        booking.id,
        { bookingId: booking.id, status: booking.status },
        now.toISOString(),
      );
      await tx.updateOfferStatus(current.id, "ACCEPTED");
      await tx.rejectOtherOffers(open.id, current.id);
      await tx.updateTripRequestStatus(open.id, "CLOSED");
      return { replayed: false, value: booking };
    },
  );
}

export async function createSlotBooking(
  tx: BookingTx,
  command: IdempotencyCommand & {
    experienceId: string;
    slotId: string;
    participantCount: number;
    currency: string;
  },
  now: Date,
): Promise<Ok<BookingRow>> {
  return tx.exclusive(
    [
      idempotencyLock(
        command.actorUserId,
        IDEMPOTENCY_SCOPE_BOOKING,
        command.idempotencyKey,
      ),
      `slot:${command.slotId}`,
    ],
    async () => {
      const existing = await replayBooking(tx, command);
      if (existing !== null) {
        return existing;
      }
      const slot = await tx.loadSlot(command.experienceId, command.slotId);
      if (slot === null) {
        throw notFound();
      }
      if (slot.hostUserId === command.actorUserId) {
        throw selfBooking();
      }
      if (command.currency !== slot.currency) {
        throw invalid("currency");
      }
      if (!isBookableSlot(slot, command.participantCount, now)) {
        throw unavailable();
      }
      await tx.expireDueHolds(command.slotId, now);
      const reserved = await tx.activeQuantity(command.slotId, now);
      await tx.checkpoint();
      if (reserved + command.participantCount > slot.capacity) {
        throw unavailable();
      }
      const policy = await tx.activePolicy(now);
      const quote = quoteTotal(
        slot.basePriceMinor,
        "LISTED_TOTAL",
        policy === null
          ? null
          : { id: policy.id, version: policy.version, rateBps: policy.rateBps },
      );
      const holdExpiresAt = new Date(
        now.getTime() + SLOT_HOLD_MS,
      ).toISOString();
      const reservation: ReservationRow = {
        id: randomUUID(),
        slotId: slot.slotId,
        bookingId: "",
        quantity: command.participantCount,
        expiresAt: holdExpiresAt,
        state: "HELD",
      };
      const booking = bookingFromQuote({
        quote,
        now,
        travellerId: command.actorUserId,
        hostId: slot.hostId,
        hostUserId: slot.hostUserId,
        experienceId: slot.experienceId,
        offerId: null,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        participantCount: command.participantCount,
        currency: slot.currency,
        title: slot.title,
        inclusions: slot.inclusions,
        exclusions: slot.exclusions,
        meetingArea: slot.meetingArea,
        cancellationPolicy: slot.cancellationPolicy,
        reservation,
      });
      reservation.bookingId = booking.id;
      const event = createdEvent(booking, command.actorUserId);
      booking.events = [event];
      await tx.insertBooking(booking);
      await tx.insertReservation(reservation);
      await tx.insertEvent(event);
      await tx.insertOutbox(
        randomUUID(),
        outboxType(booking.status),
        booking.id,
        { bookingId: booking.id, status: booking.status },
        now.toISOString(),
      );
      await tx.insertIdempotency({
        id: randomUUID(),
        actorUserId: command.actorUserId,
        scope: IDEMPOTENCY_SCOPE_BOOKING,
        idempotencyKey: command.idempotencyKey,
        requestHash: command.requestHash,
        resourceType: "booking",
        resourceId: booking.id,
        createdAt: now.toISOString(),
      });
      return { replayed: false, value: booking };
    },
  );
}

export async function readBooking(
  tx: BookingTx,
  actorUserId: string,
  bookingId: string,
  now: Date,
): Promise<BookingRow> {
  return tx.exclusive([`booking:${bookingId}`], async () => {
    const booking = await requireParty(tx, actorUserId, bookingId);
    if (holdLapsed(booking, now)) {
      const expired = await applyLocked(
        tx,
        booking,
        "expire",
        actorUserId,
        now,
      );
      return expired.value;
    }
    return booking;
  });
}

export async function listOwnBookings(
  tx: BookingTx,
  actorUserId: string,
  side: "traveller" | "host",
): Promise<BookingRow[]> {
  return side === "traveller"
    ? tx.listBookingsForTraveller(actorUserId)
    : tx.listBookingsForHostUser(actorUserId);
}

export async function transitionBooking(
  tx: BookingTx,
  command: {
    actorUserId: string;
    bookingId: string;
    action: BookingAction;
    method?: CheckInMethod;
  },
  now: Date,
): Promise<Ok<BookingRow>> {
  return tx.exclusive([`booking:${command.bookingId}`], async () => {
    const booking = await requireParty(
      tx,
      command.actorUserId,
      command.bookingId,
    );
    assertActor(booking, command.actorUserId, command.action);
    return applyLocked(
      tx,
      booking,
      command.action,
      command.actorUserId,
      now,
      command.method,
    );
  });
}

async function applyLocked(
  tx: BookingTx,
  booking: BookingRow,
  action: BookingAction,
  actorUserId: string,
  now: Date,
  method?: CheckInMethod,
): Promise<Ok<BookingRow>> {
  const decision = decideTransition(booking.status, action);
  if (decision.type === "reject") {
    throw invalidState();
  }
  if (decision.type === "replay") {
    return { replayed: true, value: booking };
  }
  const changed = await tx.updateBookingStatusIf(
    booking.id,
    booking.status,
    decision.status,
  );
  if (!changed) {
    const again = await tx.findBooking(booking.id);
    if (
      again !== null &&
      decideTransition(again.status, action).type === "replay"
    ) {
      return { replayed: true, value: again };
    }
    throw invalidState();
  }
  if (action === "cancel" || action === "expire") {
    await tx.releaseReservations(booking.id);
  }
  if (
    action === "check_in" &&
    method !== undefined &&
    !(await tx.hasCheckIn(booking.id))
  ) {
    await tx.insertCheckIn({
      id: randomUUID(),
      bookingId: booking.id,
      actorId: actorUserId,
      method,
      verifiedAt: now.toISOString(),
    });
  }
  await tx.insertEvent({
    id: randomUUID(),
    bookingId: booking.id,
    eventType: outboxType(decision.status),
    actorId: actorUserId,
    createdAt: now.toISOString(),
  });
  await tx.insertOutbox(
    randomUUID(),
    outboxType(decision.status),
    booking.id,
    { bookingId: booking.id, status: decision.status },
    now.toISOString(),
  );
  const updated = await tx.findBooking(booking.id);
  if (updated === null) {
    throw notFound();
  }
  return { replayed: false, value: updated };
}

async function requireParty(
  tx: BookingTx,
  actorUserId: string,
  bookingId: string,
): Promise<BookingRow> {
  const booking = await tx.findBooking(bookingId);
  if (booking === null) {
    throw notFound();
  }
  if (
    booking.travellerId !== actorUserId &&
    booking.hostUserId !== actorUserId
  ) {
    throw hidden("booking", bookingId);
  }
  return booking;
}

function assertActor(
  booking: BookingRow,
  actorUserId: string,
  action: BookingAction,
): void {
  const hostOnly =
    action === "check_in" || action === "complete" || action === "no_show";
  if (hostOnly && booking.hostUserId !== actorUserId) {
    throw forbidden();
  }
  if (action === "expire") {
    throw forbidden();
  }
}

function holdLapsed(booking: BookingRow, now: Date): boolean {
  return (
    booking.status === "AWAITING_PAYMENT" &&
    booking.reservation !== null &&
    booking.reservation.state === "HELD" &&
    booking.reservation.expiresAt !== null &&
    Date.parse(booking.reservation.expiresAt) <= now.getTime()
  );
}

function isBookableSlot(
  slot: SlotContext,
  participantCount: number,
  now: Date,
): boolean {
  if (
    slot.listingStatus !== "PUBLISHED" ||
    slot.hostVerificationStatus !== "VERIFIED" ||
    slot.hostPublicProfileStatus !== "VISIBLE" ||
    slot.cityStatus !== "ACTIVE"
  ) {
    return false;
  }
  if (slot.slotStatus !== "OPEN") {
    return false;
  }
  const end = Date.parse(slot.endsAt);
  if (Number.isNaN(end) || end <= now.getTime()) {
    return false;
  }
  if (participantCount > slot.capacity) {
    return false;
  }
  return !isBlackedOut(
    { startsAt: slot.startsAt, endsAt: slot.endsAt },
    slot.blackouts,
  );
}

function assertOfferWindow(
  command: {
    proposedStartsAt: string;
    proposedEndsAt: string;
    expiresAt: string;
  },
  request: TripRequestRow,
  timezone: string,
  now: Date,
): void {
  const start = Date.parse(command.proposedStartsAt);
  const end = Date.parse(command.proposedEndsAt);
  const expiry = Date.parse(command.expiresAt);
  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end <= start ||
    end - start > MAX_OFFER_DURATION_MS
  ) {
    throw invalid("proposedEndsAt");
  }
  const startDay = localDate(new Date(start), timezone);
  const endDay = localDate(new Date(end), timezone);
  if (startDay < request.startsOn || endDay > request.endsOn) {
    throw invalid("proposedStartsAt");
  }
  const requestExpiry = Date.parse(request.expiresAt);
  if (
    Number.isNaN(expiry) ||
    expiry <= now.getTime() ||
    expiry > now.getTime() + MAX_OFFER_TTL_MS ||
    expiry > requestExpiry
  ) {
    throw invalid("expiresAt");
  }
}

async function expireRequestIfNeeded(
  tx: BookingTx,
  request: TripRequestRow,
  now: Date,
): Promise<TripRequestRow> {
  if (
    request.status === "OPEN" &&
    Date.parse(request.expiresAt) <= now.getTime()
  ) {
    await tx.updateTripRequestStatus(request.id, "EXPIRED");
    return { ...request, status: "EXPIRED" };
  }
  return request;
}

async function markOfferExpired(
  tx: BookingTx,
  offer: OfferRow,
  now: Date,
): Promise<OfferRow> {
  if (
    offer.status === "PENDING" &&
    Date.parse(offer.expiresAt) <= now.getTime()
  ) {
    await tx.updateOfferStatus(offer.id, "EXPIRED");
    return { ...offer, status: "EXPIRED" };
  }
  return offer;
}

async function replayTripRequest(
  tx: BookingTx,
  command: IdempotencyCommand,
): Promise<Ok<TripRequestRow> | null> {
  const existing = await tx.findIdempotency(
    command.actorUserId,
    IDEMPOTENCY_SCOPE_REQUEST,
    command.idempotencyKey,
  );
  if (existing === null) {
    return null;
  }
  if (existing.requestHash !== command.requestHash) {
    throw idempotencyConflict();
  }
  const request = await tx.findTripRequest(existing.resourceId);
  if (request === null) {
    throw notFound();
  }
  return { replayed: true, value: request };
}

async function replayBooking(
  tx: BookingTx,
  command: IdempotencyCommand,
): Promise<Ok<BookingRow> | null> {
  const existing = await tx.findIdempotency(
    command.actorUserId,
    IDEMPOTENCY_SCOPE_BOOKING,
    command.idempotencyKey,
  );
  if (existing === null) {
    return null;
  }
  if (existing.requestHash !== command.requestHash) {
    throw idempotencyConflict();
  }
  const booking = await tx.findBooking(existing.resourceId);
  if (booking === null) {
    throw notFound();
  }
  return { replayed: true, value: booking };
}

function createdEvent(booking: BookingRow, actorId: string): EventRow {
  return {
    id: randomUUID(),
    bookingId: booking.id,
    eventType: outboxType(booking.status),
    actorId,
    createdAt: booking.createdAt,
  };
}

function bookingFromQuote(input: {
  quote: PriceQuote;
  now: Date;
  travellerId: string;
  hostId: string;
  hostUserId: string;
  experienceId: string | null;
  offerId: string | null;
  startsAt: string;
  endsAt: string;
  participantCount: number;
  currency: string;
  title: string;
  inclusions: string;
  exclusions: string;
  meetingArea: string;
  cancellationPolicy: string;
  reservation: ReservationRow | null;
}): BookingRow {
  const id = randomUUID();
  const reservation =
    input.reservation === null ? null : { ...input.reservation, bookingId: id };
  return {
    id,
    travellerId: input.travellerId,
    hostId: input.hostId,
    hostUserId: input.hostUserId,
    experienceId: input.experienceId,
    offerId: input.offerId,
    status: "AWAITING_PAYMENT",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    participantCount: input.participantCount,
    currency: input.currency,
    subtotalMinor: input.quote.subtotalMinor,
    discountMinor: input.quote.discountMinor,
    taxMinor: input.quote.taxMinor,
    totalMinor: input.quote.totalMinor,
    commissionPolicyId: input.quote.commissionPolicyId,
    commissionVersion: input.quote.commissionVersion,
    commissionMinor: input.quote.commissionMinor,
    hostGrossMinor: input.quote.hostGrossMinor,
    pricingBasis: input.quote.pricingBasis,
    title: input.title,
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    meetingArea: input.meetingArea,
    cancellationPolicy: input.cancellationPolicy,
    termsCapturedAt: input.now.toISOString(),
    createdAt: input.now.toISOString(),
    reservation,
    events: [],
  };
}

function idempotencyLock(
  actorUserId: string,
  scope: string,
  key: string,
): string {
  return `idem:${actorUserId}:${scope}:${key}`;
}

export function isHostUser(booking: BookingRow, actorUserId: string): boolean {
  return booking.hostUserId === actorUserId;
}

export type { BookingStatus };
