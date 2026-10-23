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

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  DATABASE_URL: z.url(),
  // Used by Prisma migrations. Runtime queries use DATABASE_URL.
  DIRECT_URL: z.url().optional(),
  // development: local subject tokens. unconfigured: reject every token.
  AUTH_MODE: z.enum(["development", "unconfigured"]).default("unconfigured"),
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
