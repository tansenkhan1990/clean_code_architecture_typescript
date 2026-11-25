import type { Db } from "mongodb";
import type { OutboxRepository } from "../../../application/ports/outbox.js";
import {
  fromOutboxDocument,
  toOutboxDocument,
  type OutboxDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

/**
 * The outbox collection is written through the same session as the business
 * write, which is what makes "state + event" a single commit. `findPending`
 * runs outside any transaction, because delivery happens after the commit.
 */
export function createMongoOutboxRepository(db: Db): OutboxRepository {
  const outbox = db.collection<OutboxDocument>("outbox");

  return {
    async add(message) {
      await outbox.insertOne(toOutboxDocument(message), sessionOptions());
    },

    async findPending(limit) {
      const docs = await outbox
        .find({ publishedAt: null })
        .sort({ createdAt: 1, _id: 1 })
        .limit(limit)
        .toArray();
      return docs.map(fromOutboxDocument);
    },

    async markPublished(id, publishedAt) {
      await outbox.updateOne(
        { _id: id },
        { $set: { publishedAt, lastError: null } },
      );
    },

    async markFailed(id, error) {
      await outbox.updateOne(
        { _id: id },
        { $inc: { attempts: 1 }, $set: { lastError: error } },
      );
    },
  };
}
