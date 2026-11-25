import type { DomainEvent } from "../shared/domain-event.js";
import type { Customer } from "./customer.js";

export type CustomerRegistered = DomainEvent<
  "customer.registered",
  { customerId: string; email: string }
>;

/** Records that a customer joined; publishing is an application concern. */
export function customerRegistered(
  customer: Customer,
  occurredAt: string,
): CustomerRegistered {
  return {
    name: "customer.registered",
    occurredAt,
    payload: { customerId: customer.id, email: customer.email },
  };
}
