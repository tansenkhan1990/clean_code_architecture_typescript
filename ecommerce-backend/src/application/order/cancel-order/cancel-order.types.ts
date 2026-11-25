import type { Order, OrderId } from "../../../domain/order/order.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { OutboxRepository } from "../../ports/outbox.js";
import type { InventoryRepository } from "../../ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../../ports/repositories/order-repository.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";

export type CancelOrderInput = {
  orderId: OrderId;
};

export type CancelOrderError =
  | {
      type: "order_not_found";
      message: string;
    }
  | {
      type: "order_already_paid";
      message: string;
    }
  | {
      type: "order_cancelled";
      message: string;
    }
  | {
      type: "inventory_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type CancelOrderDependencies = {
  orders: OrderRepository;
  inventory: InventoryRepository;
  ids: IdGenerator;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
  clock: Clock;
};

export type CancelOrder = (
  input: CancelOrderInput,
) => Promise<Result<Order, CancelOrderError | UnitOfWorkError>>;
