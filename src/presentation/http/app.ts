import express, { type Express } from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createTodoRoutes } from "./todo-routes.js";
import type { TodoController } from "./todo-controller.js";

export function createApp(todoController: TodoController): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestLogger);
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/todos", createTodoRoutes(todoController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
