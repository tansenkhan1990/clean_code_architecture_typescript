import type { Db } from "mongodb";
import type { CartRepository } from "../../../application/ports/repositories/cart-repository.js";
import {
  fromCartDocument,
  toCartDocument,
  type CartDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

export function createMongoCartRepository(db: Db): CartRepository {
  const carts = db.collection<CartDocument>("carts");

  return {
    async save(cart) {
      await carts.replaceOne({ _id: cart.id }, toCartDocument(cart), {
        upsert: true,
        ...sessionOptions(),
      });
    },

    async findById(id) {
      const doc = await carts.findOne({ _id: id }, sessionOptions());
      return doc === null ? null : fromCartDocument(doc);
    },

    async findByCustomerId(customerId) {
      const doc = await carts.findOne({ customerId }, sessionOptions());
      return doc === null ? null : fromCartDocument(doc);
    },
  };
}
