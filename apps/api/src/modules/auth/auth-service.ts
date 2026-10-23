import { HttpError } from "../../shared/http-error.js";
import { LOCAL_AUTH_PROVIDER } from "./constants.js";
import { hashRefreshToken, JwtService } from "./jwt-service.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { RefreshSessionStore } from "./refresh-session-store.js";
import type { AuthUserRepository } from "../users/auth-user-repository.js";

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export class AuthService {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly sessions: RefreshSessionStore,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    locale: string;
  }): Promise<TokenResponse> {
    const existing = await this.users.findByEmail(input.email);
    if (existing !== null) {
      throw new HttpError(409, "EMAIL_IN_USE", "An account already exists.");
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.users.createLocalUser({
      email: input.email,
      passwordHash,
      locale: input.locale,
    });
    return this.issueTokensForUser(user.id);
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<TokenResponse> {
    const credentials = await this.users.findCredentialsByEmail(input.email);
    if (credentials === null) {
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }
    const valid = await verifyPassword(
      input.password,
      credentials.passwordHash,
    );
    if (!valid) {
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }
    if (credentials.user.accountStatus !== "ACTIVE") {
      throw new HttpError(
        403,
        "ACCOUNT_DISABLED",
        "This account cannot access the API.",
      );
    }
    return this.issueTokensForUser(credentials.user.id);
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessions.findActiveSession(tokenHash);
    if (session === null) {
      throw new HttpError(401, "INVALID_REFRESH", "Refresh token is invalid.");
    }
    const user = await this.users.findById(session.userId);
    if (user === null || user.accountStatus !== "ACTIVE") {
      throw new HttpError(401, "INVALID_REFRESH", "Refresh token is invalid.");
    }
    await this.sessions.revokeSession(session.id);
    return this.issueTokensForUser(user.id);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessions.findActiveSession(tokenHash);
    if (session !== null) {
      await this.sessions.revokeSession(session.id);
    }
  }

  private async issueTokensForUser(userId: string): Promise<TokenResponse> {
    const access = await this.jwt.issueAccessToken(userId);
    const refresh = this.jwt.createRefreshToken();
    await this.sessions.createSession(
      userId,
      refresh.tokenHash,
      refresh.expiresAt,
    );
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: "Bearer",
      expiresIn: Math.floor((access.expiresAt.getTime() - Date.now()) / 1000),
    };
  }
}

export { LOCAL_AUTH_PROVIDER };
