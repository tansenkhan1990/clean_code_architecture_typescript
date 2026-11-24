import type { ErrorRequestHandler, Response } from "express";
import { mapError, type ErrorResponse } from "../error-mapper.js";
import type { Logger } from "../logging.js";

const INTERNAL_ERROR: ErrorResponse = {
  statusCode: 500,
  code: "INTERNAL_SERVER_ERROR",
  message: "An unexpected error occurred.",
};

/** Express adapter: known errors are mapped, unknown ones are logged as a generic 500. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, request, response, _next) => {
    const mapped = mapError(error);
    if (mapped) {
      sendErrorResponse(response, mapped);
      return;
    }

    logger.error("Unhandled request error", error, {
      method: request.method,
      path: request.originalUrl,
      requestId: response.getHeader("X-Request-Id"),
    });
    sendErrorResponse(response, INTERNAL_ERROR);
  };
}

/** Writes one error contract, shared by every HTTP middleware that answers with an error. */
export function sendErrorResponse(response: Response, error: ErrorResponse): void {
  const { statusCode, code, message, details } = error;
  const body = details === undefined ? { code, message } : { code, message, details };
  response.status(statusCode).json({ error: body });
}
