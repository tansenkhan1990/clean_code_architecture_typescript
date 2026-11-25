import type { Db } from "mongodb";
import type { ProductRepository } from "../../../application/ports/repositories/product-repository.js";
import {
  fromProductDocument,
  toProductDocument,
  type ProductDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

export function createMongoProductRepository(db: Db): ProductRepository {
  const products = db.collection<ProductDocument>("products");

  return {
    async save(product) {
      await products.replaceOne(
        { _id: product.id },
        toProductDocument(product),
        {
          upsert: true,
          ...sessionOptions(),
        },
      );
    },

    async findById(id) {
      const doc = await products.findOne({ _id: id }, sessionOptions());
      return doc === null ? null : fromProductDocument(doc);
    },

    async findAll() {
      const docs = await products
        .find({}, sessionOptions())
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
      return docs.map(fromProductDocument);
    },
  };
}
