import type { RequestHandler } from "express";

/** Unknown routes are an HTTP concern, so they are answered before the error handler. */
export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "Route was not found." },
  });
};
