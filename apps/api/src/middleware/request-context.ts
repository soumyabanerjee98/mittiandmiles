import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../shared/logger.js";

const requestIdPattern = /^[A-Za-z0-9-]{1,128}$/;

export function getRequestId(res: Response): string {
  const value: unknown = res.locals.requestId;
  return typeof value === "string" ? value : "unknown";
}

export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header("x-request-id");
    const requestId =
      incoming !== undefined && requestIdPattern.test(incoming)
        ? incoming
        : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        "request",
      );
    });

    next();
  };
}
