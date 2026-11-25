import type { Customer } from "../../../domain/customer/customer.js";
import { err, ok } from "../../../domain/shared/result.js";
import type {
  GetCustomer,
  GetCustomerDependencies,
} from "./get-customer.types.js";

export function getCustomerUseCase({
  customers,
}: GetCustomerDependencies): GetCustomer {
  return async ({ id }) => {
    let customer: Customer | null;

    try {
      customer = await customers.findById(id);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load customer",
      });
    }

    if (customer === null) {
      return err({
        type: "customer_not_found",
        message: `Customer ${id} was not found`,
      });
    }

    return ok(customer);
  };
}
