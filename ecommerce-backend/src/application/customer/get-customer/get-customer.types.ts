import type { Customer } from "../../../domain/customer/customer.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { Result } from "../../../domain/shared/result.js";
import type { CustomerRepository } from "../../ports/repositories/customer-repository.js";

export type GetCustomerInput = {
  id: CustomerId;
};

export type GetCustomerError =
  | {
      type: "customer_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type GetCustomerDependencies = {
  customers: CustomerRepository;
};

export type GetCustomer = (
  input: GetCustomerInput,
) => Promise<Result<Customer, GetCustomerError>>;
