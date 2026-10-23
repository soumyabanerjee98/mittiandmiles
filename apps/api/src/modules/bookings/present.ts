import type { BookingRow, OfferRow, TripRequestRow } from "./types.js";

const paymentNotStarted = { state: "NOT_STARTED" } as const;

export function presentTripRequest(row: TripRequestRow) {
  return {
    id: row.id,
    travellerId: row.travellerId,
    cityId: row.cityId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    partySize: row.partySize,
    budgetMinor: row.budgetMinor,
    currency: row.currency,
    preferences: row.preferences,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export function presentOffer(row: OfferRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    hostId: row.hostId,
    proposedStartsAt: row.proposedStartsAt,
    proposedEndsAt: row.proposedEndsAt,
    priceMinor: row.priceMinor,
    currency: row.currency,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    cancellationPolicy: row.cancellationPolicy,
    expiresAt: row.expiresAt,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function presentBooking(row: BookingRow) {
  return {
    id: row.id,
    status: row.status,
    travellerId: row.travellerId,
    hostId: row.hostId,
    experienceId: row.experienceId,
    offerId: row.offerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    participantCount: row.participantCount,
    currency: row.currency,
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    taxMinor: row.taxMinor,
    totalMinor: row.totalMinor,
    commissionMinor: row.commissionMinor,
    hostGrossMinor: row.hostGrossMinor,
    pricingBasis: row.pricingBasis,
    title: row.title,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    meetingArea: row.meetingArea,
    cancellationPolicy: row.cancellationPolicy,
    termsCapturedAt: row.termsCapturedAt,
    hold:
      row.reservation === null
        ? null
        : {
            slotId: row.reservation.slotId,
            quantity: row.reservation.quantity,
            state: row.reservation.state,
            expiresAt: row.reservation.expiresAt,
          },
    payment: paymentNotStarted,
    events: row.events.map((event) => ({
      eventType: event.eventType,
      createdAt: event.createdAt,
    })),
    createdAt: row.createdAt,
  };
}
