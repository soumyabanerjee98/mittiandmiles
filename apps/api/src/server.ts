import { createServer } from "node:http";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./db/client.js";
import { createApp } from "./app.js";
import { PrismaAuditWriter } from "./modules/audit/prisma-audit-writer.js";
import { createAuthVerifier } from "./modules/auth/verifier.js";
import { PrismaUserRepository } from "./modules/users/prisma-user-repository.js";
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
  const app = createApp(logger, {
    verifier: createAuthVerifier(env.AUTH_MODE),
    users: new PrismaUserRepository(prisma),
    audit: new PrismaAuditWriter(prisma),
  });
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "listening");
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
