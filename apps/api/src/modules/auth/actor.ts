import type { Response } from "express";
import { HttpError } from "../../shared/http-error.js";
import {
  permissionsFor,
  type Permission,
  type RoleGrant,
} from "./permissions.js";

export type RequestActor = {
  userId: string;
  grants: readonly RoleGrant[];
  permissions: ReadonlySet<Permission>;
};

export function actorFromGrants(
  userId: string,
  grants: readonly RoleGrant[],
): RequestActor {
  return {
    userId,
    grants,
    permissions: permissionsFor(grants),
  };
}

export function getActor(res: Response): RequestActor {
  const value: unknown = res.locals.actor;
  if (!isActor(value)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  return value;
}

function isActor(value: unknown): value is RequestActor {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("userId" in value) || typeof value.userId !== "string") {
    return false;
  }
  if (!("permissions" in value) || !(value.permissions instanceof Set)) {
    return false;
  }
  return "grants" in value && Array.isArray(value.grants);
}
