import type { FieldDetail } from "../../shared/http-error.js";
import type { BlackoutRecord, SlotRecord } from "./types.js";

const MAX_SLOTS = 120;
const MAX_BLACKOUTS = 60;

export function isIanaTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 64) {
    return false;
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

export function isBlackedOut(
  slot: Pick<SlotRecord, "startsAt" | "endsAt">,
  blackouts: readonly Pick<BlackoutRecord, "startsAt" | "endsAt">[],
): boolean {
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);
  return blackouts.some((blackout) =>
    rangesOverlap(
      start,
      end,
      Date.parse(blackout.startsAt),
      Date.parse(blackout.endsAt),
    ),
  );
}

export function validateSchedule(input: {
  durationMinutes: number;
  listingCapacity: number;
  slots: readonly { startsAt: string; endsAt: string; capacity: number }[];
  blackouts: readonly { startsAt: string; endsAt: string }[];
}): FieldDetail[] {
  const details: FieldDetail[] = [];
  if (input.slots.length > MAX_SLOTS) {
    details.push({ field: "slots", message: "Invalid value." });
  }
  if (input.blackouts.length > MAX_BLACKOUTS) {
    details.push({ field: "blackouts", message: "Invalid value." });
  }

  const windows: { start: number; end: number }[] = [];
  for (const [index, slot] of input.slots.entries()) {
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    const field = `slots.${index}`;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      end <= start ||
      end - start !== input.durationMinutes * 60_000 ||
      !Number.isInteger(slot.capacity) ||
      slot.capacity < 1 ||
      slot.capacity > input.listingCapacity
    ) {
      details.push({ field, message: "Invalid value." });
      continue;
    }
    windows.push({ start, end });
  }

  for (let index = 0; index < windows.length; index += 1) {
    const current = windows[index];
    if (current === undefined) {
      continue;
    }
    for (let other = 0; other < index; other += 1) {
      const previous = windows[other];
      if (
        previous !== undefined &&
        rangesOverlap(current.start, current.end, previous.start, previous.end)
      ) {
        details.push({ field: `slots.${index}`, message: "Invalid value." });
        break;
      }
    }
  }

  for (const [index, blackout] of input.blackouts.entries()) {
    const start = Date.parse(blackout.startsAt);
    const end = Date.parse(blackout.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      details.push({ field: `blackouts.${index}`, message: "Invalid value." });
    }
  }

  for (const [index, slot] of input.slots.entries()) {
    if (isBlackedOut(slot, input.blackouts)) {
      details.push({ field: `slots.${index}`, message: "Invalid value." });
    }
  }

  return details;
}
