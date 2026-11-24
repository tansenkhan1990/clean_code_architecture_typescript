import type { Express } from "express";
import { createTodoUseCases } from "../application/use-cases/todo-use-cases.js";
import type { AppConfig } from "../infrastructure/config/env.js";
import { connectToMongo } from "../infrastructure/database/mongo-database.js";
import { MongoTodoRepository } from "../infrastructure/repositories/mongo-todo-repository.js";
import { createApp } from "../presentation/http/app.js";
import { TodoController } from "../presentation/http/todo-controller.js";

export interface Container {
  readonly app: Express;
  dispose(): Promise<void>;
}

/**
 * Builds the object graph in one place. This is the only module that knows
 * every layer, so the layers themselves stay independent of each other.
 */
export async function createContainer(config: AppConfig): Promise<Container> {
  const { client, db } = await connectToMongo(config.MONGODB_URI, config.MONGODB_DATABASE);

  try {
    const repository = new MongoTodoRepository(db);
    await repository.initialize();
    const controller = new TodoController(createTodoUseCases(repository));
    const app = createApp(controller);

    return { app, dispose: () => client.close() };
  } catch (error: unknown) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
