import type { ErrorRequestHandler } from "express";
import type { Logger } from "../shared/logger.js";
import { HttpError } from "../shared/http-error.js";
import { getRequestId } from "./request-context.js";

type ErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: { field: string; message: string }[];
  };
};

function errorBody(
  code: string,
  message: string,
  requestId: string,
): ErrorBody {
  return { error: { code, message, requestId } };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const requestId = getRequestId(res);
    const statusFromParser =
      err instanceof SyntaxError && "status" in err && err.status === 400
        ? 400
        : undefined;

    if (statusFromParser === 400) {
      logger.warn({ requestId }, "invalid json");
      res
        .status(400)
        .json(
          errorBody(
            "INVALID_JSON",
            "Request body must be valid JSON.",
            requestId,
          ),
        );
      return;
    }

    if (err instanceof HttpError) {
      logger.warn(
        { requestId, code: err.code, statusCode: err.statusCode },
        "request rejected",
      );
      const body = errorBody(err.code, err.message, requestId);
      if (err.details.length > 0) {
        body.error.details = [...err.details];
      }
      res.status(err.statusCode).json(body);
      return;
    }

    const message = err instanceof Error ? err.message : "Unhandled error";
    logger.error(
      {
        requestId,
        errorName: err instanceof Error ? err.name : "Error",
        message,
      },
      "unhandled error",
    );

    if (res.headersSent) {
      return;
    }

    res
      .status(500)
      .json(errorBody("INTERNAL_ERROR", "Something went wrong.", requestId));
  };
}
