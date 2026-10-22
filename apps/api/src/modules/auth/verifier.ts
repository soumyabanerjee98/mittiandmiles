/**
 * Verifies bearer credentials. Roles are never read from the token payload
 * beyond the user id (JWT `sub`). Account permissions are loaded from the DB.
 *
 * - `development`: `Bearer dev:<provider>:<subject>` for seeded local users.
 * - `jwt`: HS256 access JWTs when `JwtService` is configured.
 * - In `development`, JWTs are also accepted when `JwtService` is configured.
 */
import { JWT_PROVIDER } from "./constants.js";
import type { JwtService } from "./jwt-service.js";
import { verifiedIdentityFromAccess } from "./jwt-service.js";

export type AuthMode = "development" | "jwt";

export type VerifiedIdentity = {
  provider: string;
  subject: string;
};

export type AuthVerifier = {
  verify(
    authorizationHeader: string | undefined,
  ): Promise<VerifiedIdentity | null>;
};

export type AuthVerifierConfig = {
  mode: AuthMode;
  jwt: JwtService | null;
};

const developmentToken = /^dev:([a-z0-9_-]{1,64}):([A-Za-z0-9._-]{1,128})$/;

export function createAuthVerifier(config: AuthVerifierConfig): AuthVerifier {
  return {
    async verify(authorizationHeader: string | undefined) {
      const bearer = readBearerToken(authorizationHeader);
      if (bearer === null) {
        return null;
      }

      if (config.mode === "development") {
        const dev = parseDevelopmentToken(bearer);
        if (dev !== null) {
          return dev;
        }
      }

      if (config.jwt !== null) {
        const claims = await config.jwt.verifyAccessToken(bearer);
        if (claims !== null) {
          return verifiedIdentityFromAccess(claims);
        }
      }

      if (config.mode === "jwt" && config.jwt === null) {
        return null;
      }

      return null;
    },
  };
}

function readBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (authorizationHeader === undefined) {
    return null;
  }
  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) {
    return null;
  }
  const token = authorizationHeader.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function parseDevelopmentToken(token: string): VerifiedIdentity | null {
  const match = developmentToken.exec(token);
  if (match === null) {
    return null;
  }
  const provider = match[1];
  const subject = match[2];
  if (provider === undefined || subject === undefined) {
    return null;
  }
  return { provider, subject };
}

export { JWT_PROVIDER };
