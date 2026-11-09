import { z } from "zod";

const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(logLevels).default("info"),
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url().optional(),
    // development: dev bearer tokens; optional JWT when JWT_SECRET is set.
    // jwt: access JWT only (requires JWT_SECRET).
    AUTH_MODE: z.enum(["development", "jwt"]).default("development"),
    JWT_SECRET: z.string().min(32).optional(),
    JWT_ISSUER: z.string().min(1).default("mittiandmiles-api"),
    JWT_AUDIENCE: z.string().min(1).default("mittiandmiles-mobile"),
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(2_592_000)
      .default(604_800),
    // sandbox is an in-process provider with signature checks. It is not a
    // licence to hold funds or delay settlement. Production must not use it.
    PAYMENT_PROVIDER: z
      .enum(["unconfigured", "sandbox", "razorpay"])
      .default("unconfigured"),
    PAYMENT_SANDBOX_KEY_ID: z.string().min(8).max(64).optional(),
    PAYMENT_SANDBOX_KEY_SECRET: z.string().min(16).max(256).optional(),
    PAYMENT_SANDBOX_WEBHOOK_SECRET: z.string().min(16).max(256).optional(),
    RAZORPAY_KEY_ID: z.string().min(8).max(64).optional(),
    RAZORPAY_KEY_SECRET: z.string().min(8).max(128).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(8).max(256).optional(),
    // RazorpayX current-account number. Required only when submitting a host payout.
    RAZORPAYX_ACCOUNT_NUMBER: z
      .string()
      .regex(/^[0-9]{8,30}$/)
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === "jwt" && env.JWT_SECRET === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required when AUTH_MODE is jwt.",
      });
    }
    if (env.NODE_ENV === "production" && env.PAYMENT_PROVIDER === "sandbox") {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENT_PROVIDER"],
        message: "Sandbox payments cannot be used in production.",
      });
    }
    if (env.PAYMENT_PROVIDER === "sandbox") {
      const required = [
        "PAYMENT_SANDBOX_KEY_ID",
        "PAYMENT_SANDBOX_KEY_SECRET",
        "PAYMENT_SANDBOX_WEBHOOK_SECRET",
      ] as const;
      for (const name of required) {
        if (env[name] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: `${name} is required when PAYMENT_PROVIDER is sandbox.`,
          });
        }
      }
    }
    if (env.PAYMENT_PROVIDER === "razorpay") {
      const required = [
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
      ] as const;
      for (const name of required) {
        if (env[name] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: `${name} is required when PAYMENT_PROVIDER is razorpay.`,
          });
        }
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;
export type LogLevel = AppEnv["LOG_LEVEL"];

export function loadEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues
      .map((issue) => issue.path.join(".") || "environment")
      .join(", ");
    throw new Error(`Invalid environment: ${names}`);
  }
  return parsed.data;
}
