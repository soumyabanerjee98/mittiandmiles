import type { BookingStatus } from "./state.js";
import type { PricingBasis } from "./quote.js";

export type TripRequestStatus = "OPEN" | "CLOSED" | "EXPIRED" | "CANCELLED";
export type OfferStatus =
  "PENDING" | "ACCEPTED" | "WITHDRAWN" | "EXPIRED" | "REJECTED";
export type ReservationState = "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export type TripPreferences = {
  interests?: string[] | undefined;
  languages?: string[] | undefined;
  accessibility?: string | undefined;
  notes?: string | undefined;
};

export type CityRow = {
  id: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
};

export type HostGate = {
  hostId: string;
  userId: string;
  eligible: boolean;
};

export type PolicyRow = {
  id: string;
  version: string;
  rateBps: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type IdempotencyRow = {
  id: string;
  actorUserId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
};

export type TripRequestRow = {
  id: string;
  travellerId: string;
  cityId: string;
  startsOn: string;
  endsOn: string;
  partySize: number;
  budgetMinor: number | null;
  currency: string;
  preferences: TripPreferences;
  status: TripRequestStatus;
  expiresAt: string;
  createdAt: string;
};

export type OfferRow = {
  id: string;
  requestId: string;
  hostId: string;
  hostUserId: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  priceMinor: number;
  currency: string;
  inclusions: string;
  exclusions: string;
  cancellationPolicy: string;
  expiresAt: string;
  status: OfferStatus;
  createdAt: string;
};

export type ReservationRow = {
  id: string;
  slotId: string;
  bookingId: string;
  quantity: number;
  expiresAt: string | null;
  state: ReservationState;
};

export type EventRow = {
  id: string;
  bookingId: string;
  eventType: string;
  actorId: string | null;
  createdAt: string;
};

export type BookingRow = {
  id: string;
  travellerId: string;
  hostId: string;
  hostUserId: string;
  experienceId: string | null;
  offerId: string | null;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  participantCount: number;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  commissionPolicyId: string | null;
  commissionVersion: string | null;
  commissionMinor: number;
  hostGrossMinor: number;
  pricingBasis: PricingBasis;
  title: string;
  inclusions: string;
  exclusions: string;
  meetingArea: string;
  cancellationPolicy: string;
  termsCapturedAt: string;
  createdAt: string;
  reservation: ReservationRow | null;
  events: EventRow[];
};

export type SlotContext = {
  experienceId: string;
  hostId: string;
  hostUserId: string;
  cityId: string;
  cityTimezone: string;
  listingStatus: string;
  hostVerificationStatus: string;
  hostPublicProfileStatus: string;
  cityStatus: string;
  title: string;
  inclusions: string;
  exclusions: string;
  meetingArea: string;
  cancellationPolicy: string;
  basePriceMinor: number;
  currency: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  slotStatus: string;
  blackouts: readonly { startsAt: string; endsAt: string }[];
};

export type CheckInMethod = "HOST_CODE" | "PARTICIPANT_CODE" | "MANUAL";
