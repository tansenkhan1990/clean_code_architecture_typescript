import { MongoClient, type Collection } from "mongodb";
import type { TodoDocument } from "../repositories/mongo-todo-repository.js";

export interface MongoDatabaseConnection {
  client: MongoClient;
  todos: Collection<TodoDocument>;
}

export async function connectToMongo(
  uri: string,
  databaseName: string,
): Promise<MongoDatabaseConnection> {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const todos = client.db(databaseName).collection<TodoDocument>("todos");
    await todos.createIndex({ createdAt: -1 });

    return { client, todos };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
