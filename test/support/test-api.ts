import { createTodoUseCases } from "../../src/application/use-cases/todo-use-cases.js";
import { startHttpServer } from "../../src/infrastructure/http/server.js";
import { logger } from "../../src/infrastructure/logging/logger.js";
import { createApp } from "../../src/presentation/http/app.js";
import { TodoController } from "../../src/presentation/http/todo-controller.js";
import { InMemoryTodoRepository } from "./in-memory-todo-repository.js";

export interface TestApi {
  baseUrl: string;
  close(): Promise<void>;
}

/** Starts the real HTTP stack with an in-memory repository, without MongoDB. */
export async function startTestApi(): Promise<TestApi> {
  const controller = new TodoController(createTodoUseCases(new InMemoryTodoRepository()));
  const server = await startHttpServer(createApp({ todoController: controller, logger }), {
    port: 0,
    host: "127.0.0.1",
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    close: () => server.close(),
  };
}
