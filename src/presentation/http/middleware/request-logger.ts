import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "../logging.js";

/** Adds a request id and logs one structured line when the response finishes. */
export function createRequestLogger(logger: Logger): RequestHandler {
  return (request, response, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    // Express rewrites request.path while routing, so snapshot the full URL now.
    const path = request.originalUrl;
    response.setHeader("X-Request-Id", requestId);

    response.on("finish", () => {
      logger.info("HTTP request", {
        requestId,
        method: request.method,
        path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  };
}
