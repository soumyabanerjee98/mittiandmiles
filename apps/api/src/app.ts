import express, { type Express } from "express";
import type { Logger } from "./shared/logger.js";
import { MemoryAuditWriter } from "./modules/audit/memory-audit-writer.js";
import type { AuditWriter } from "./modules/audit/audit-writer.js";
import {
  createAuthVerifier,
  type AuthVerifier,
} from "./modules/auth/verifier.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import type { AuthService } from "./modules/auth/auth-service.js";
import { UnconfiguredPrivateStorage } from "./modules/catalogue/document-storage.js";
import { MemoryCatalogueStore } from "./modules/catalogue/memory-store.js";
import { createCatalogueRouter } from "./modules/catalogue/routes.js";
import { CatalogueService } from "./modules/catalogue/service.js";
import { createAccountRouter } from "./modules/users/account-routes.js";
import { MemoryUserRepository } from "./modules/users/memory-user-repository.js";
import type { UserRepository } from "./modules/users/user-repository.js";
import { errorHandler } from "./middleware/error-handler.js";
import { getRequestId, requestContext } from "./middleware/request-context.js";

export type AppDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
  auth: AuthService | null;
  catalogue?: CatalogueService;
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

  const catalogue =
    deps.catalogue ??
    new CatalogueService(
      new MemoryCatalogueStore(),
      new UnconfiguredPrivateStorage(),
    );
  app.use("/api/v1", createAccountRouter(deps));
  app.use(
    "/api/v1",
    createCatalogueRouter({
      verifier: deps.verifier,
      users: deps.users,
      audit: deps.audit,
      catalogue,
    }),
  );
  if (deps.auth !== null) {
    app.use("/api/v1", createAuthRouter(deps.auth));
  }

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
    verifier: createAuthVerifier({ mode: "development", jwt: null }),
    users: new MemoryUserRepository([]),
    audit: new MemoryAuditWriter(),
    auth: null,
  };
}
