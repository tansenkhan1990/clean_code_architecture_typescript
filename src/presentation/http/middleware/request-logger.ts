import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startedAt = Date.now();
  response.setHeader("X-Request-Id", requestId);

  response.on("finish", () => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "HTTP request",
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });

  next();
}
