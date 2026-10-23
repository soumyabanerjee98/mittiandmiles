import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../../middleware/async-handler.js";
import {
  readParsedBody,
  readParsedParams,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { getRequestId } from "../../middleware/request-context.js";
import { HttpError } from "../../shared/http-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import { getActor } from "../auth/actor.js";
import { createAuthenticate } from "../auth/authenticate.js";
import { hasAdminAccess, Permission } from "../auth/permissions.js";
import type { AuthVerifier } from "../auth/verifier.js";
import type { UserRecord, UserRepository } from "./user-repository.js";

const patchMeBodySchema = z
  .object({
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  })
  .strict();

const userIdParamsSchema = z.object({
  userId: z.uuid(),
});

export type AccountDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
};

export function createAccountRouter(deps: AccountDependencies): Router {
  const authenticate = createAuthenticate(deps.verifier, deps.users);
  const router = Router();

  router.get(
    "/me",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = getActor(res);
      const user = await deps.users.findById(actor.userId);
      if (user === null) {
        throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
      }
      res.status(200).json(meBody(user));
    }),
  );

  router.patch(
    "/me",
    authenticate,
    validateBody(patchMeBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = getActor(res);
      const body = readParsedBody(res, patchMeBodySchema);
      const user = await deps.users.updateLocale(actor.userId, body.locale);
      if (user === null) {
        throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
      }
      res.status(200).json(meBody(user));
    }),
  );

  router.get(
    "/users/:userId",
    authenticate,
    validateParams(userIdParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = getActor(res);
      const params = readParsedParams(res, userIdParamsSchema);
      const ownsRecord = actor.userId === params.userId;
      const staffRead = actor.permissions.has(Permission.USER_READ);
      if (!ownsRecord && !staffRead) {
        await deps.audit.write({
          actorUserId: actor.userId,
          action: "user.read",
          resourceType: "user",
          resourceId: params.userId,
          requestId: getRequestId(res),
          outcome: "DENIED",
          reason: "forbidden",
          metadata: { targetUserId: params.userId },
        });
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You do not have access to this resource.",
        );
      }

      if (!ownsRecord) {
        await deps.audit.write({
          actorUserId: actor.userId,
          action: "user.read",
          resourceType: "user",
          resourceId: params.userId,
          requestId: getRequestId(res),
          outcome: "ALLOWED",
          metadata: { targetUserId: params.userId },
        });
      }

      const user = await deps.users.findById(params.userId);
      if (user === null) {
        throw new HttpError(404, "NOT_FOUND", "Not found.");
      }

      if (ownsRecord) {
        res.status(200).json(meBody(user));
        return;
      }

      res.status(200).json({
        id: user.id,
        accountStatus: user.accountStatus,
      });
    }),
  );

  return router;
}

function meBody(user: UserRecord): {
  id: string;
  email: string;
  accountStatus: UserRecord["accountStatus"];
  locale: string;
  roles: string[];
  adminAccess: boolean;
} {
  return {
    id: user.id,
    email: user.email,
    accountStatus: user.accountStatus,
    locale: user.locale,
    roles: user.roles.map((grant) => grant.role),
    adminAccess: hasAdminAccess(user.roles),
  };
}
