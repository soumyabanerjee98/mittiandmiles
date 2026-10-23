import { isBlackedOut, localDate } from "./time.js";
import {
  type CityStatus,
  type ExperienceView,
  type HostVerificationStatus,
  type ListingStatus,
  type PublicProfileStatus,
  type SlotRecord,
} from "./types.js";

export type BookableShape = {
  listingStatus: ListingStatus;
  hostVerificationStatus: HostVerificationStatus;
  hostPublicProfileStatus: PublicProfileStatus;
  cityStatus: CityStatus;
};

/**
 * Gate for a booking command. Unpublished, unapproved, hidden, or
 * inactive-city listings are not bookable.
 */
export function isExperienceBookable(experience: BookableShape): boolean {
  return (
    experience.listingStatus === "PUBLISHED" &&
    experience.hostVerificationStatus === "VERIFIED" &&
    experience.hostPublicProfileStatus === "VISIBLE" &&
    experience.cityStatus === "ACTIVE"
  );
}

export function bookingBlockReason(
  experience: BookableShape,
): "BOOKING_NOT_AVAILABLE" | null {
  return isExperienceBookable(experience) ? null : "BOOKING_NOT_AVAILABLE";
}

export type DiscoveryFilter = {
  city?: string;
  date?: string;
  category?: string;
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  minDuration?: number;
  maxDuration?: number;
  partySize?: number;
  cursor?: { createdAt: string; id: string };
  limit: number;
};

export function selectableSlots(
  experience: Pick<ExperienceView, "cityTimezone" | "slots" | "blackouts">,
  input: { from: string; to: string; partySize: number; now: Date },
): SlotRecord[] {
  return experience.slots.filter((slot) => {
    if (slot.status !== "OPEN") {
      return false;
    }
    const end = Date.parse(slot.endsAt);
    if (Number.isNaN(end) || end <= input.now.getTime()) {
      return false;
    }
    const held = slot.heldQuantity ?? 0;
    if (slot.capacity - held < input.partySize) {
      return false;
    }
    if (isBlackedOut(slot, experience.blackouts)) {
      return false;
    }
    const day = localDate(new Date(slot.startsAt), experience.cityTimezone);
    return day >= input.from && day <= input.to;
  });
}

export function matchesDiscovery(
  experience: ExperienceView,
  filter: DiscoveryFilter,
  now: Date,
): boolean {
  if (!isExperienceBookable(experience)) {
    return false;
  }
  if (
    filter.city !== undefined &&
    filter.city !== experience.cityId &&
    filter.city !== experience.citySlug
  ) {
    return false;
  }
  if (
    filter.category !== undefined &&
    filter.category !== experience.category
  ) {
    return false;
  }
  if (
    filter.language !== undefined &&
    !experience.languageCodes.includes(filter.language)
  ) {
    return false;
  }
  if (
    filter.minPrice !== undefined &&
    experience.basePriceMinor < filter.minPrice
  ) {
    return false;
  }
  if (
    filter.maxPrice !== undefined &&
    experience.basePriceMinor > filter.maxPrice
  ) {
    return false;
  }
  if (
    filter.minDuration !== undefined &&
    experience.durationMinutes < filter.minDuration
  ) {
    return false;
  }
  if (
    filter.maxDuration !== undefined &&
    experience.durationMinutes > filter.maxDuration
  ) {
    return false;
  }
  if (
    filter.partySize !== undefined &&
    experience.capacity < filter.partySize
  ) {
    return false;
  }
  if (filter.date !== undefined) {
    const slots = selectableSlots(experience, {
      from: filter.date,
      to: filter.date,
      partySize: filter.partySize ?? 1,
      now,
    });
    if (slots.length === 0) {
      return false;
    }
  }
  return true;
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

export function decodeCursor(
  value: string,
): { createdAt: string; id: string } | null {
  let text: string;
  try {
    text = Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const separator = text.indexOf("|");
  if (separator <= 0) {
    return null;
  }
  const createdAt = text.slice(0, separator);
  const id = text.slice(separator + 1);
  if (Number.isNaN(Date.parse(createdAt))) {
    return null;
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return null;
  }
  return { createdAt: new Date(createdAt).toISOString(), id };
}

export function pageNewestFirst<T extends { createdAt: string; id: string }>(
  items: readonly T[],
  cursor: { createdAt: string; id: string } | undefined,
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const sorted = [...items].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? 1 : -1;
    }
    if (left.id !== right.id) {
      return left.id < right.id ? 1 : -1;
    }
    return 0;
  });
  const visible =
    cursor === undefined
      ? sorted
      : sorted.filter((item) => isOlderThan(item, cursor));
  const page = visible.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    visible.length > limit && last !== undefined
      ? encodeCursor(last.createdAt, last.id)
      : null;
  return { items: page, nextCursor };
}

function isOlderThan(
  item: { createdAt: string; id: string },
  cursor: { createdAt: string; id: string },
): boolean {
  if (item.createdAt < cursor.createdAt) {
    return true;
  }
  if (item.createdAt > cursor.createdAt) {
    return false;
  }
  return item.id < cursor.id;
}
