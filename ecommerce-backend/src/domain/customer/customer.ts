import { err, ok, type Result } from "../shared/result.js";
import type { CustomerDomainError } from "./customer-errors.js";
import type { CustomerId } from "./customer-id.js";

export const MAX_CUSTOMER_NAME_LENGTH = 120;

/**
 * Deliberately permissive: the goal is to reject obvious garbage, not to
 * reimplement RFC 5322. Verification belongs to a later flow.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Customer = {
  id: CustomerId;
  email: string;
  name: string;
  createdAt: string;
};

/**
 * Registers a customer. Emails are normalised so the same address cannot be
 * registered twice with different casing, and the id/clock stay injected.
 */
export function createCustomer(input: {
  id: CustomerId;
  email: string;
  name: string;
  createdAt: string;
}): Result<Customer, CustomerDomainError> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!EMAIL_PATTERN.test(email)) {
    return err({
      type: "invalid_email",
      message: "Customer email is not a valid address",
    });
  }

  if (name.length === 0) {
    return err({
      type: "invalid_customer_name",
      message: "Customer name cannot be empty",
    });
  }

  if (name.length > MAX_CUSTOMER_NAME_LENGTH) {
    return err({
      type: "invalid_customer_name",
      message: `Customer name cannot exceed ${MAX_CUSTOMER_NAME_LENGTH} characters`,
    });
  }

  return ok({
    id: input.id,
    email,
    name,
    createdAt: input.createdAt,
  });
}

/** Renames a customer, keeping identity and registration date intact. */
export function renameCustomer(
  customer: Customer,
  name: string,
): Result<Customer, CustomerDomainError> {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return err({
      type: "invalid_customer_name",
      message: "Customer name cannot be empty",
    });
  }

  if (trimmed.length > MAX_CUSTOMER_NAME_LENGTH) {
    return err({
      type: "invalid_customer_name",
      message: `Customer name cannot exceed ${MAX_CUSTOMER_NAME_LENGTH} characters`,
    });
  }

  return ok({ ...customer, name: trimmed });
}
