import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dispatchOutboxUseCase } from "../../../src/application/outbox/dispatch-outbox.js";
import type { DomainEvent } from "../../../src/domain/shared/domain-event.js";
import { buildPrismaPersistence } from "../../../src/infrastructure/persistence/prisma/prisma-dependencies.js";
import type { PersistenceDependencies } from "../../../src/infrastructure/persistence/prisma/prisma-dependencies.js";
import {
  buildInMemoryDependencies,
  buildUseCases,
} from "../../../src/main/container.js";
import {
  createTestAuth,
  TEST_PASSWORD,
} from "../../support/test-environment.js";

const DATABASE_URL = process.env.DATABASE_TEST_URL;

const suite =
  DATABASE_URL === undefined || DATABASE_URL === "" ? describe.skip : describe;

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

function createEnvironment(persistence: PersistenceDependencies) {
  const base = buildInMemoryDependencies();
  const published: DomainEvent[] = [];
  let sequence = 0;

  const useCases = buildUseCases(
    {
      ...base,
      customers: persistence.customers,
      accounts: persistence.accounts,
      products: persistence.products,
      inventory: persistence.inventory,
      carts: persistence.carts,
      orders: persistence.orders,
      outbox: persistence.outbox,
      unitOfWork: persistence.unitOfWork,
      clock: { now: () => FIXED_NOW },
      ids: { nextId: () => `it-${(sequence += 1)}` },
      events: {
        async publish(event) {
          published.push(event);
        },
      },
    },
    createTestAuth(),
  );

  return { useCases, published };
}

suite("PostgreSQL persistence", () => {
  let persistence: PersistenceDependencies;
  let admin: PrismaClient;

  beforeAll(async () => {
    const url = DATABASE_URL ?? "";

    persistence = await buildPrismaPersistence({ url });
    admin = new PrismaClient({ datasourceUrl: url });
    await admin.$connect();
  });

  afterAll(async () => {
    await persistence.close();
    await admin.$disconnect();
  });

  beforeEach(async () => {
    await admin.$executeRawUnsafe(
      'TRUNCATE "Account", "Order", "Cart", "InventoryItem", "Product", "Customer", "OutboxMessage", "ProcessedEvent" CASCADE',
    );
  });

  async function seed(
    useCases: ReturnType<typeof createEnvironment>["useCases"],
  ) {
    const customer = await useCases.register({
      email: "Ada@example.com",
      name: "Ada",
      password: TEST_PASSWORD,
    });
    if (!customer.ok) throw new Error("Expected a customer");

    const product = await useCases.createProduct({
      name: "Mechanical keyboard",
      amountInMinorUnits: 1999,
      currency: "usd",
      availableQuantity: 5,
    });
    if (!product.ok) throw new Error("Expected a product");

    return { customer: customer.value.customer, product: product.value };
  }

  it("commits a checkout across every table", async () => {
    const { useCases } = createEnvironment(persistence);
    const { customer, product } = await seed(useCases);

    await useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    });

    const checkout = await useCases.checkout({ customerId: customer.id });
    expect(checkout.ok).toBe(true);

    // Read back through fresh queries, not the in-memory objects.
    const order = await persistence.orders.findByCustomerId(customer.id);
    expect(order).toHaveLength(1);
    expect(order[0]).toMatchObject({ status: "paid" });
    expect(order[0]?.total).toEqual({
      amountInMinorUnits: 3998,
      currency: "USD",
    });

    const stock = await persistence.inventory.findByProductId(product.id);
    expect(stock).toMatchObject({ available: 3, reserved: 0 });

    const pending = await persistence.outbox.findPending(10, FIXED_NOW);
    expect(pending.map((message) => message.event.name)).toEqual([
      "customer.registered",
      "order.created",
      "order.paid",
    ]);

    // The line items survived the JSON round trip as a snapshot.
    expect(order[0]?.items).toEqual([
      {
        productId: product.id,
        quantity: 2,
        unitPrice: { amountInMinorUnits: 1999, currency: "USD" },
        lineTotal: { amountInMinorUnits: 3998, currency: "USD" },
      },
    ]);
  });

  it("rolls back every write when the business result is a failure", async () => {
    const { useCases } = createEnvironment(persistence);
    const { customer, product } = await seed(useCases);

    await useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    });

    // Empty the shelf after the cart was built, so the order cannot reserve.
    const stock = await persistence.inventory.findByProductId(product.id);
    if (stock === null) throw new Error("Expected stock");
    await persistence.inventory.save({
      ...stock,
      available: 0,
      updatedAt: FIXED_NOW,
    });

    const created = await useCases.createOrder({ customerId: customer.id });
    expect(created.ok).toBe(false);

    expect(await persistence.orders.findByCustomerId(customer.id)).toEqual([]);
    expect(
      (await persistence.outbox.findPending(10, FIXED_NOW)).filter((message) =>
        message.event.name.startsWith("order."),
      ),
    ).toEqual([]);

    const after = await persistence.inventory.findByProductId(product.id);
    expect(after).toMatchObject({ available: 0, reserved: 0 });
  });

  it("persists backoff and dead-letters instead of retrying forever", async () => {
    const { useCases } = createEnvironment(persistence);
    await useCases.register({
      email: "linus@example.com",
      name: "Linus",
      password: TEST_PASSWORD,
    });

    let now = FIXED_NOW;
    const clock = { now: () => now };
    const dispatch = dispatchOutboxUseCase({
      outbox: persistence.outbox,
      publisher: {
        async publish() {
          throw new Error("broker unavailable");
        },
      },
      clock,
    });

    await dispatch();

    // The failure is durable and not immediately eligible again.
    expect(await persistence.outbox.findPending(10, now)).toEqual([]);
    const [retry] = await persistence.outbox.findPending(
      10,
      "2026-01-01T00:00:01.000Z",
    );
    expect(retry).toMatchObject({
      attempts: 1,
      lastError: "broker unavailable",
      nextAttemptAt: "2026-01-01T00:00:01.000Z",
    });

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      now = new Date(new Date(now).getTime() + 60_000).toISOString();
      await dispatch();
    }

    const dead = await persistence.outbox.findDeadLettered(10);
    expect(dead).toHaveLength(1);
    expect(dead[0]?.attempts).toBe(5);
  });

  it("claims an event id once, even when the same id arrives twice", async () => {
    const input = {
      id: "evt-1",
      eventName: "order.paid",
      processedAt: FIXED_NOW,
    };

    expect(await persistence.inbox.markProcessed(input)).toBe(true);
    expect(await persistence.inbox.markProcessed(input)).toBe(false);
    expect(await persistence.inbox.hasProcessed("evt-1")).toBe(true);
    expect(await persistence.inbox.hasProcessed("evt-2")).toBe(false);
  });
});
