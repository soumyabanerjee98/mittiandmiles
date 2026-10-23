/**
 * Authentication integration seam.
 *
 * The identity provider is not selected. This module verifies a bearer
 * token and returns the provider subject. It does not issue tokens,
 * register accounts, or accept a role from the client.
 *
 * `development` accepts only `Bearer dev:<provider>:<subject>` so local
 * and test callers can name a subject. `unconfigured` rejects every
 * token. There is no mode that trusts a client-supplied role.
 */
export type AuthMode = "development" | "unconfigured";

export type VerifiedIdentity = {
  provider: string;
  subject: string;
};

export type AuthVerifier = {
  verify(
    authorizationHeader: string | undefined,
  ): Promise<VerifiedIdentity | null>;
};

const developmentToken = /^dev:([a-z0-9_-]{1,64}):([A-Za-z0-9._-]{1,128})$/;

export function createAuthVerifier(mode: AuthMode): AuthVerifier {
  return {
    verify(authorizationHeader: string | undefined) {
      return Promise.resolve(verifyHeader(mode, authorizationHeader));
    },
  };
}

function verifyHeader(
  mode: AuthMode,
  authorizationHeader: string | undefined,
): VerifiedIdentity | null {
  if (mode !== "development" || authorizationHeader === undefined) {
    return null;
  }
  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) {
    return null;
  }
  const match = developmentToken.exec(authorizationHeader.slice(prefix.length));
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
