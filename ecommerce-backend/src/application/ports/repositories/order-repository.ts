import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { Order, OrderId } from "../../../domain/order/order.js";

export type OrderRepository = {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
};
