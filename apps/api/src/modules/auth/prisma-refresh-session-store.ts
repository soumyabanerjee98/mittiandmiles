import type { PrismaClient } from "@prisma/client";
import type { RefreshSessionStore } from "./refresh-session-store.js";

export class PrismaRefreshSessionStore implements RefreshSessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.authRefreshSession.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findActiveSession(
    tokenHash: string,
  ): Promise<{ id: string; userId: string } | null> {
    const session = await this.prisma.authRefreshSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });
    return session;
  }

  async revokeSession(id: string): Promise<void> {
    await this.prisma.authRefreshSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authRefreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
