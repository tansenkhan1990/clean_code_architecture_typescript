import { describe, expect, it } from "vitest";
import {
  assignRole,
  createAccount,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePassword,
  type Account,
} from "../../../src/domain/auth/account.js";
import type { Role } from "../../../src/domain/auth/role.js";

const NOW = "2026-01-01T00:00:00.000Z";

function buildAccount(): Account {
  const result = createAccount({
    customerId: "customer-1",
    passwordHash: "scrypt$1024$8$1$c2FsdA$aGFzaA",
    role: "customer",
    createdAt: NOW,
  });

  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("password policy", () => {
  it("accepts a passphrase at the minimum length", () => {
    const result = validatePassword("a".repeat(MIN_PASSWORD_LENGTH));

    expect(result.ok).toBe(true);
  });

  it("rejects a password below the minimum", () => {
    const result = validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.type).toBe("invalid_password");
    expect(result.error.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejects a password above the maximum", () => {
    const result = validatePassword("a".repeat(MAX_PASSWORD_LENGTH + 1));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.message).toContain(String(MAX_PASSWORD_LENGTH));
  });
});

describe("account", () => {
  it("cannot exist without a credential hash", () => {
    const result = createAccount({
      customerId: "customer-1",
      passwordHash: "   ",
      role: "customer",
      createdAt: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.type).toBe("invalid_password");
  });

  it("starts as a customer and can be promoted", () => {
    const account = buildAccount();
    expect(account.role).toBe("customer");

    const promoted = assignRole(account, "admin", NOW);

    expect(promoted.ok).toBe(true);
    if (!promoted.ok) throw new Error("Expected a promotion");
    expect(promoted.value.role).toBe("admin");
    expect(promoted.value.passwordHash).toBe(account.passwordHash);
  });

  it("rejects an unknown role even at runtime", () => {
    const result = createAccount({
      customerId: "customer-1",
      passwordHash: "hash",
      role: "root" as Role,
      createdAt: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a rejection");
    expect(result.error.type).toBe("invalid_role");
  });
});
