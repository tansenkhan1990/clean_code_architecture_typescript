import { MongoClient, type Db } from "mongodb";

export type MongoConnection = {
  client: MongoClient;
  db: Db;
  close(): Promise<void>;
};

export type MongoConnectionOptions = {
  uri: string;
  database: string;
  serverSelectionTimeoutMS?: number;
};

/**
 * Opens the connection, creates the indexes the repositories rely on, and
 * returns a handle the composition root can close. Indexes are created at
 * start-up because the in-memory adapters had none to create.
 */
export async function connectMongo({
  uri,
  database,
  serverSelectionTimeoutMS = 10_000,
}: MongoConnectionOptions): Promise<MongoConnection> {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS,
    appName: "ecommerce-backend",
    // Never persist `undefined`; documents hold explicit nulls instead.
    ignoreUndefined: true,
  });

  try {
    await client.connect();
    const db = client.db(database);
    await ensureIndexes(db);

    return {
      client,
      db,
      close: async () => {
        await client.close();
      },
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

/**
 * Unique indexes enforce rules the in-memory adapters only implied:
 * one customer per email, one stock record per product. The outbox index makes
 * `findPending` a bounded, ordered scan.
 */
async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("customers").createIndex({ email: 1 }, { unique: true }),
    db.collection("inventory").createIndex({ productId: 1 }, { unique: true }),
    db.collection("carts").createIndex({ customerId: 1 }, { unique: true }),
    db.collection("orders").createIndex({ customerId: 1 }),
    db.collection("outbox").createIndex({ publishedAt: 1, createdAt: 1 }),
  ]);
}
