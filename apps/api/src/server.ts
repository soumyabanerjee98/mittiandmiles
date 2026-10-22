import { createServer } from "node:http";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
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
  const app = createApp(logger);
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "listening");
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, "shutting down");
    server.close((closeError) => {
      if (closeError) {
        logger.error({ message: closeError.message }, "shutdown failed");
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
