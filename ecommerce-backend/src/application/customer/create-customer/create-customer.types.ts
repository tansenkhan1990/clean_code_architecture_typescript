import type { Customer } from "../../../domain/customer/customer.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { OutboxRepository } from "../../ports/outbox.js";
import type { CustomerRepository } from "../../ports/repositories/customer-repository.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";

export type CreateCustomerInput = {
  email: string;
  name: string;
};

export type CreateCustomerError =
  | {
      type: "invalid_customer";
      message: string;
    }
  | {
      type: "email_already_registered";
      message: string;
    };

export type CreateCustomerDependencies = {
  customers: CustomerRepository;
  ids: IdGenerator;
  clock: Clock;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
};

export type CreateCustomer = (
  input: CreateCustomerInput,
) => Promise<Result<Customer, CreateCustomerError | UnitOfWorkError>>;
