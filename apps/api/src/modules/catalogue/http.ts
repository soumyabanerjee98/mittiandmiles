import type { Response } from "express";
import { getRequestId } from "../../middleware/request-context.js";
import { HttpError } from "../../shared/http-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import { getActor, type RequestActor } from "../auth/actor.js";
import { type Permission, type Role } from "../auth/permissions.js";
import { decodeCursor } from "./discovery.js";
import { ResourceNotOwnedError } from "./service.js";

export async function assertPermission(
  res: Response,
  audit: AuditWriter,
  permission: Permission,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<RequestActor> {
  const actor = getActor(res);
  if (!actor.permissions.has(permission)) {
    await audit.write({
      actorUserId: actor.userId,
      action,
      resourceType,
      resourceId,
      requestId: getRequestId(res),
      outcome: "DENIED",
      reason: "forbidden",
    });
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource.",
    );
  }
  return actor;
}

export async function assertHostRole(
  res: Response,
  audit: AuditWriter,
  action: string,
): Promise<RequestActor> {
  const actor = getActor(res);
  const allowed = actor.grants.some(
    (grant) => grant.role === ("HOST" satisfies Role) && grant.scope === "",
  );
  if (!allowed) {
    await audit.write({
      actorUserId: actor.userId,
      action,
      resourceType: "host",
      resourceId: actor.userId,
      requestId: getRequestId(res),
      outcome: "DENIED",
      reason: "host-role-required",
    });
    throw new HttpError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource.",
    );
  }
  return actor;
}

export async function guardOwned<T>(
  res: Response,
  audit: AuditWriter,
  action: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    if (error instanceof ResourceNotOwnedError) {
      const actor = getActor(res);
      await audit.write({
        actorUserId: actor.userId,
        action,
        resourceType: error.resourceType,
        resourceId: error.resourceId,
        requestId: getRequestId(res),
        outcome: "DENIED",
        reason: "not-owner",
      });
    }
    throw error;
  }
}

export async function auditAllowed(
  res: Response,
  audit: AuditWriter,
  action: string,
  resourceType: string,
  resourceId: string,
  reason: string,
): Promise<void> {
  const actor = getActor(res);
  await audit.write({
    actorUserId: actor.userId,
    action,
    resourceType,
    resourceId,
    requestId: getRequestId(res),
    outcome: "ALLOWED",
    reason,
    metadata: { reason },
  });
}

export function readCursor(
  cursor: string | undefined,
): { createdAt: string; id: string } | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  const decoded = decodeCursor(cursor);
  if (decoded === null) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request validation failed.", [
      { field: "cursor", message: "Invalid value." },
    ]);
  }
  return decoded;
}

export function boundsError(
  min: number | undefined,
  max: number | undefined,
  field: string,
): void {
  if (min !== undefined && max !== undefined && min > max) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request validation failed.", [
      { field, message: "Invalid value." },
    ]);
  }
}
