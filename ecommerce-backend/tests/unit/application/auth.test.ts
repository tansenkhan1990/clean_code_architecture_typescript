import { describe, expect, it } from "vitest";
import { assignRole } from "../../../src/domain/auth/account.js";
import {
  createTestEnvironment,
  FIXED_NOW,
  registerTestCustomer,
  TEST_PASSWORD,
} from "../../support/test-environment.js";

describe("registration", () => {
  it("creates the profile and the credential, then issues a token", async () => {
    const environment = createTestEnvironment();

    const result = await environment.useCases.register({
      email: "Ada@Example.com",
      name: "Ada",
      password: TEST_PASSWORD,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);

    // The address is normalised, so casing cannot create a second account.
    expect(result.value.customer.email).toBe("ada@example.com");
    expect(result.value.role).toBe("customer");

    const account = await environment.repositories.accounts.findByCustomerId(
      result.value.customer.id,
    );

    expect(account?.role).toBe("customer");
    expect(account?.passwordHash).not.toContain(TEST_PASSWORD);
    expect(account?.passwordHash.startsWith("scrypt$")).toBe(true);

    const principal = await environment.auth.tokens.verify(
      result.value.accessToken.token,
    );

    expect(principal).toEqual({
      customerId: result.value.customer.id,
      email: "ada@example.com",
      role: "customer",
    });
  });

  it("stages customer.registered in the same transaction", async () => {
    const environment = createTestEnvironment();

    await registerTestCustomer(environment, { email: "linus@example.com" });

    const pending = await environment.repositories.outbox.findPending(
      10,
      FIXED_NOW,
    );

    expect(pending.map((message) => message.event.name)).toEqual([
      "customer.registered",
    ]);
  });

  it("refuses a duplicate address and leaves no second record", async () => {
    const environment = createTestEnvironment();
    await registerTestCustomer(environment, { email: "ada@example.com" });

    const duplicate = await environment.useCases.register({
      email: "ADA@example.com",
      name: "Ada again",
      password: TEST_PASSWORD,
    });

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error("Expected a duplicate rejection");
    expect(duplicate.error.type).toBe("email_already_registered");

    // Neither the customer nor the credential was written.
    expect(
      await environment.repositories.customers.findByEmail("ada@example.com"),
    ).not.toBeNull();
    const all = await Promise.all(
      ["id-1", "id-2", "id-3", "id-4"].map((id) =>
        environment.repositories.accounts.findByCustomerId(id),
      ),
    );
    expect(all.filter((account) => account !== null)).toHaveLength(1);
  });

  it("grants admin only to an address the operator listed for bootstrap", async () => {
    const environment = createTestEnvironment({
      bootstrapAdminEmails: ["owner@example.com"],
    });

    const owner = await environment.useCases.register({
      email: "Owner@Example.com",
      name: "Owner",
      password: TEST_PASSWORD,
    });
    const shopper = await environment.useCases.register({
      email: "shopper@example.com",
      name: "Shopper",
      password: TEST_PASSWORD,
    });

    expect(owner.ok).toBe(true);
    expect(shopper.ok).toBe(true);
    if (!owner.ok || !shopper.ok) throw new Error("Expected registrations");

    expect(owner.value.role).toBe("admin");
    expect(shopper.value.role).toBe("customer");
    expect(
      await environment.auth.tokens.verify(owner.value.accessToken.token),
    ).toMatchObject({ role: "admin" });
  });

  it("refuses a password below the policy before writing anything", async () => {
    const environment = createTestEnvironment();

    const result = await environment.useCases.register({
      email: "ada@example.com",
      name: "Ada",
      password: "short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.type).toBe("invalid_password");

    expect(
      await environment.repositories.customers.findByEmail("ada@example.com"),
    ).toBeNull();
    expect(
      await environment.repositories.outbox.findPending(10, FIXED_NOW),
    ).toEqual([]);
  });
});

describe("login", () => {
  it("returns a session for the right password", async () => {
    const environment = createTestEnvironment();
    const registered = await registerTestCustomer(environment, {
      email: "grace@example.com",
      name: "Grace",
    });

    const result = await environment.useCases.login({
      email: "Grace@Example.com",
      password: TEST_PASSWORD,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.customer.id).toBe(registered.id);
    expect(result.value.role).toBe("customer");
    expect(
      await environment.auth.tokens.verify(result.value.accessToken.token),
    ).toMatchObject({ customerId: registered.id, role: "customer" });
  });

  it("answers the same way for a wrong password and an unknown address", async () => {
    const environment = createTestEnvironment();
    await registerTestCustomer(environment, { email: "ada@example.com" });

    const wrongPassword = await environment.useCases.login({
      email: "ada@example.com",
      password: "not the right password",
    });
    const unknown = await environment.useCases.login({
      email: "nobody@example.com",
      password: TEST_PASSWORD,
    });

    expect(wrongPassword.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    if (wrongPassword.ok || unknown.ok) throw new Error("Expected failures");

    expect(wrongPassword.error.type).toBe("invalid_credentials");
    expect(unknown.error.type).toBe("invalid_credentials");
    expect(wrongPassword.error.message).toBe(unknown.error.message);
  });

  it("reports the role that is current in storage, not the one at registration", async () => {
    const environment = createTestEnvironment();
    const registered = await registerTestCustomer(environment, {
      email: "admin@example.com",
    });

    const account = await environment.repositories.accounts.findByCustomerId(
      registered.id,
    );
    if (account === null) throw new Error("Expected an account");

    const promoted = assignRole(account, "admin", FIXED_NOW);
    if (!promoted.ok) throw new Error("Expected a promotion");
    await environment.repositories.accounts.save(promoted.value);

    const session = await environment.useCases.login({
      email: "admin@example.com",
      password: TEST_PASSWORD,
    });

    expect(session.ok).toBe(true);
    if (!session.ok) throw new Error(session.error.message);
    expect(session.value.role).toBe("admin");
  });

  it("rejects a malformed or unsigned token", async () => {
    const environment = createTestEnvironment();

    expect(await environment.auth.tokens.verify("not-a-token")).toBeNull();
    expect(await environment.auth.tokens.verify("")).toBeNull();
  });
});
