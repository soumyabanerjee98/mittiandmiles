import { z } from "zod";

const instant = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  );
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay);
const currency = z.string().regex(/^[A-Z]{3}$/);
const text = (max: number) => z.string().trim().min(1).max(max);

export const pageQuerySchema = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const idParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const tripRequestBodySchema = z
  .object({
    cityId: z.uuid(),
    startsOn: day,
    endsOn: day,
    partySize: z.number().int().min(1).max(100),
    budgetMinor: z.number().int().min(0).max(500_000_000).optional(),
    currency,
    preferences: z
      .object({
        interests: z.array(text(40)).max(12).optional(),
        languages: z
          .array(
            z
              .string()
              .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/)
              .max(16),
          )
          .max(8)
          .optional(),
        accessibility: z.string().trim().max(500).optional(),
        notes: z.string().trim().max(1000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const offerBodySchema = z
  .object({
    proposedStartsAt: instant,
    proposedEndsAt: instant,
    priceMinor: z.number().int().min(0).max(500_000_000),
    currency,
    inclusions: text(4000),
    exclusions: text(4000),
    cancellationPolicy: text(4000),
    expiresAt: instant,
  })
  .strict();

export const slotBookingBodySchema = z
  .object({
    experienceId: z.uuid(),
    slotId: z.uuid(),
    participantCount: z.number().int().min(1).max(100),
    currency,
  })
  .strict();

export const cancelBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const checkInBodySchema = z
  .object({
    method: z.enum(["HOST_CODE", "PARTICIPANT_CODE", "MANUAL"]),
  })
  .strict();

export const disputeBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const noShowBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

function isCalendarDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}
