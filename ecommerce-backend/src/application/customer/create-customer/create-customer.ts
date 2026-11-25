import {
  createCustomer,
  type Customer,
} from "../../../domain/customer/customer.js";
import { customerRegistered } from "../../../domain/customer/customer-events.js";
import { err, ok } from "../../../domain/shared/result.js";
import { stageEvent } from "../../outbox/stage-event.js";
import type {
  CreateCustomer,
  CreateCustomerDependencies,
  CreateCustomerError,
} from "./create-customer.types.js";

/**
 * Registration: validate through the domain, refuse a duplicate address, then
 * persist the customer and its `customer.registered` outbox row atomically.
 * Saving the customer without the event (or the reverse) is no longer possible.
 */
export function createCustomerUseCase({
  customers,
  ids,
  clock,
  outbox,
  unitOfWork,
}: CreateCustomerDependencies): CreateCustomer {
  return async (input) =>
    unitOfWork.execute<Customer, CreateCustomerError>(async () => {
      const now = clock.now();

      const customer = createCustomer({
        id: ids.nextId(),
        email: input.email,
        name: input.name,
        createdAt: now,
      });

      if (!customer.ok) {
        return err({
          type: "invalid_customer",
          message: customer.error.message,
        });
      }

      const existing = await customers.findByEmail(customer.value.email);

      if (existing !== null) {
        return err({
          type: "email_already_registered",
          message: "A customer with this email already exists",
        });
      }

      await customers.save(customer.value);
      await stageEvent(
        { outbox, ids, clock },
        customerRegistered(customer.value, now),
      );

      return ok(customer.value);
    });
}
