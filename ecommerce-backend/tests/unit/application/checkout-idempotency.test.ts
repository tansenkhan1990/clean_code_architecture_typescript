import { describe, expect, it } from "vitest";
import { createTestEnvironment } from "../../support/test-environment.js";

async function seedCheckedOutCart(
  environment: ReturnType<typeof createTestEnvironment>,
) {
  const customer = await environment.useCases.createCustomer({
    email: "grace@example.com",
    name: "Grace",
  });
  if (!customer.ok) throw new Error("Expected a customer");

  const product = await environment.useCases.createProduct({
    name: "Trackball",
    amountInMinorUnits: 4999,
    currency: "usd",
    availableQuantity: 3,
  });
  if (!product.ok) throw new Error("Expected a product");

  await environment.useCases.addItem({
    customerId: customer.value.id,
    productId: product.value.id,
    quantity: 1,
  });

  return { customer: customer.value, product: product.value };
}

describe("checkout idempotency", () => {
  it("returns the original order for a repeated key without charging again", async () => {
    const environment = createTestEnvironment();
    const { customer, product } = await seedCheckedOutCart(environment);

    const first = await environment.useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "checkout-attempt-1",
    });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Expected a checkout");

    const second = await environment.useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "checkout-attempt-1",
    });

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("Expected a replay");

    expect(second.value.replayed).toBe(true);
    expect(second.value.order.id).toBe(first.value.order.id);
    expect(second.value.payment.providerReference).toBe(
      first.value.payment.providerReference,
    );

    // One order, one charge, one payment's worth of stock committed.
    const orders = await environment.repositories.orders.findByCustomerId(
      customer.id,
    );
    expect(orders).toHaveLength(1);

    const stock = await environment.repositories.inventory.findByProductId(
      product.id,
    );
    expect(stock).toMatchObject({ available: 2, reserved: 0 });

    // The replayed request must not have queued a second pair of events.
    await environment.drainOutbox();
    expect(
      environment.published
        .map((event) => event.name)
        .filter((name) => name.startsWith("order.")),
    ).toEqual(["order.created", "order.paid"]);
  });

  it("keys are scoped per customer, so two customers cannot collide", async () => {
    const environment = createTestEnvironment();

    const ada = await environment.useCases.createCustomer({
      email: "ada@example.com",
      name: "Ada",
    });
    const grace = await environment.useCases.createCustomer({
      email: "grace@example.com",
      name: "Grace",
    });
    if (!ada.ok || !grace.ok) throw new Error("Expected customers");

    const product = await environment.useCases.createProduct({
      name: "Trackball",
      amountInMinorUnits: 100,
      currency: "usd",
      availableQuantity: 2,
    });
    if (!product.ok) throw new Error("Expected a product");

    for (const customer of [ada.value, grace.value]) {
      await environment.useCases.addItem({
        customerId: customer.id,
        productId: product.value.id,
        quantity: 1,
      });
    }

    const adaCheckout = await environment.useCases.checkout({
      customerId: ada.value.id,
      idempotencyKey: "same-key",
    });
    const graceCheckout = await environment.useCases.checkout({
      customerId: grace.value.id,
      idempotencyKey: "same-key",
    });

    expect(adaCheckout.ok).toBe(true);
    expect(graceCheckout.ok).toBe(true);
    if (!adaCheckout.ok || !graceCheckout.ok) throw new Error("Expected both");

    expect(graceCheckout.value.replayed).toBe(false);
    expect(graceCheckout.value.order.id).not.toBe(adaCheckout.value.order.id);
  });

  it("works without a key, as before", async () => {
    const environment = createTestEnvironment();
    const { customer } = await seedCheckedOutCart(environment);

    const result = await environment.useCases.checkout({
      customerId: customer.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a checkout");
    expect(result.value.replayed).toBe(false);
  });
});
