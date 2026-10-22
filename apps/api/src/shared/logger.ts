import { pino, type Logger } from "pino";
import type { LogLevel } from "../config/env.js";

export type { Logger };

export function createLogger(level: LogLevel): Logger {
  return pino({
    level,
    base: { service: "mittiandmiles-api" },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
      ],
      censor: "[redacted]",
    },
  });
}
