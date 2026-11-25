import type { Db } from "mongodb";
import type { CustomerRepository } from "../../../application/ports/repositories/customer-repository.js";
import {
  fromCustomerDocument,
  toCustomerDocument,
  type CustomerDocument,
} from "./mongo-documents.js";
import { sessionOptions } from "./mongo-session.js";

export function createMongoCustomerRepository(db: Db): CustomerRepository {
  const customers = db.collection<CustomerDocument>("customers");

  return {
    async save(customer) {
      await customers.replaceOne(
        { _id: customer.id },
        toCustomerDocument(customer),
        { upsert: true, ...sessionOptions() },
      );
    },

    async findById(id) {
      const doc = await customers.findOne({ _id: id }, sessionOptions());
      return doc === null ? null : fromCustomerDocument(doc);
    },

    async findByEmail(email) {
      const doc = await customers.findOne(
        { email: email.trim().toLowerCase() },
        sessionOptions(),
      );
      return doc === null ? null : fromCustomerDocument(doc);
    },
  };
}
