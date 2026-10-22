import type { RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { HttpError, type FieldDetail } from "../shared/http-error.js";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(validationError(parsed.error.issues));
      return;
    }
    res.locals.parsedBody = parsed.data;
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      next(validationError(parsed.error.issues));
      return;
    }
    res.locals.parsedParams = parsed.data;
    next();
  };
}

export function readParsedBody<T>(res: Response, schema: ZodType<T>): T {
  return readParsed(res.locals.parsedBody, schema);
}

export function readParsedParams<T>(res: Response, schema: ZodType<T>): T {
  return readParsed(res.locals.parsedParams, schema);
}

function readParsed<T>(value: unknown, schema: ZodType<T>): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(500, "INTERNAL_ERROR", "Something went wrong.");
  }
  return parsed.data;
}

function validationError(
  issues: readonly {
    path: readonly PropertyKey[];
    keys?: readonly PropertyKey[];
  }[],
): HttpError {
  const details: FieldDetail[] = [];
  for (const issue of issues) {
    const unrecognized = issue.keys ?? [];
    if (unrecognized.length > 0) {
      for (const key of unrecognized) {
        details.push({ field: String(key), message: "Invalid value." });
      }
      continue;
    }
    details.push({
      field: issue.path.map((segment) => String(segment)).join(".") || "body",
      message: "Invalid value.",
    });
  }
  return new HttpError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed.",
    details,
  );
}
