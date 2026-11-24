import { ZodError } from "zod";
import { NotFoundError, ValidationError } from "../../application/errors/application-error.js";
import { HttpError } from "./http-error.js";

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

export interface ErrorResponse {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: ValidationIssue[];
}

/**
 * Maps a thrown value onto the HTTP error contract. Returns `undefined` for
 * unknown errors, so the middleware can log them without leaking details.
 */
export function mapError(error: unknown): ErrorResponse | undefined {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  if (error instanceof ValidationError) {
    return { statusCode: 400, code: error.code, message: error.message };
  }

  if (error instanceof NotFoundError) {
    return { statusCode: 404, code: error.code, message: error.message };
  }

  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }

  if (isMalformedJsonError(error)) {
    return {
      statusCode: 400,
      code: "INVALID_JSON",
      message: "Request body must contain valid JSON.",
    };
  }

  return undefined;
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}
