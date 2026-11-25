import type { Db } from "mongodb";
import type { InventoryRepository } from "../../../application/ports/repositories/inventory-repository.js";
import {
  fromInventoryDocument,
  toInventoryDocument,
  type InventoryDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

/**
 * Stock is keyed by product, and the unique index on `productId` makes that a
 * storage guarantee rather than a convention.
 */
export function createMongoInventoryRepository(db: Db): InventoryRepository {
  const inventory = db.collection<InventoryDocument>("inventory");

  return {
    async save(item) {
      await inventory.replaceOne(
        { productId: item.productId },
        toInventoryDocument(item),
        { upsert: true, ...sessionOptions() },
      );
    },

    async findByProductId(productId) {
      const doc = await inventory.findOne({ productId }, sessionOptions());
      return doc === null ? null : fromInventoryDocument(doc);
    },
  };
}
