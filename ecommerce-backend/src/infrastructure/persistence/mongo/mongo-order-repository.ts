import type { Db } from "mongodb";
import type { OrderRepository } from "../../../application/ports/repositories/order-repository.js";
import {
  fromOrderDocument,
  toOrderDocument,
  type OrderDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

export function createMongoOrderRepository(db: Db): OrderRepository {
  const orders = db.collection<OrderDocument>("orders");

  return {
    async save(order) {
      await orders.replaceOne({ _id: order.id }, toOrderDocument(order), {
        upsert: true,
        ...sessionOptions(),
      });
    },

    async findById(id) {
      const doc = await orders.findOne({ _id: id }, sessionOptions());
      return doc === null ? null : fromOrderDocument(doc);
    },

    async findByCustomerId(customerId) {
      const docs = await orders
        .find({ customerId }, sessionOptions())
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
      return docs.map(fromOrderDocument);
    },
  };
}
