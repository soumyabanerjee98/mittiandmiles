import type { RefreshSessionStore } from "./refresh-session-store.js";

type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export class MemoryRefreshSessionStore implements RefreshSessionStore {
  private readonly sessions: Session[] = [];
  private nextId = 1;

  createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sessions.push({
      id: String(this.nextId++),
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
    return Promise.resolve();
  }

  findActiveSession(
    tokenHash: string,
  ): Promise<{ id: string; userId: string } | null> {
    const now = new Date();
    const session = this.sessions.find(
      (row) =>
        row.tokenHash === tokenHash &&
        row.revokedAt === null &&
        row.expiresAt > now,
    );
    return Promise.resolve(
      session === undefined ? null : { id: session.id, userId: session.userId },
    );
  }

  revokeSession(id: string): Promise<void> {
    const session = this.sessions.find((row) => row.id === id);
    if (session !== undefined) {
      session.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeAllForUser(userId: string): Promise<void> {
    const revokedAt = new Date();
    for (const session of this.sessions) {
      if (session.userId === userId && session.revokedAt === null) {
        session.revokedAt = revokedAt;
      }
    }
    return Promise.resolve();
  }
}
