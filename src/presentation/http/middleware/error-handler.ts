import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../../domain/errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (isMalformedJsonError(error)) {
    response.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." },
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: "Unhandled request error",
      method: request.method,
      path: request.path,
      requestId: response.getHeader("X-Request-Id"),
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
  });
};

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}
