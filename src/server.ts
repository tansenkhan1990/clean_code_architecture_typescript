import { env } from "./config/env.js";
import { CreateTodo } from "./application/use-cases/create-todo.js";
import { DeleteTodo } from "./application/use-cases/delete-todo.js";
import { GetTodo } from "./application/use-cases/get-todo.js";
import { ListTodos } from "./application/use-cases/list-todos.js";
import { UpdateTodo } from "./application/use-cases/update-todo.js";
import { connectToMongo } from "./infrastructure/database/mongo-database.js";
import { MongoTodoRepository } from "./infrastructure/repositories/mongo-todo-repository.js";
import { createApp } from "./presentation/http/app.js";
import { TodoController } from "./presentation/http/todo-controller.js";

async function startServer(): Promise<void> {
  const { client, todos } = await connectToMongo(env.MONGODB_URI, env.MONGODB_DATABASE);
  const todoRepository = new MongoTodoRepository(todos);
  const todoController = new TodoController({
    create: new CreateTodo(todoRepository),
    list: new ListTodos(todoRepository),
    get: new GetTodo(todoRepository),
    update: new UpdateTodo(todoRepository),
    delete: new DeleteTodo(todoRepository),
  });

  const app = createApp(todoController);
  const server = app.listen(env.PORT, () => {
    console.log(JSON.stringify({ level: "info", message: "API listening", port: env.PORT }));
  });

  let isShuttingDown = false;
  const shutDown = (signal: string): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(JSON.stringify({ level: "info", message: "Shutting down", signal }));
    server.close((error) => {
      if (error) process.exitCode = 1;
      void client.close().catch((closeError: unknown) => {
        console.error(JSON.stringify({
          level: "error",
          message: "Could not close MongoDB connection",
          error: closeError instanceof Error ? closeError.message : String(closeError),
        }));
        process.exitCode = 1;
      });
    });
  };

  process.on("SIGINT", () => shutDown("SIGINT"));
  process.on("SIGTERM", () => shutDown("SIGTERM"));
}

void startServer().catch((error: unknown) => {
  console.error(JSON.stringify({
    level: "error",
    message: "Could not start API",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
