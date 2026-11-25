import { describe, expect, it } from "vitest";
import {
  createTestEnvironment,
  FIXED_NOW,
  registerTestCustomer,
} from "../../support/test-environment.js";

async function seedCustomerAndProduct(
  environment: ReturnType<typeof createTestEnvironment>,
  availableQuantity: number,
) {
  const customer = await registerTestCustomer(environment);

  const product = await environment.useCases.createProduct({
    name: "Mechanical keyboard",
    amountInMinorUnits: 1999,
    currency: "usd",
    availableQuantity,
  });

  if (!product.ok) throw new Error("Expected a product");

  return { customer, product: product.value };
}

function names(events: { name: string }[]): string[] {
  return events.map((event) => event.name);
}

/** Registration is seeded too; these tests are about the order's events. */
function orderNames(events: { name: string }[]): string[] {
  return names(events).filter((name) => name.startsWith("order."));
}

describe("checkout", () => {
  it("places an order, takes payment, and commits the stock", async () => {
    const environment = createTestEnvironment();
    const { customer, product } = await seedCustomerAndProduct(environment, 5);

    const added = await environment.useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    });

    expect(added.ok).toBe(true);

    const result = await environment.useCases.checkout({
      customerId: customer.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a completed checkout");

    expect(result.value.order.status).toBe("paid");
    expect(result.value.order.total).toEqual({
      amountInMinorUnits: 3998,
      currency: "USD",
    });
    expect(result.value.payment.status).toBe("succeeded");
    expect(result.value.payment.providerReference).not.toBeNull();
    expect(result.value.replayed).toBe(false);

    const stock = await environment.repositories.inventory.findByProductId(
      product.id,
    );

    expect(stock).toMatchObject({ available: 3, reserved: 0 });

    const cart = await environment.useCases.getCart({
      customerId: customer.id,
    });

    if (!cart.ok) throw new Error("Expected a cart");
    expect(cart.value.itemCount).toBe(0);
  });

  it("queues events in the outbox instead of publishing during the write", async () => {
    const environment = createTestEnvironment();
    const { customer, product } = await seedCustomerAndProduct(environment, 5);

    await environment.useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 1,
    });

    await environment.useCases.checkout({ customerId: customer.id });

    // The transaction committed the events; nothing has been delivered yet.
    expect(environment.published).toEqual([]);

    const pending = await environment.repositories.outbox.findPending(
      10,
      FIXED_NOW,
    );
    expect(
      pending
        .map((message) => message.event.name)
        .filter((name) => name.startsWith("order.")),
    ).toEqual(["order.created", "order.paid"]);

    await environment.drainOutbox();

    expect(orderNames(environment.published)).toEqual([
      "order.created",
      "order.paid",
    ]);
    expect(
      await environment.repositories.outbox.findPending(10, FIXED_NOW),
    ).toEqual([]);

    // Draining twice must not redeliver.
    const delivered = environment.published.length;
    await environment.drainOutbox();
    expect(environment.published).toHaveLength(delivered);
  });

  it("cancels the order and releases stock when payment is declined", async () => {
    const environment = createTestEnvironment({ declinePayments: true });
    const { customer, product } = await seedCustomerAndProduct(environment, 2);

    await environment.useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    });

    const result = await environment.useCases.checkout({
      customerId: customer.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a decline");
    expect(result.error.type).toBe("payment_declined");

    const stock = await environment.repositories.inventory.findByProductId(
      product.id,
    );

    expect(stock).toMatchObject({ available: 2, reserved: 0 });

    const orders = await environment.repositories.orders.findByCustomerId(
      customer.id,
    );

    expect(orders).toHaveLength(1);
    expect(orders[0]?.status).toBe("cancelled");

    await environment.drainOutbox();

    expect(orderNames(environment.published)).toEqual([
      "order.created",
      "order.cancelled",
    ]);
  });

  it("refuses to add more units than are in stock", async () => {
    const environment = createTestEnvironment();
    const { customer, product } = await seedCustomerAndProduct(environment, 1);

    const added = await environment.useCases.addItem({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    });

    expect(added.ok).toBe(false);
    if (added.ok) throw new Error("Expected a failure");
    expect(added.error.type).toBe("insufficient_stock");

    // The check must not have moved any stock.
    const stock = await environment.repositories.inventory.findByProductId(
      product.id,
    );
    expect(stock).toMatchObject({ available: 1, reserved: 0 });
  });

  it("refuses to check out an empty cart", async () => {
    const environment = createTestEnvironment();
    const { customer } = await seedCustomerAndProduct(environment, 1);

    const result = await environment.useCases.checkout({
      customerId: customer.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error.type).toBe("cart_not_found");
  });
});
