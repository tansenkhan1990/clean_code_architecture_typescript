import type { ErrorRequestHandler, Response } from "express";
import { logger } from "../../../infrastructure/logging/logger.js";
import { mapError, type ErrorResponse } from "../error-mapper.js";

const INTERNAL_ERROR: ErrorResponse = {
  statusCode: 500,
  code: "INTERNAL_SERVER_ERROR",
  message: "An unexpected error occurred.",
};

/** Express adapter: known errors are mapped, unknown ones are logged as a generic 500. */
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const mapped = mapError(error);
  if (mapped) {
    sendError(response, mapped);
    return;
  }

  logger.error("Unhandled request error", error, {
    method: request.method,
    path: request.originalUrl,
    requestId: response.getHeader("X-Request-Id"),
  });
  sendError(response, INTERNAL_ERROR);
};

function sendError(response: Response, error: ErrorResponse): void {
  const { statusCode, code, message, details } = error;
  const body = details === undefined ? { code, message } : { code, message, details };
  response.status(statusCode).json({ error: body });
}
