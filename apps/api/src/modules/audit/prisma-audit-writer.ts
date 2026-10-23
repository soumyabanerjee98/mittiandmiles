import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AuditEntry, AuditWriter } from "./audit-writer.js";

export class PrismaAuditWriter implements AuditWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async write(entry: AuditEntry): Promise<void> {
    const metadata: Prisma.InputJsonObject = {
      ...(entry.metadata ?? {}),
    };
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        requestId: entry.requestId,
        outcome: entry.outcome,
        reason: entry.reason ?? null,
        metadata,
      },
    });
  }
}
