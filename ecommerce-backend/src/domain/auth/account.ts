import { err, ok, type Result } from "../shared/result.js";
import type { AuthDomainError } from "./auth-errors.js";
import { isRole, type Role } from "./role.js";

/**
 * Length is the property that actually resists guessing, so the policy is a
 * length floor (OWASP's 12-character minimum) and a ceiling that keeps a
 * request from forcing an unbounded key derivation. Composition rules are
 * deliberately absent: they push people toward predictable substitutions.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type Account = {
  customerId: string;
  /** Produced and read by the hashing adapter; never a plaintext password. */
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export function validatePassword(
  password: string,
): Result<string, AuthDomainError> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err({
      type: "invalid_password",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return err({
      type: "invalid_password",
      message: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  return ok(password);
}

/**
 * The credential record for a customer. The hash is supplied by the caller,
 * because hashing is an infrastructure concern; the domain only decides
 * whether the result is structurally valid and which roles may exist.
 */
export function createAccount(input: {
  customerId: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}): Result<Account, AuthDomainError> {
  if (input.passwordHash.trim().length === 0) {
    return err({
      type: "invalid_password",
      message: "A password hash is required",
    });
  }

  if (!isRole(input.role)) {
    return err({
      type: "invalid_role",
      message: `Unknown role: ${String(input.role)}`,
    });
  }

  return ok({
    customerId: input.customerId,
    passwordHash: input.passwordHash,
    role: input.role,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/** Changes the role without touching the stored credential. */
export function assignRole(
  account: Account,
  role: Role,
  updatedAt: string,
): Result<Account, AuthDomainError> {
  if (!isRole(role)) {
    return err({
      type: "invalid_role",
      message: `Unknown role: ${String(role)}`,
    });
  }

  return ok({ ...account, role, updatedAt });
}
