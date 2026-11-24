import { MongoClient, type Db } from "mongodb";

export interface MongoDatabaseConnection {
  client: MongoClient;
  db: Db;
}

/** Opens the connection only; collection and index details belong to the repository. */
export async function connectToMongo(
  uri: string,
  databaseName: string,
): Promise<MongoDatabaseConnection> {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    return { client, db: client.db(databaseName) };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
