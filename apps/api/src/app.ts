import express, { type Express } from "express";
import type { Logger } from "./shared/logger.js";
import { MemoryAuditWriter } from "./modules/audit/memory-audit-writer.js";
import type { AuditWriter } from "./modules/audit/audit-writer.js";
import {
  createAuthVerifier,
  type AuthVerifier,
} from "./modules/auth/verifier.js";
import { createAccountRouter } from "./modules/users/account-routes.js";
import { MemoryUserRepository } from "./modules/users/memory-user-repository.js";
import type { UserRepository } from "./modules/users/user-repository.js";
import { errorHandler } from "./middleware/error-handler.js";
import { getRequestId, requestContext } from "./middleware/request-context.js";

export type AppDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
};

export function createApp(
  logger: Logger,
  deps: AppDependencies = unconfiguredDependencies(),
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext(logger));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "mittiandmiles-api",
    });
  });

  app.use("/api/v1", createAccountRouter(deps));

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Not found.",
        requestId: getRequestId(res),
      },
    });
  });

  app.use(errorHandler(logger));
  return app;
}

function unconfiguredDependencies(): AppDependencies {
  return {
    verifier: createAuthVerifier("unconfigured"),
    users: new MemoryUserRepository([]),
    audit: new MemoryAuditWriter(),
  };
}
