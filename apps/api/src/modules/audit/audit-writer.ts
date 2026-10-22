export type AuditOutcome = "ALLOWED" | "DENIED";

export type AuditEntry = {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  outcome: AuditOutcome;
  reason?: string;
  metadata?: Readonly<Record<string, string>>;
};

export type AuditWriter = {
  write(entry: AuditEntry): Promise<void>;
};
