import type {
  BookingRow,
  CheckInMethod,
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
import type { BookingStatus } from "./state.js";
import type { OfferStatus, TripRequestStatus } from "./types.js";

export type BookingTx = {
  checkpoint(): Promise<void>;
  exclusive<T>(keys: readonly string[], run: () => Promise<T>): Promise<T>;
  findIdempotency(
    actorUserId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRow | null>;
  insertIdempotency(row: IdempotencyRow): Promise<void>;
  findCity(id: string): Promise<CityRow | null>;
  insertTripRequest(row: TripRequestRow): Promise<void>;
  findTripRequest(id: string): Promise<TripRequestRow | null>;
  updateTripRequestStatus(id: string, status: TripRequestStatus): Promise<void>;
  hostGate(userId: string, cityId: string): Promise<HostGate | null>;
  findPendingOffer(requestId: string, hostId: string): Promise<OfferRow | null>;
  insertOffer(row: OfferRow): Promise<void>;
  findOffer(id: string): Promise<OfferRow | null>;
  updateOfferStatus(id: string, status: OfferStatus): Promise<void>;
  rejectOtherOffers(requestId: string, acceptedOfferId: string): Promise<void>;
  findBooking(id: string): Promise<BookingRow | null>;
  findBookingByOffer(offerId: string): Promise<BookingRow | null>;
  listOffers(requestId: string): Promise<OfferRow[]>;
  listBookingsForTraveller(userId: string): Promise<BookingRow[]>;
  listBookingsForHostUser(userId: string): Promise<BookingRow[]>;
  loadSlot(experienceId: string, slotId: string): Promise<SlotContext | null>;
  activePolicy(now: Date): Promise<PolicyRow | null>;
  expireDueHolds(slotId: string, now: Date): Promise<void>;
  activeQuantity(slotId: string, now: Date): Promise<number>;
  insertBooking(row: BookingRow): Promise<void>;
  insertReservation(row: ReservationRow): Promise<void>;
  insertEvent(row: EventRow): Promise<void>;
  insertOutbox(
    id: string,
    eventType: string,
    aggregateId: string,
    payload: { bookingId: string; status: string },
    createdAt: string,
  ): Promise<void>;
  insertCheckIn(input: {
    id: string;
    bookingId: string;
    actorId: string;
    method: CheckInMethod;
    verifiedAt: string;
  }): Promise<void>;
  updateBookingStatusIf(
    id: string,
    from: BookingStatus,
    to: BookingStatus,
  ): Promise<boolean>;
  releaseReservations(bookingId: string): Promise<void>;
  hasCheckIn(bookingId: string): Promise<boolean>;
};

export type BookingDatabase = {
  transaction<T>(run: (tx: BookingTx) => Promise<T>): Promise<T>;
};
