import type { AppEnv } from "../../config/env.js";

export type JwtSettings = {
  secret: Uint8Array;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

export function jwtSettingsFromEnv(env: AppEnv): JwtSettings | null {
  if (env.JWT_SECRET === undefined) {
    return null;
  }
  return {
    secret: new TextEncoder().encode(env.JWT_SECRET),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  };
}
