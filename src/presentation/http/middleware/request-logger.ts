import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../infrastructure/logging/logger.js";

export function requestLogger(request: Request, response: Response, next: NextFunction): void {
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
}
