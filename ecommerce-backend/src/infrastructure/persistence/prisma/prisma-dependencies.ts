import type { InboxStore } from "../../../application/ports/inbox-store.js";
import type { OutboxRepository } from "../../../application/ports/outbox.js";
import type { AccountRepository } from "../../../application/ports/repositories/account-repository.js";
import type { CartRepository } from "../../../application/ports/repositories/cart-repository.js";
import type { CustomerRepository } from "../../../application/ports/repositories/customer-repository.js";
import type { InventoryRepository } from "../../../application/ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../../../application/ports/repositories/order-repository.js";
import type { ProductRepository } from "../../../application/ports/repositories/product-repository.js";
import type { UnitOfWork } from "../../../application/ports/unit-of-work.js";
import { createPrismaUnitOfWork } from "../../transactions/prisma-unit-of-work.js";
import { createPrismaAccountRepository } from "./prisma-account-repository.js";
import { connectPrisma } from "./prisma-client.js";
import { createPrismaCartRepository } from "./prisma-cart-repository.js";
import { createPrismaCustomerRepository } from "./prisma-customer-repository.js";
import { createPrismaInboxStore } from "./prisma-inbox-store.js";
import { createPrismaInventoryRepository } from "./prisma-inventory-repository.js";
import { createPrismaOrderRepository } from "./prisma-order-repository.js";
import { createPrismaOutboxRepository } from "./prisma-outbox-repository.js";
import { createPrismaProductRepository } from "./prisma-product-repository.js";

export type PersistenceDependencies = {
  customers: CustomerRepository;
  accounts: AccountRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  carts: CartRepository;
  orders: OrderRepository;
  outbox: OutboxRepository;
  inbox: InboxStore;
  unitOfWork: UnitOfWork;
  /** Readiness probe: fails when the database is unreachable. */
  check(): Promise<void>;
  close(): Promise<void>;
};

export type PrismaPersistenceOptions = {
  url: string;
};

/**
 * Builds the PostgreSQL adapter set. Migrations are applied by `npm run
 * db:migrate` (and by the container entrypoint), never by this module.
 */
export async function buildPrismaPersistence({
  url,
}: PrismaPersistenceOptions): Promise<PersistenceDependencies> {
  const connection = await connectPrisma(url);

  return {
    customers: createPrismaCustomerRepository(connection.client),
    accounts: createPrismaAccountRepository(connection.client),
    products: createPrismaProductRepository(connection.client),
    inventory: createPrismaInventoryRepository(connection.client),
    carts: createPrismaCartRepository(connection.client),
    orders: createPrismaOrderRepository(connection.client),
    outbox: createPrismaOutboxRepository(connection.client),
    inbox: createPrismaInboxStore(connection.client),
    unitOfWork: createPrismaUnitOfWork(connection.client),
    check: connection.check,
    close: connection.close,
  };
}
