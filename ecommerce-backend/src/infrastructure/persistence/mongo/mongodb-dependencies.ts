import type { OutboxRepository } from "../../../application/ports/outbox.js";
import type { CartRepository } from "../../../application/ports/repositories/cart-repository.js";
import type { CustomerRepository } from "../../../application/ports/repositories/customer-repository.js";
import type { InventoryRepository } from "../../../application/ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../../../application/ports/repositories/order-repository.js";
import type { ProductRepository } from "../../../application/ports/repositories/product-repository.js";
import type { UnitOfWork } from "../../../application/ports/unit-of-work.js";
import { connectMongo } from "./mongo-connection.js";
import { createMongoCartRepository } from "./mongo-cart-repository.js";
import { createMongoCustomerRepository } from "./mongo-customer-repository.js";
import { createMongoInventoryRepository } from "./mongo-inventory-repository.js";
import { createMongoOrderRepository } from "./mongo-order-repository.js";
import { createMongoOutboxRepository } from "./mongo-outbox-repository.js";
import { createMongoProductRepository } from "./mongo-product-repository.js";
import { createMongoUnitOfWork } from "./mongo-unit-of-work.js";

/** Exactly the ports the application needs; the composition root adds the rest. */
export type PersistenceDependencies = {
  customers: CustomerRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  carts: CartRepository;
  orders: OrderRepository;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
  /** Readiness probe: fails when the database is unreachable. */
  check(): Promise<void>;
  close(): Promise<void>;
};

export type MongoPersistenceOptions = {
  uri: string;
  database: string;
};

/**
 * Builds the MongoDB adapter set. Note what is absent: no use case, no Fastify,
 * no composition root. This module only knows how to store aggregates.
 */
export async function buildMongoPersistence({
  uri,
  database,
}: MongoPersistenceOptions): Promise<PersistenceDependencies> {
  const connection = await connectMongo({ uri, database });

  return {
    customers: createMongoCustomerRepository(connection.db),
    products: createMongoProductRepository(connection.db),
    inventory: createMongoInventoryRepository(connection.db),
    carts: createMongoCartRepository(connection.db),
    orders: createMongoOrderRepository(connection.db),
    outbox: createMongoOutboxRepository(connection.db),
    unitOfWork: createMongoUnitOfWork(connection.client),
    async check() {
      await connection.db.command({ ping: 1 });
    },
    close: connection.close,
  };
}
