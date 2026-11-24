import express, { type Express } from "express";
import helmet from "helmet";
import { createErrorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import { createRequestLogger } from "./middleware/request-logger.js";
import type { Logger } from "./logging.js";
import { createTodoRoutes } from "./todo-routes.js";
import type { TodoController } from "./todo-controller.js";

export interface AppDependencies {
  readonly todoController: TodoController;
  readonly logger: Logger;
}

export function createApp({ todoController, logger }: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(createRequestLogger(logger));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/todos", createTodoRoutes(todoController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
