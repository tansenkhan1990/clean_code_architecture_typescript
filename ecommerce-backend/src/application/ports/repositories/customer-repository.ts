import type { Customer } from "../../../domain/customer/customer.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";

/** What the use cases need from storage; storage technology stays outside. */
export type CustomerRepository = {
  save(customer: Customer): Promise<void>;
  findById(id: CustomerId): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
};
