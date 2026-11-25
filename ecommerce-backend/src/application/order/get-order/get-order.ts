import type { Order } from "../../../domain/order/order.js";
import { err, ok } from "../../../domain/shared/result.js";
import type { GetOrder, GetOrderDependencies } from "./get-order.types.js";

export function getOrderUseCase({ orders }: GetOrderDependencies): GetOrder {
  return async ({ id }) => {
    let order: Order | null;

    try {
      order = await orders.findById(id);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load order",
      });
    }

    if (order === null) {
      return err({
        type: "order_not_found",
        message: `Order ${id} was not found`,
      });
    }

    return ok(order);
  };
}
