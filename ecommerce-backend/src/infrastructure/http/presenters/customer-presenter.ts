import type { Customer } from "../../../domain/customer/customer.js";

/** The HTTP shape of a customer. Domain fields may disappear, never leak. */
export type CustomerResponse = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    createdAt: customer.createdAt,
  };
}
