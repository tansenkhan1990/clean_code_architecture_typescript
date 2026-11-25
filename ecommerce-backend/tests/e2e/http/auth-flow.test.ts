import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assignRole } from "../../../src/domain/auth/account.js";
import {
  createTestHttpApp,
  FIXED_NOW,
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

type AuthBody = {
  customer: { id: string; email: string };
  role: string;
  accessToken: { token: string; tokenType: string; expiresAt: string };
};

async function register(
  email = "ada@example.com",
  name = "Ada",
): Promise<AuthBody> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, name, password: TEST_PASSWORD },
  });

  expect(response.statusCode).toBe(201);
  return response.json<AuthBody>();
}

async function login(email: string, password = TEST_PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function promoteToAdmin(email: string): Promise<void> {
  const customer = await environment.repositories.customers.findByEmail(email);

  if (customer === null) throw new Error("Expected a registered customer");

  const account = await environment.repositories.accounts.findByCustomerId(
    customer.id,
  );

  if (account === null) throw new Error("Expected an account");

  const promoted = assignRole(account, "admin", FIXED_NOW);
  if (!promoted.ok) throw new Error(promoted.error.message);

  await environment.repositories.accounts.save(promoted.value);
}

async function seedProduct() {
  const result = await environment.useCases.createProduct({
    name: "Mechanical keyboard",
    amountInMinorUnits: 1999,
    currency: "usd",
    availableQuantity: 5,
  });

  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("authentication over HTTP", () => {
  it("registers, hands back a bearer token, and resolves /auth/me", async () => {
    const session = await register();

    expect(session.customer.email).toBe("ada@example.com");
    expect(session.role).toBe("customer");
    expect(session.accessToken.tokenType).toBe("Bearer");
    // The credential record must never be part of the response.
    expect(JSON.stringify(session)).not.toContain("password");

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: bearer(session.accessToken.token),
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      customer: { id: session.customer.id },
      role: "customer",
    });
  });

  it("refuses a duplicate registration with 409", async () => {
    await register();

    const duplicate = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "Ada@example.com",
        name: "Ada again",
        password: TEST_PASSWORD,
      },
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      message: expect.stringContaining("already exists"),
    });
  });

  it("logs in and does not reveal which credential was wrong", async () => {
    await register();

    const success = await login("Ada@Example.com");
    expect(success.statusCode).toBe(200);
    expect(success.json<AuthBody>().accessToken.token.length).toBeGreaterThan(
      0,
    );

    const wrongPassword = await login("ada@example.com", "wrong password");
    const unknownAddress = await login("nobody@example.com");

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownAddress.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownAddress.json());
  });

  it("requires a valid bearer token for protected routes", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/auth/me" });

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers["www-authenticate"]).toContain("Bearer");

    const forged = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: bearer("forged.token.value"),
    });
    expect(forged.statusCode).toBe(401);

    const customer = await register();
    const cart = await app.inject({
      method: "GET",
      url: `/customers/${customer.customer.id}/cart`,
      headers: bearer(customer.accessToken.token),
    });
    expect(cart.statusCode).toBe(404);
  });

  it("lets only administrators write to the catalogue", async () => {
    const customer = await register();

    const refused = await app.inject({
      method: "POST",
      url: "/products",
      headers: bearer(customer.accessToken.token),
      payload: {
        name: "Mechanical keyboard",
        price: { amountInMinorUnits: 1999, currency: "usd" },
      },
    });

    expect(refused.statusCode).toBe(403);

    await promoteToAdmin("ada@example.com");
    const promoted = await login("ada@example.com");
    const body = promoted.json<AuthBody>();

    expect(body.role).toBe("admin");

    const allowed = await app.inject({
      method: "POST",
      url: "/products",
      headers: bearer(body.accessToken.token),
      payload: {
        name: "Mechanical keyboard",
        price: { amountInMinorUnits: 1999, currency: "usd" },
        availableQuantity: 5,
      },
    });

    expect(allowed.statusCode).toBe(201);
  });

  it("keeps carts, checkout, and orders private", async () => {
    const ada = await register("ada@example.com", "Ada");
    const grace = await register("grace@example.com", "Grace");
    const product = await seedProduct();

    const added = await app.inject({
      method: "POST",
      url: `/customers/${ada.customer.id}/cart/items`,
      headers: bearer(ada.accessToken.token),
      payload: { productId: product.id, quantity: 1 },
    });
    expect(added.statusCode).toBe(200);

    const readOtherCart = await app.inject({
      method: "GET",
      url: `/customers/${ada.customer.id}/cart`,
      headers: bearer(grace.accessToken.token),
    });
    expect(readOtherCart.statusCode).toBe(403);

    const checkoutAsOther = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: bearer(grace.accessToken.token),
      payload: { customerId: ada.customer.id },
    });
    expect(checkoutAsOther.statusCode).toBe(403);

    const checkedOut = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: bearer(ada.accessToken.token),
      payload: { customerId: ada.customer.id },
    });
    expect(checkedOut.statusCode).toBe(201);

    const order = checkedOut.json<{ order: { id: string } }>();

    const readOtherOrder = await app.inject({
      method: "GET",
      url: `/orders/${order.order.id}`,
      headers: bearer(grace.accessToken.token),
    });
    expect(readOtherOrder.statusCode).toBe(403);

    const ownOrder = await app.inject({
      method: "GET",
      url: `/orders/${order.order.id}`,
      headers: bearer(ada.accessToken.token),
    });
    expect(ownOrder.statusCode).toBe(200);
  });
});
