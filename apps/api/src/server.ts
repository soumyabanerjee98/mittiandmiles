import { createServer } from "node:http";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./db/client.js";
import { createApp } from "./app.js";
import { AuthService } from "./modules/auth/auth-service.js";
import { jwtSettingsFromEnv } from "./modules/auth/jwt-config.js";
import { JwtService } from "./modules/auth/jwt-service.js";
import { PrismaRefreshSessionStore } from "./modules/auth/prisma-refresh-session-store.js";
import { createAuthVerifier } from "./modules/auth/verifier.js";
import { PrismaAuditWriter } from "./modules/audit/prisma-audit-writer.js";
import { PrismaBookingStore } from "./modules/bookings/prisma-store.js";
import { BookingService } from "./modules/bookings/service.js";
import { UnconfiguredPrivateStorage } from "./modules/catalogue/document-storage.js";
import { PrismaCatalogueStore } from "./modules/catalogue/prisma-store.js";
import { CatalogueService } from "./modules/catalogue/service.js";
import { PrismaAuthUserRepository } from "./modules/users/prisma-auth-user-repository.js";
import { createLogger } from "./shared/logger.js";

function start(): void {
  let env;
  try {
    env = loadEnv(process.env);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Invalid environment";
    console.error(message);
    process.exit(1);
  }

  const logger = createLogger(env.LOG_LEVEL);
  const prisma = createPrismaClient();
  const jwtSettings = jwtSettingsFromEnv(env);
  const jwt = jwtSettings === null ? null : new JwtService(jwtSettings);
  const users = new PrismaAuthUserRepository(prisma);
  const auth =
    jwt === null
      ? null
      : new AuthService(users, new PrismaRefreshSessionStore(prisma), jwt);

  const app = createApp(logger, {
    verifier: createAuthVerifier({ mode: env.AUTH_MODE, jwt }),
    users,
    audit: new PrismaAuditWriter(prisma),
    auth,
    catalogue: new CatalogueService(
      new PrismaCatalogueStore(prisma),
      new UnconfiguredPrivateStorage(),
    ),
    bookings: new BookingService(new PrismaBookingStore(prisma)),
  });
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        authMode: env.AUTH_MODE,
        jwtEnabled: jwt !== null,
      },
      "listening",
    );
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, "shutting down");
    server.close((closeError) => {
      void prisma.$disconnect().finally(() => {
        if (closeError) {
          logger.error({ message: closeError.message }, "shutdown failed");
          process.exit(1);
        }
        process.exit(0);
      });
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
