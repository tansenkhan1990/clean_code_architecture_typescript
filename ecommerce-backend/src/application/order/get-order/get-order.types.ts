import type { Order, OrderId } from "../../../domain/order/order.js";
import type { Result } from "../../../domain/shared/result.js";
import type { OrderRepository } from "../../ports/repositories/order-repository.js";

export type GetOrderInput = {
  id: OrderId;
};

export type GetOrderError =
  | {
      type: "order_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type GetOrderDependencies = {
  orders: OrderRepository;
};

export type GetOrder = (
  input: GetOrderInput,
) => Promise<Result<Order, GetOrderError>>;
