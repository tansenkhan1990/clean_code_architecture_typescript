import { MongoClient } from "mongodb";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { DomainEvent } from "../../../src/domain/shared/domain-event.js";
import type { EventPublisher } from "../../../src/application/ports/event-publisher.js";
import { createInMemoryCache } from "../../../src/infrastructure/cache/in-memory-cache.js";
import { createConsoleEventPublisher } from "../../../src/infrastructure/events/console-event-publisher.js";
import { createInMemoryIdempotencyStore } from "../../../src/infrastructure/idempotency/in-memory-idempotency-store.js";
import { createInMemoryPaymentGateway } from "../../../src/infrastructure/payments/in-memory-payment-gateway.js";
import {
  buildMongoPersistence,
  type PersistenceDependencies,
} from "../../../src/infrastructure/persistence/mongo/mongodb-dependencies.js";
import { createSystemClock } from "../../../src/infrastructure/system/system-clock.js";
import { createUuidGenerator } from "../../../src/infrastructure/system/uuid-generator.js";
import { buildUseCases, type UseCases } from "../../../src/main/container.js";

/**
 * Real MongoDB, real transactions. Skipped unless a replica-set URI is given:
 *
 *   docker compose up -d mongo mongo-init
 *   MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ecommerce_test?directConnection=true" npm test
 */
const URI = process.env.MONGODB_TEST_URI;
const DATABASE = "ecommerce_test";

describe.skipIf(URI === undefined)("mongodb persistence", () => {
  let persistence: PersistenceDependencies;
  let useCases: UseCases;
  let published: DomainEvent[];

  beforeEach(async () => {
    // A fresh database per test: no shared state between assertions.
    const client = new MongoClient(URI as string);
    await client.connect();
    await client.db(DATABASE).dropDatabase();
    await client.close();

    persistence = await buildMongoPersistence({
      uri: URI as string,
      database: DATABASE,
    });

    published = [];
    const events: EventPublisher = {
      async publish(event) {
        published.push(event);
      },
    };

    useCases = buildUseCases({
      ...persistence,
      cache: createInMemoryCache(),
      clock: createSystemClock(),
      ids: createUuidGenerator(),
      events,
      gateway: createInMemoryPaymentGateway(),
      idempotency: createInMemoryIdempotencyStore(),
    });
  });

  afterAll(async () => {
    if (persistence !== undefined) {
      await persistence.close();
    }
  });

  async function seedCart(quantity: number) {
    const customer = await useCases.createCustomer({
      email: `mongo-${Date.now()}@example.com`,
      name: "Mongo",
    });
    if (!customer.ok) throw new Error("Expected a customer");

    const product = await useCases.createProduct({
      name: "Mongo keyboard",
      amountInMinorUnits: 2500,
      currency: "usd",
      availableQuantity: 5,
    });
    if (!product.ok) throw new Error("Expected a product");

    const added = await useCases.addItem({
      customerId: customer.value.id,
      productId: product.value.id,
      quantity,
    });
    if (!added.ok) throw new Error("Expected a cart line");

    return { customer: customer.value, product: product.value };
  }

  it("persists a checkout and its outbox rows atomically", async () => {
    const { customer, product } = await seedCart(2);

    const checkout = await useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "mongo-checkout-1",
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) throw new Error("Expected a checkout");

    const order = await persistence.orders.findById(checkout.value.order.id);
    expect(order).toMatchObject({ status: "paid" });

    const stock = await persistence.inventory.findByProductId(product.id);
    expect(stock).toMatchObject({ available: 3, reserved: 0 });

    const pending = await persistence.outbox.findPending(10);
    expect(pending.map((message) => message.event.name)).toEqual([
      "customer.registered",
      "order.created",
      "order.paid",
    ]);

    const dispatch = await useCases.dispatchOutbox();
    expect(dispatch.ok).toBe(true);

    expect(published.map((event) => event.name)).toEqual([
      "customer.registered",
      "order.created",
      "order.paid",
    ]);
    expect(await persistence.outbox.findPending(10)).toEqual([]);
  });

  it("rolls back the product row when the inventory write fails", async () => {
    const failing = {
      ...persistence,
      inventory: {
        ...persistence.inventory,
        async save(): Promise<void> {
          throw new Error("simulated write failure");
        },
      },
    };

    const failingUseCases = buildUseCases({
      ...failing,
      cache: createInMemoryCache(),
      clock: createSystemClock(),
      ids: createUuidGenerator(),
      events: createConsoleEventPublisher(() => undefined),
      gateway: createInMemoryPaymentGateway(),
      idempotency: createInMemoryIdempotencyStore(),
    });

    const created = await failingUseCases.createProduct({
      name: "Ghost product",
      amountInMinorUnits: 1000,
      currency: "usd",
      availableQuantity: 1,
    });

    expect(created.ok).toBe(false);
    if (created.ok) throw new Error("Expected a failure");
    expect(created.error.type).toBe("transaction_failed");

    expect(await persistence.products.findAll()).toEqual([]);
  });

  it("returns the stored order when the same idempotency key is retried", async () => {
    const { customer } = await seedCart(1);

    const first = await useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "retry-me",
    });
    const second = await useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "retry-me",
    });

    if (!first.ok || !second.ok) throw new Error("Expected both checkouts");

    expect(second.value.replayed).toBe(true);
    expect(second.value.order.id).toBe(first.value.order.id);

    const orders = await persistence.orders.findByCustomerId(customer.id);
    expect(orders).toHaveLength(1);
  });
});
