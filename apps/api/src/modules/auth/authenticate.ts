import type { RequestHandler } from "express";
import { HttpError } from "../../shared/http-error.js";
import { asyncMiddleware } from "../../middleware/async-handler.js";
import { actorFromGrants } from "./actor.js";
import type { AuthVerifier } from "./verifier.js";
import type { UserRepository } from "../users/user-repository.js";

export function createAuthenticate(
  verifier: AuthVerifier,
  users: UserRepository,
): RequestHandler {
  return asyncMiddleware(async (req, res) => {
    const identity = await verifier.verify(req.header("authorization"));
    if (identity === null) {
      throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
    }
    const user = await users.findByAuthSubject(
      identity.provider,
      identity.subject,
    );
    if (user === null || user.accountStatus !== "ACTIVE") {
      if (user !== null && user.accountStatus !== "ACTIVE") {
        throw new HttpError(
          403,
          "ACCOUNT_DISABLED",
          "This account cannot access the API.",
        );
      }
      throw new HttpError(401, "UNAUTHENTICATED", "Authentication required.");
    }
    res.locals.actor = actorFromGrants(user.id, user.roles);
  });
}
