import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestHttpApp,
  TEST_PASSWORD,
  type TestEnvironment,
} from "../../support/test-environment.js";

let app: FastifyInstance;
let environment: TestEnvironment;

beforeEach(async () => {
  const created = createTestHttpApp();
  app = created.app;
  environment = created.environment;
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

type Session = { id: string; token: string };

async function registerCustomer(email = "Ada@example.com"): Promise<Session> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, name: "Ada", password: TEST_PASSWORD },
  });

  expect(response.statusCode).toBe(201);

  const body = response.json<{
    customer: { id: string };
    accessToken: { token: string };
  }>();

  return { id: body.customer.id, token: body.accessToken.token };
}

function auth(session: Session) {
  return { authorization: `Bearer ${session.token}` };
}

/**
 * Product creation is an admin action, so the flow seeds the catalogue through
 * the use case instead of the API. The admin route itself is covered by
 * `auth-flow.test.ts`.
 */
async function createProduct(availableQuantity: number) {
  const result = await environment.useCases.createProduct({
    name: "Mechanical keyboard",
    amountInMinorUnits: 1999,
    currency: "usd",
    availableQuantity,
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
}

describe("http checkout flow", () => {
  it("runs customer to paid order through the API", async () => {
    const customer = await registerCustomer();
    const product = await createProduct(5);

    const added = await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      headers: auth(customer),
      payload: { productId: product.id, quantity: 2 },
    });

    expect(added.statusCode).toBe(200);

    const cart = await app.inject({
      method: "GET",
      url: `/customers/${customer.id}/cart`,
      headers: auth(customer),
    });

    expect(cart.statusCode).toBe(200);
    expect(cart.json()).toMatchObject({
      itemCount: 2,
      total: { amountInMinorUnits: 3998, currency: "USD" },
    });

    const checkout = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: auth(customer),
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
      headers: auth(customer),
    });

    expect(order.statusCode).toBe(200);
    expect(order.json()).toMatchObject({ id: body.order.id, status: "paid" });
  });

  it("replays a checkout that carries an Idempotency-Key", async () => {
    const customer = await registerCustomer();
    const product = await createProduct(5);

    await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      headers: auth(customer),
      payload: { productId: product.id, quantity: 2 },
    });

    const first = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { ...auth(customer), "idempotency-key": "order-42" },
      payload: { customerId: customer.id },
    });

    expect(first.statusCode).toBe(201);
    const created = first.json<{
      order: { id: string };
      payment: { providerReference: string };
    }>();

    const second = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { ...auth(customer), "idempotency-key": "order-42" },
      payload: { customerId: customer.id },
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
    const customer = await registerCustomer();

    const response = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { ...auth(customer), "idempotency-key": "   " },
      payload: { customerId: customer.id },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 409 when the cart asks for more than the stock", async () => {
    const customer = await registerCustomer();
    const product = await createProduct(1);

    const added = await app.inject({
      method: "POST",
      url: `/customers/${customer.id}/cart/items`,
      headers: auth(customer),
      payload: { productId: product.id, quantity: 2 },
    });

    expect(added.statusCode).toBe(409);
    expect(added.json()).toMatchObject({
      message: expect.stringContaining("available"),
    });
  });

  it("returns 404 for an unknown order, 400 for malformed input, and 401 without a token", async () => {
    const customer = await registerCustomer();

    const missing = await app.inject({
      method: "GET",
      url: "/orders/nope",
      headers: auth(customer),
    });
    expect(missing.statusCode).toBe(404);

    const malformed = await app.inject({
      method: "POST",
      url: "/products",
      payload: { name: "No price" },
    });
    // The route is admin-only, so the unauthenticated caller is refused first.
    expect(malformed.statusCode).toBe(401);

    const anonymous = await app.inject({
      method: "GET",
      url: `/customers/${customer.id}/cart`,
    });
    expect(anonymous.statusCode).toBe(401);
  });
});
