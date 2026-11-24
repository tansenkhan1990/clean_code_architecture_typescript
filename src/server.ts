import type { Server } from "node:http";
import type { Express } from "express";
import type { MongoClient } from "mongodb";
import { createTodoUseCases } from "./application/use-cases/todo-use-cases.js";
import { env } from "./config/env.js";
import { connectToMongo } from "./infrastructure/database/mongo-database.js";
import { MongoTodoRepository } from "./infrastructure/repositories/mongo-todo-repository.js";
import { createApp } from "./presentation/http/app.js";
import { TodoController } from "./presentation/http/todo-controller.js";

/** Composition root: connect the outer adapters to the application and start HTTP. */
async function startServer(): Promise<void> {
  const { client, todos } = await connectToMongo(env.MONGODB_URI, env.MONGODB_DATABASE);

  try {
    const todoRepository = new MongoTodoRepository(todos);
    const todoUseCases = createTodoUseCases(todoRepository);
    const todoController = new TodoController(todoUseCases);
    const app = createApp(todoController);
    const server = await listen(app, env.PORT);

    logInfo("API listening", { port: env.PORT });
    registerShutdownHandlers(server, client);
  } catch (error: unknown) {
    await closeAfterStartupFailure(client);
    throw error;
  }
}

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function registerShutdownHandlers(server: Server, client: MongoClient): void {
  let shutdownStarted = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    logInfo("Shutting down", { signal });
    void closeResources(server, client);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

async function closeResources(server: Server, client: MongoClient): Promise<void> {
  let failed = false;

  try {
    await closeHttpServer(server);
  } catch (error: unknown) {
    failed = true;
    logError("Could not close HTTP server", error);
  }

  try {
    await client.close();
  } catch (error: unknown) {
    failed = true;
    logError("Could not close MongoDB connection", error);
  }

  if (failed) process.exitCode = 1;
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function closeAfterStartupFailure(client: MongoClient): Promise<void> {
  try {
    await client.close();
  } catch (error: unknown) {
    logError("Could not close MongoDB connection after startup failure", error);
  }
}

function logInfo(message: string, details: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: "info", message, ...details }));
}

function logError(message: string, error: unknown): void {
  console.error(JSON.stringify({ level: "error", message, error: errorMessage(error) }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

void startServer().catch((error: unknown) => {
  logError("Could not start API", error);
  process.exitCode = 1;
});
