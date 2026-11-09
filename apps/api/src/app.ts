import express, { type Express, type Request } from "express";
import type { Logger } from "./shared/logger.js";
import { MemoryAuditWriter } from "./modules/audit/memory-audit-writer.js";
import type { AuditWriter } from "./modules/audit/audit-writer.js";
import {
  createAuthVerifier,
  type AuthVerifier,
} from "./modules/auth/verifier.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import type { AuthService } from "./modules/auth/auth-service.js";
import { MemoryBookingStore } from "./modules/bookings/memory-store.js";
import { createBookingRouter } from "./modules/bookings/routes.js";
import { BookingService } from "./modules/bookings/service.js";
import { UnconfiguredPrivateStorage } from "./modules/catalogue/document-storage.js";
import { MemoryCatalogueStore } from "./modules/catalogue/memory-store.js";
import { createCatalogueRouter } from "./modules/catalogue/routes.js";
import { CatalogueService } from "./modules/catalogue/service.js";
import { MemoryPaymentStore } from "./modules/payments/memory-store.js";
import { createPaymentRouter } from "./modules/payments/routes.js";
import { PaymentService } from "./modules/payments/service.js";
import { UnconfiguredPaymentProvider } from "./modules/payments/sandbox-provider.js";
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
  bookings?: BookingService;
  payments?: PaymentService;
};

export function createApp(
  logger: Logger,
  deps: AppDependencies = unconfiguredDependencies(),
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext(logger));
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        if ((req.url ?? "").includes("/webhooks/payments/")) {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        }
      },
    }),
  );

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
  const bookings =
    deps.bookings ?? new BookingService(new MemoryBookingStore());
  const payments =
    deps.payments ??
    new PaymentService(
      new MemoryPaymentStore(),
      new UnconfiguredPaymentProvider(),
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
  app.use(
    "/api/v1",
    createBookingRouter({
      verifier: deps.verifier,
      users: deps.users,
      audit: deps.audit,
      bookings,
    }),
  );
  app.use(
    "/api/v1",
    createPaymentRouter({
      verifier: deps.verifier,
      users: deps.users,
      audit: deps.audit,
      payments,
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
