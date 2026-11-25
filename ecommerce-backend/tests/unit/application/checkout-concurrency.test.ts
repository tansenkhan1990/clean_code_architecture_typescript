import { describe, expect, it } from "vitest";
import {
  createTestEnvironment,
  registerTestCustomer,
} from "../../support/test-environment.js";

async function seed(environment: ReturnType<typeof createTestEnvironment>) {
  const customer = await registerTestCustomer(environment, {
    email: "concurrent@example.com",
    name: "Concurrent",
  });

  const product = await environment.useCases.createProduct({
    name: "One keyboard",
    amountInMinorUnits: 1000,
    currency: "usd",
    availableQuantity: 5,
  });
  if (!product.ok) throw new Error("Expected a product");

  await environment.useCases.addItem({
    customerId: customer.id,
    productId: product.value.id,
    quantity: 1,
  });

  return customer;
}

describe("concurrent checkout", () => {
  it("lets exactly one of two simultaneous requests with the same key proceed", async () => {
    const environment = createTestEnvironment();
    const customer = await seed(environment);

    const [first, second] = await Promise.all([
      environment.useCases.checkout({
        customerId: customer.id,
        idempotencyKey: "same-request",
      }),
      environment.useCases.checkout({
        customerId: customer.id,
        idempotencyKey: "same-request",
      }),
    ]);

    const results = [first, second];
    const succeeded = results.filter((result) => result.ok);
    const rejected = results.find((result) => !result.ok);

    expect(succeeded).toHaveLength(1);
    expect(rejected?.ok).toBe(false);

    if (rejected === undefined || rejected.ok) {
      throw new Error("Expected one rejected request");
    }

    expect(rejected.error.type).toBe("checkout_in_progress");

    // One order, one charge, one set of events.
    const orders = await environment.repositories.orders.findByCustomerId(
      customer.id,
    );
    expect(orders).toHaveLength(1);

    await environment.drainOutbox();
    expect(
      environment.published
        .map((event) => event.name)
        .filter((name) => name.startsWith("order.")),
    ).toEqual(["order.created", "order.paid"]);
  });

  it("releases the claim when an attempt fails, so the key can be reused", async () => {
    const environment = createTestEnvironment();
    const customer = await registerTestCustomer(environment, {
      email: "retry@example.com",
      name: "Retry",
    });

    // No cart: the attempt fails before any money or stock moves.
    const first = await environment.useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "retry-me",
    });
    const second = await environment.useCases.checkout({
      customerId: customer.id,
      idempotencyKey: "retry-me",
    });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);

    if (first.ok || second.ok) throw new Error("Expected failures");
    expect(first.error.type).toBe("cart_not_found");
    // Not "checkout_in_progress": the failed attempt released its claim.
    expect(second.error.type).toBe("cart_not_found");
  });
});
