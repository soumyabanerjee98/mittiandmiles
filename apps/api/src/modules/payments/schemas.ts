import { z } from "zod";

const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int().positive().max(500_000_000);

export const idParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const providerParamsSchema = z
  .object({
    provider: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  })
  .strict();

export const paymentIntentBodySchema = z.object({}).strict();

export const refundBodySchema = z
  .object({
    amountMinor: minor.optional(),
    reasonCode: z.string().regex(/^[a-z0-9_]{2,64}$/),
  })
  .strict();

export const reviewBodySchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    amountMinor: minor.optional(),
  })
  .strict();

export const payoutListQuerySchema = z
  .object({
    status: z
      .enum([
        "PENDING_ELIGIBILITY",
        "ELIGIBLE",
        "SUBMITTED",
        "SETTLED",
        "FAILED",
        "ON_HOLD",
      ])
      .optional(),
  })
  .strict();

export const settlePayoutBodySchema = z
  .object({
    mode: z.enum(["NEFT", "IMPS", "RTGS", "UPI"]).optional(),
  })
  .strict();

export const payoutBodySchema = z
  .object({
    hostId: z.uuid(),
    currency,
    allocations: z
      .array(
        z
          .object({
            bookingId: z.uuid(),
            amountMinor: minor,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((body, ctx) => {
    const ids = body.allocations.map((row) => row.bookingId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Invalid value.",
      });
    }
  });
