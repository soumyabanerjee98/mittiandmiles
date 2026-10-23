import type { BookingDatabase, BookingTx } from "./tx.js";
import type { BookingStatus } from "./state.js";
import { outboxType } from "./state.js";
import type {
  BookingRow,
  CityRow,
  EventRow,
  HostGate,
  IdempotencyRow,
  OfferRow,
  PolicyRow,
  ReservationRow,
  SlotContext,
  TripRequestRow,
} from "./types.js";

export type BookingSeed = {
  cities?: readonly CityRow[];
  hosts?: readonly {
    id: string;
    userId: string;
    verificationStatus: string;
    publicProfileStatus: string;
  }[];
  experiences?: readonly {
    id: string;
    hostId: string;
    cityId: string;
    title: string;
    inclusions: string;
    exclusions: string;
    meetingArea: string;
    cancellationPolicy: string;
    basePriceMinor: number;
    currency: string;
    listingStatus: string;
    slots: readonly {
      id: string;
      startsAt: string;
      endsAt: string;
      capacity: number;
      status: string;
    }[];
    blackouts?: readonly { startsAt: string; endsAt: string }[];
  }[];
  policies?: readonly PolicyRow[];
};

type HostSeed = NonNullable<BookingSeed["hosts"]>[number];
type ExperienceSeed = NonNullable<BookingSeed["experiences"]>[number];

type OutboxRow = {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: { bookingId: string; status: string };
  createdAt: string;
};

export class MemoryBookingStore implements BookingDatabase {
  criticalSectionDelayMs = 0;

  private readonly cities: CityRow[] = [];
  private readonly hosts: HostSeed[] = [];
  private readonly experiences: ExperienceSeed[] = [];
  private readonly policies: PolicyRow[] = [];
  private readonly requests: TripRequestRow[] = [];
  private readonly offers: OfferRow[] = [];
  private readonly bookings: BookingRow[] = [];
  private readonly reservations: ReservationRow[] = [];
  private readonly events: EventRow[] = [];
  private readonly outbox: OutboxRow[] = [];
  private readonly idempotency: IdempotencyRow[] = [];
  private readonly checkIns: { bookingId: string }[] = [];
  private readonly tails = new Map<string, Promise<void>>();

  constructor(seed: BookingSeed = {}) {
    for (const city of seed.cities ?? []) {
      this.cities.push(structuredClone(city));
    }
    for (const host of seed.hosts ?? []) {
      this.hosts.push(structuredClone(host));
    }
    for (const experience of seed.experiences ?? []) {
      this.experiences.push(structuredClone(experience));
    }
    for (const policy of seed.policies ?? []) {
      this.policies.push(structuredClone(policy));
    }
  }

  transaction<T>(run: (tx: BookingTx) => Promise<T>): Promise<T> {
    return run(this.tx());
  }

  outboxTypes(): string[] {
    return this.outbox.map((row) => row.eventType);
  }

  heldQuantity(slotId: string, now: Date): number {
    return this.reservations
      .filter((row) => this.countsTowardCapacity(row, slotId, now))
      .reduce((sum, row) => sum + row.quantity, 0);
  }

  seedBooking(row: BookingRow): void {
    this.bookings.push(structuredClone(row));
    if (row.reservation !== null) {
      this.reservations.push(structuredClone(row.reservation));
    }
  }

