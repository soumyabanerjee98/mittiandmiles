import {
  acceptOffer,
  createOffer,
  createSlotBooking,
  createTripRequest,
  listOwnBookings,
  listVisibleOffers,
  readBooking,
  readTripRequest,
  transitionBooking,
  withdrawOffer,
} from "./commands.js";
import { requestHash } from "./hash.js";
import type { BookingAction } from "./state.js";
import type { BookingDatabase } from "./tx.js";
import type {
  BookingRow,
  CheckInMethod,
  OfferRow,
  TripPreferences,
  TripRequestRow,
} from "./types.js";

export type TripRequestInput = {
  cityId: string;
  startsOn: string;
  endsOn: string;
  partySize: number;
  budgetMinor?: number;
  currency: string;
  preferences?: TripPreferences;
};

export type OfferInput = {
  proposedStartsAt: string;
  proposedEndsAt: string;
  priceMinor: number;
  currency: string;
  inclusions: string;
  exclusions: string;
  cancellationPolicy: string;
  expiresAt: string;
};

export type SlotBookingInput = {
  experienceId: string;
  slotId: string;
  participantCount: number;
  currency: string;
};

export class BookingService {
  constructor(
    private readonly database: BookingDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  createTripRequest(
    actorUserId: string,
    idempotencyKey: string,
    input: TripRequestInput,
  ): Promise<{ replayed: boolean; value: TripRequestRow }> {
    const preferences = input.preferences ?? {};
    return this.database.transaction((tx) =>
      createTripRequest(
        tx,
        {
          actorUserId,
          idempotencyKey,
          requestHash: requestHash({
            cityId: input.cityId,
            startsOn: input.startsOn,
            endsOn: input.endsOn,
            partySize: input.partySize,
            budgetMinor: input.budgetMinor ?? null,
            currency: input.currency,
            preferences,
          }),
          cityId: input.cityId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          partySize: input.partySize,
          budgetMinor: input.budgetMinor ?? null,
          currency: input.currency,
          preferences,
        },
        this.now(),
      ),
    );
  }

  readTripRequest(
    actorUserId: string,
    requestId: string,
  ): Promise<TripRequestRow> {
    return this.database.transaction((tx) =>
      readTripRequest(tx, actorUserId, requestId, this.now()),
    );
  }

  createOffer(
    actorUserId: string,
    requestId: string,
    input: OfferInput,
  ): Promise<OfferRow> {
    return this.database.transaction((tx) =>
      createOffer(tx, { actorUserId, requestId, ...input }, this.now()),
    );
  }

  listOffers(actorUserId: string, requestId: string): Promise<OfferRow[]> {
    return this.database.transaction((tx) =>
      listVisibleOffers(tx, actorUserId, requestId, this.now()),
    );
  }

  withdrawOffer(actorUserId: string, offerId: string): Promise<OfferRow> {
    return this.database.transaction((tx) =>
      withdrawOffer(tx, actorUserId, offerId, this.now()),
    );
  }

  acceptOffer(
    actorUserId: string,
    offerId: string,
  ): Promise<{ replayed: boolean; value: BookingRow }> {
    return this.database.transaction((tx) =>
      acceptOffer(tx, actorUserId, offerId, this.now()),
    );
  }

  createSlotBooking(
    actorUserId: string,
    idempotencyKey: string,
    input: SlotBookingInput,
  ): Promise<{ replayed: boolean; value: BookingRow }> {
    return this.database.transaction((tx) =>
      createSlotBooking(
        tx,
        {
          actorUserId,
          idempotencyKey,
          requestHash: requestHash(input),
          ...input,
        },
        this.now(),
      ),
    );
  }

  readBooking(actorUserId: string, bookingId: string): Promise<BookingRow> {
    return this.database.transaction((tx) =>
      readBooking(tx, actorUserId, bookingId, this.now()),
    );
  }

  listBookings(
    actorUserId: string,
    side: "traveller" | "host",
  ): Promise<BookingRow[]> {
    return this.database.transaction((tx) =>
      listOwnBookings(tx, actorUserId, side),
    );
  }

  transition(
    actorUserId: string,
    bookingId: string,
    action: BookingAction,
    method?: CheckInMethod,
  ): Promise<{ replayed: boolean; value: BookingRow }> {
    return this.database.transaction((tx) =>
      transitionBooking(
        tx,
        {
          actorUserId,
          bookingId,
          action,
          ...(method === undefined ? {} : { method }),
        },
        this.now(),
      ),
    );
  }
}
