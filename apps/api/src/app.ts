import express, { type Express } from "express";
import type { Logger } from "./shared/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { getRequestId, requestContext } from "./middleware/request-context.js";

export function createApp(logger: Logger): Express {
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