  private tx(): BookingTx {
    return {
      checkpoint: () => this.checkpoint(),
      exclusive: (keys, run) => this.exclusive(keys, run),
      findIdempotency: (actorUserId, scope, idempotencyKey) =>
        Promise.resolve(
          clone(
            this.idempotency.find(
              (row) =>
                row.actorUserId === actorUserId &&
                row.scope === scope &&
                row.idempotencyKey === idempotencyKey,
            ) ?? null,
          ),
        ),
      insertIdempotency: (row) => {
        this.idempotency.push(structuredClone(row));
        return Promise.resolve();
      },
      findCity: (id) =>
        Promise.resolve(
          clone(this.cities.find((row) => row.id === id) ?? null),
        ),
      insertTripRequest: (row) => {
        this.requests.push(structuredClone(row));
        return Promise.resolve();
      },
      findTripRequest: (id) =>
        Promise.resolve(
          clone(this.requests.find((row) => row.id === id) ?? null),
        ),
      updateTripRequestStatus: (id, status) => {
        const row = this.requests.find((item) => item.id === id);
        if (row !== undefined) {
          row.status = status;
        }
        return Promise.resolve();
      },
      hostGate: (userId, cityId) =>
        Promise.resolve(this.hostGate(userId, cityId)),
      findPendingOffer: (requestId, hostId) =>
        Promise.resolve(
          clone(
            this.offers.find(
              (row) =>
                row.requestId === requestId &&
                row.hostId === hostId &&
                row.status === "PENDING",
            ) ?? null,
          ),
        ),
      insertOffer: (row) => {
        this.offers.push(structuredClone(row));
        return Promise.resolve();
      },
      findOffer: (id) =>
        Promise.resolve(
          clone(this.offers.find((row) => row.id === id) ?? null),
        ),
      updateOfferStatus: (id, status) => {
        const row = this.offers.find((item) => item.id === id);
        if (row !== undefined) {
          row.status = status;
        }
        return Promise.resolve();
      },
      rejectOtherOffers: (requestId, acceptedOfferId) => {
        for (const offer of this.offers) {
          if (
            offer.requestId === requestId &&
            offer.id !== acceptedOfferId &&
            offer.status === "PENDING"
          ) {
            offer.status = "REJECTED";
          }
        }
        return Promise.resolve();
      },
      findBooking: (id) => Promise.resolve(this.findBooking(id)),
      findBookingByOffer: (offerId) =>
        Promise.resolve(
          this.findBooking(
            this.bookings.find((row) => row.offerId === offerId)?.id ?? "",
          ),
        ),
      listOffers: (requestId) =>
        Promise.resolve(
          this.offers
            .filter((row) => row.requestId === requestId)
            .map((row) => structuredClone(row)),
        ),
      listBookingsForTraveller: (userId) =>
        Promise.resolve(
          this.bookings
            .filter((row) => row.travellerId === userId)
            .map((row) => this.findBooking(row.id))
            .filter((row): row is BookingRow => row !== null),
        ),
      listBookingsForHostUser: (userId) =>
        Promise.resolve(
          this.bookings
            .filter((row) => row.hostUserId === userId)
            .map((row) => this.findBooking(row.id))
            .filter((row): row is BookingRow => row !== null),
        ),
      loadSlot: (experienceId, slotId) =>
        Promise.resolve(this.loadSlot(experienceId, slotId)),
      activePolicy: (now) => Promise.resolve(this.activePolicy(now)),
      expireDueHolds: (slotId, now) => {
        this.expireDueHolds(slotId, now);
        return Promise.resolve();
      },
      activeQuantity: (slotId, now) =>
        Promise.resolve(this.heldQuantity(slotId, now)),
      insertBooking: (row) => {
        this.bookings.push(structuredClone(row));
        return Promise.resolve();
      },
      insertReservation: (row) => {
        this.reservations.push(structuredClone(row));
        return Promise.resolve();
      },
      insertEvent: (row) => {
        this.events.push(structuredClone(row));
        return Promise.resolve();
      },
      insertOutbox: (id, eventType, aggregateId, payload, createdAt) => {
        this.outbox.push({ id, eventType, aggregateId, payload, createdAt });
        return Promise.resolve();
      },
      insertCheckIn: (input) => {
        this.checkIns.push({ bookingId: input.bookingId });
        return Promise.resolve();
      },
      updateBookingStatusIf: (id, from, to) =>
        Promise.resolve(this.updateBookingStatusIf(id, from, to)),
      releaseReservations: (bookingId) => {
        for (const reservation of this.reservations) {
          if (
            reservation.bookingId === bookingId &&
            (reservation.state === "HELD" || reservation.state === "CONFIRMED")
          ) {
            reservation.state = "RELEASED";
          }
        }
        return Promise.resolve();
      },
      hasCheckIn: (bookingId) =>
        Promise.resolve(
          this.checkIns.some((row) => row.bookingId === bookingId),
        ),
    };
  }

  private async exclusive<T>(
    keys: readonly string[],
    run: () => Promise<T>,
  ): Promise<T> {
    const ordered = [...new Set(keys)].sort();
    const releases: (() => void)[] = [];
    try {
      for (const key of ordered) {
        const previous = this.tails.get(key) ?? Promise.resolve();
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        this.tails.set(
          key,
          previous.then(() => gate),
        );
        await previous;
        releases.push(release);
      }
      return await run();
    } finally {
      for (const release of releases) {
        release();
      }
    }
  }

