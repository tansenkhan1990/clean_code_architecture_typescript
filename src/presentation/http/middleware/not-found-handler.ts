import type { RequestHandler } from "express";
import { sendErrorResponse } from "./error-handler.js";

/** Unknown routes are an HTTP concern, so they are answered before the error handler. */
export const notFoundHandler: RequestHandler = (_request, response) => {
  sendErrorResponse(response, {
    statusCode: 404,
    code: "ROUTE_NOT_FOUND",
    message: "Route was not found.",
  });
};
