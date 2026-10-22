import type { AuditEntry, AuditWriter } from "./audit-writer.js";

export class MemoryAuditWriter implements AuditWriter {
  readonly entries: AuditEntry[] = [];

  write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
}

export class FailingAuditWriter implements AuditWriter {
  write(): Promise<void> {
    return Promise.reject(new Error("audit store unavailable"));
  }
}
