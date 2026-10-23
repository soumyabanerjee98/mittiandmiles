import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ACCESS_TOKEN_TYPE, JWT_PROVIDER } from "./constants.js";
import type { JwtSettings } from "./jwt-config.js";

export type AccessTokenClaims = {
  sub: string;
  typ: typeof ACCESS_TOKEN_TYPE;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
};

export class JwtService {
  constructor(private readonly settings: JwtSettings) {}

  async issueAccessToken(userId: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const expiresAt = new Date(
      Date.now() + this.settings.accessTtlSeconds * 1000,
    );
    const token = await new SignJWT({
      typ: ACCESS_TOKEN_TYPE,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.settings.secret);
    return { token, expiresAt };
  }

  createRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashRefreshToken(token);
    const expiresAt = new Date(
      Date.now() + this.settings.refreshTtlSeconds * 1000,
    );
    return { token, tokenHash, expiresAt };
  }

  async verifyAccessToken(
    bearerToken: string,
  ): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(bearerToken, this.settings.secret, {
        issuer: this.settings.issuer,
        audience: this.settings.audience,
      });
      return parseAccessClaims(payload);
    } catch {
      return null;
    }
  }

  refreshTtlSeconds(): number {
    return this.settings.refreshTtlSeconds;
  }
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseAccessClaims(payload: JWTPayload): AccessTokenClaims | null {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return null;
  }
  if (payload.typ !== ACCESS_TOKEN_TYPE) {
    return null;
  }
  return { sub: payload.sub, typ: ACCESS_TOKEN_TYPE };
}

export function verifiedIdentityFromAccess(claims: AccessTokenClaims): {
  provider: typeof JWT_PROVIDER;
  subject: string;
} {
  return { provider: JWT_PROVIDER, subject: claims.sub };
}
