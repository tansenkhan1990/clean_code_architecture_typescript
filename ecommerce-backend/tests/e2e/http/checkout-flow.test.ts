import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestHttpApp } from "../../support/test-environment.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = createTestHttpApp().app;
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function createCustomer() {
  const response = await app.inject({
    method: "POST",
    url: "/customers",
    payload: { email: "Ada@example.com", name: "Ada" },
  });

  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>();
}

async function createProduct(availableQuantity: number) {
  const response = await app.inject({
    method: "POST",
    url: "/products",
    payload: {
      name: "Mechanical keyboard",
      price: { amountInMinorUnits: 1999, currency: "usd" },
      availableQuantity,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>();
}

describe("http checkout flow", () => {
  it("runs customer to paid order through the API", async () => {
    const customer = await createCustomer();
    const product = await createProduct(5);

    const added = await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      payload: { productId: product.id, quantity: 2 },
    });

    expect(added.statusCode).toBe(200);

    const cart = await app.inject({
      method: "GET",
      url: `/customers/${customer.id}/cart`,
    });

    expect(cart.statusCode).toBe(200);
    expect(cart.json()).toMatchObject({
      itemCount: 2,
      total: { amountInMinorUnits: 3998, currency: "USD" },
    });

    const checkout = await app.inject({
      method: "POST",
      url: "/checkout",
      payload: { customerId: customer.id },
    });

    expect(checkout.statusCode).toBe(201);

    const body = checkout.json<{
      order: { id: string; status: string; total: unknown };
      payment: { status: string; providerReference: string };
      replayed: boolean;
    }>();

    expect(body.order.status).toBe("paid");
    expect(body.payment.status).toBe("succeeded");
    expect(body.replayed).toBe(false);

    const order = await app.inject({
      method: "GET",
      url: `/orders/${body.order.id}`,
    });

    expect(order.statusCode).toBe(200);
    expect(order.json()).toMatchObject({ id: body.order.id, status: "paid" });
  });

  it("replays a checkout that carries an Idempotency-Key", async () => {
    const customer = await createCustomer();
    const product = await createProduct(5);

    await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      payload: { productId: product.id, quantity: 2 },
    });

    const first = await app.inject({
      method: "POST",
      url: "/checkout",
      payload: { customerId: customer.id },
      headers: { "idempotency-key": "order-42" },
    });

    expect(first.statusCode).toBe(201);
    const created = first.json<{
      order: { id: string };
      payment: { providerReference: string };
    }>();

    const second = await app.inject({
      method: "POST",
      url: "/checkout",
      payload: { customerId: customer.id },
      headers: { "idempotency-key": "order-42" },
    });

    expect(second.statusCode).toBe(200);
    expect(second.headers["idempotent-replay"]).toBe("true");
    expect(second.json()).toMatchObject({
      replayed: true,
      order: { id: created.order.id },
      payment: { providerReference: created.payment.providerReference },
    });
  });

  it("rejects a blank Idempotency-Key", async () => {
    const customer = await createCustomer();

    const response = await app.inject({
      method: "POST",
      url: "/checkout",
      payload: { customerId: customer.id },
      headers: { "idempotency-key": "   " },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 409 when the cart asks for more than the stock", async () => {
    const customer = await createCustomer();
    const product = await createProduct(1);

    const added = await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      payload: { productId: product.id, quantity: 2 },
    });

    expect(added.statusCode).toBe(409);
    expect(added.json()).toMatchObject({
      message: expect.stringContaining("available"),
    });
  });

  it("returns 404 for an unknown order and 400 for a malformed body", async () => {
    const missing = await app.inject({ method: "GET", url: "/orders/nope" });
    expect(missing.statusCode).toBe(404);

    const malformed = await app.inject({
      method: "POST",
      url: "/products",
      payload: { name: "No price" },
    });
    expect(malformed.statusCode).toBe(400);
  });
});
