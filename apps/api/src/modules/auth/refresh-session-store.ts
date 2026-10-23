export type RefreshSessionStore = {
  createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findActiveSession(
    tokenHash: string,
  ): Promise<{ id: string; userId: string } | null>;
  revokeSession(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
};
