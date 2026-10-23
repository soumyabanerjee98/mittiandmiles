import { z } from "zod";
import { isIanaTimeZone } from "./time.js";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const languageCode = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/)
  .max(16);
const instant = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  );
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay);
const money = z.number().int().min(1).max(500_000_000);
const duration = z.number().int().min(15).max(1440);
const capacity = z.number().int().min(1).max(100);
const text = (max: number) => z.string().trim().min(1).max(max);
const note = z.string().trim().min(3).max(160);

export const cityBodySchema = z
  .object({
    slug,
    name: text(120),
    state: text(120),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    timezone: z.string().refine(isIanaTimeZone),
  })
  .strict();

export const cityStatusBodySchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
    reason: note,
  })
  .strict();

export const languageBodySchema = z
  .object({
    code: languageCode,
    name: text(80),
  })
  .strict();

export const categoryBodySchema = z
  .object({
    slug,
    name: text(120),
  })
  .strict();

export const onboardingBodySchema = z
  .object({
    publicName: text(120),
    bio: z.string().trim().max(2000).optional(),
    submit: z.boolean(),
  })
  .strict();

export const documentBodySchema = z
  .object({
    documentType: z.enum(["IDENTITY", "ADDRESS", "CREDENTIAL", "OTHER"]),
  })
  .strict();

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT", "NEEDS_INFORMATION"]),
    reason: note,
  })
  .strict();

const languageCodes = z
  .array(languageCode)
  .min(1)
  .max(8)
  .refine((codes) => new Set(codes).size === codes.length);

const experienceFields = {
  cityId: z.uuid(),
  category: slug,
  title: text(160),
  description: text(5000),
  durationMinutes: duration,
  basePriceMinor: money,
  currency: z.string().regex(/^[A-Z]{3}$/),
  capacity,
  inclusions: z.string().max(5000),
  exclusions: z.string().max(5000),
  meetingArea: text(240),
  accessibilityNotes: z.string().max(5000).optional(),
  safetyNotes: z.string().max(5000).optional(),
  cancellationPolicy: text(5000),
  languageCodes,
};

export const experienceBodySchema = z.object(experienceFields).strict();

export const experiencePatchSchema = z
  .object({
    cityId: experienceFields.cityId.optional(),
    category: experienceFields.category.optional(),
    title: experienceFields.title.optional(),
    description: experienceFields.description.optional(),
    durationMinutes: experienceFields.durationMinutes.optional(),
    basePriceMinor: experienceFields.basePriceMinor.optional(),
    currency: experienceFields.currency.optional(),
    capacity: experienceFields.capacity.optional(),
    inclusions: experienceFields.inclusions.optional(),
    exclusions: experienceFields.exclusions.optional(),
    meetingArea: experienceFields.meetingArea.optional(),
    accessibilityNotes: experienceFields.accessibilityNotes,
    safetyNotes: experienceFields.safetyNotes,
    cancellationPolicy: experienceFields.cancellationPolicy.optional(),
    languageCodes: experienceFields.languageCodes.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export const scheduleBodySchema = z
  .object({
    slots: z
      .array(
        z
          .object({
            startsAt: instant,
            endsAt: instant,
            capacity,
          })
          .strict(),
      )
      .max(120),
    blackouts: z
      .array(
        z
          .object({
            startsAt: instant,
            endsAt: instant,
          })
          .strict(),
      )
      .max(60),
  })
  .strict();

export const listingDecisionSchema = z
  .object({
    decision: z.enum(["PUBLISH", "REJECT", "UNPUBLISH", "ARCHIVE"]),
    reason: note,
  })
  .strict();

export const imageDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: note,
  })
  .strict();

export const idParamsSchema = z.object({
  id: z.uuid(),
});

export const hostIdParamsSchema = z.object({
  hostId: z.uuid(),
});

export const imageParamsSchema = z.object({
  id: z.uuid(),
  imageId: z.uuid(),
});

const intQuery = z
  .union([z.string().regex(/^\d+$/), z.number().int()])
  .transform((value) => (typeof value === "string" ? Number(value) : value));

export const pageQuerySchema = z
  .object({
    cursor: z.string().min(1).max(300).optional(),
    limit: intQuery.refine((value) => value >= 1 && value <= 50).optional(),
  })
  .strict();

export const discoveryQuerySchema = pageQuerySchema
  .extend({
    city: z.string().min(1).max(80).optional(),
    date: day.optional(),
    category: slug.optional(),
    language: languageCode.optional(),
    minPrice: intQuery.optional(),
    maxPrice: intQuery.optional(),
    minDuration: intQuery.optional(),
    maxDuration: intQuery.optional(),
    partySize: intQuery
      .refine((value) => value >= 1 && value <= 100)
      .optional(),
    verifiedHost: z.enum(["true", "false"]).optional(),
  })
  .strict();

export const availabilityQuerySchema = z
  .object({
    from: day,
    to: day,
    partySize: intQuery
      .refine((value) => value >= 1 && value <= 100)
      .optional(),
  })
  .strict();

export const hostQueueQuerySchema = pageQuerySchema
  .extend({
    verificationStatus: z
      .enum([
        "NOT_STARTED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
        "NEEDS_INFORMATION",
      ])
      .optional(),
  })
  .strict();

export const listingQueueQuerySchema = pageQuerySchema
  .extend({
    listingStatus: z
      .enum([
        "DRAFT",
        "IN_REVIEW",
        "PUBLISHED",
        "REJECTED",
        "UNPUBLISHED",
        "ARCHIVED",
      ])
      .optional(),
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
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(date)) {
    return false;
  }
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}
