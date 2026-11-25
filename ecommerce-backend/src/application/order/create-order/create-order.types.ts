import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { Order } from "../../../domain/order/order.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { OutboxRepository } from "../../ports/outbox.js";
import type { CartRepository } from "../../ports/repositories/cart-repository.js";
import type { InventoryRepository } from "../../ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../../ports/repositories/order-repository.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";

export type CreateOrderInput = {
  customerId: CustomerId;
};

export type CreateOrderError =
  | {
      type: "cart_not_found";
      message: string;
    }
  | {
      type: "empty_cart";
      message: string;
    }
  | {
      type: "inventory_not_found";
      message: string;
    }
  | {
      type: "insufficient_stock";
      message: string;
    }
  | {
      type: "invalid_order";
      message: string;
    };

export type CreateOrderDependencies = {
  carts: CartRepository;
  orders: OrderRepository;
  inventory: InventoryRepository;
  ids: IdGenerator;
  clock: Clock;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
};

export type CreateOrder = (
  input: CreateOrderInput,
) => Promise<Result<Order, CreateOrderError | UnitOfWorkError>>;