  private checkpoint(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.criticalSectionDelayMs);
    });
  }

  private hostGate(userId: string, cityId: string): HostGate | null {
    const host = this.hosts.find((row) => row.userId === userId);
    if (host === undefined) {
      return null;
    }
    const published = this.experiences.some(
      (row) =>
        row.hostId === host.id &&
        row.cityId === cityId &&
        row.listingStatus === "PUBLISHED",
    );
    return {
      hostId: host.id,
      userId: host.userId,
      eligible:
        host.verificationStatus === "VERIFIED" &&
        host.publicProfileStatus === "VISIBLE" &&
        published,
    };
  }

  private loadSlot(experienceId: string, slotId: string): SlotContext | null {
    const experience = this.experiences.find((row) => row.id === experienceId);
    if (experience === undefined) {
      return null;
    }
    const slot = experience.slots.find((row) => row.id === slotId);
    if (slot === undefined) {
      return null;
    }
    const host = this.hosts.find((row) => row.id === experience.hostId);
    const city = this.cities.find((row) => row.id === experience.cityId);
    if (host === undefined || city === undefined) {
      return null;
    }
    return {
      experienceId: experience.id,
      hostId: host.id,
      hostUserId: host.userId,
      cityId: city.id,
      cityTimezone: city.timezone,
      listingStatus: experience.listingStatus,
      hostVerificationStatus: host.verificationStatus,
      hostPublicProfileStatus: host.publicProfileStatus,
      cityStatus: city.status,
      title: experience.title,
      inclusions: experience.inclusions,
      exclusions: experience.exclusions,
      meetingArea: experience.meetingArea,
      cancellationPolicy: experience.cancellationPolicy,
      basePriceMinor: experience.basePriceMinor,
      currency: experience.currency,
      slotId: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      capacity: slot.capacity,
      slotStatus: slot.status,
      blackouts: experience.blackouts ?? [],
    };
  }

  private activePolicy(now: Date): PolicyRow | null {
    const matches = this.policies.filter((policy) => {
      if (Date.parse(policy.effectiveFrom) > now.getTime()) {
        return false;
      }
      return (
        policy.effectiveTo === null ||
        Date.parse(policy.effectiveTo) > now.getTime()
      );
    });
    matches.sort((left, right) =>
      left.effectiveFrom < right.effectiveFrom ? 1 : -1,
    );
    return clone(matches[0] ?? null);
  }

  private expireDueHolds(slotId: string, now: Date): void {
    for (const reservation of this.reservations) {
      if (
        reservation.slotId !== slotId ||
        reservation.state !== "HELD" ||
        reservation.expiresAt === null ||
        Date.parse(reservation.expiresAt) > now.getTime()
      ) {
        continue;
      }
      reservation.state = "EXPIRED";
      const booking = this.bookings.find(
        (row) => row.id === reservation.bookingId,
      );
      if (booking === undefined || booking.status !== "AWAITING_PAYMENT") {
        continue;
      }
      booking.status = "EXPIRED";
      const createdAt = now.toISOString();
      this.events.push({
        id: `expire-${reservation.id}`,
        bookingId: booking.id,
        eventType: outboxType("EXPIRED"),
        actorId: null,
        createdAt,
      });
      this.outbox.push({
        id: `expire-out-${reservation.id}`,
        eventType: outboxType("EXPIRED"),
        aggregateId: booking.id,
        payload: { bookingId: booking.id, status: "EXPIRED" },
        createdAt,
      });
    }
  }

  private countsTowardCapacity(
    reservation: ReservationRow,
    slotId: string,
    now: Date,
  ): boolean {
    if (reservation.slotId !== slotId) {
      return false;
    }
    if (reservation.state !== "HELD" && reservation.state !== "CONFIRMED") {
      return false;
    }
    return (
      reservation.expiresAt === null ||
      Date.parse(reservation.expiresAt) > now.getTime()
    );
  }

  private updateBookingStatusIf(
    id: string,
    from: BookingStatus,
    to: BookingStatus,
  ): boolean {
    const booking = this.bookings.find((row) => row.id === id);
    if (booking === undefined || booking.status !== from) {
      return false;
    }
    booking.status = to;
    return true;
  }

  private findBooking(id: string): BookingRow | null {
    const booking = this.bookings.find((row) => row.id === id);
    if (booking === undefined) {
      return null;
    }
    const reservation =
      this.reservations.find((row) => row.bookingId === booking.id) ?? null;
    const events = this.events.filter((row) => row.bookingId === booking.id);
    return {
      ...structuredClone(booking),
      reservation: clone(reservation),
      events: structuredClone(events),
    };
  }
}

function clone<T>(value: T | null): T | null {
  if (value === null) {
    return null;
  }
  return structuredClone(value);
}
