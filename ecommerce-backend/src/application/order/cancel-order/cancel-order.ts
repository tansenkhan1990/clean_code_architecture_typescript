import {
  releaseStock,
  type InventoryItem,
} from "../../../domain/inventory/inventory-item.js";
import {
  cancelOrder as cancelOrderDomain,
  type Order,
} from "../../../domain/order/order.js";
import { orderCancelled } from "../../../domain/order/order-events.js";
import { err, ok } from "../../../domain/shared/result.js";
import { stageEvent } from "../../outbox/stage-event.js";
import type {
  CancelOrder,
  CancelOrderDependencies,
  CancelOrderError,
} from "./cancel-order.types.js";

/**
 * Cancelling is the inverse of placing, and it is one transaction: releasing
 * every reserved unit, marking the order cancelled, and recording
 * `order.cancelled` either all commit or none do.
 *
 * That matters most when checkout compensates for a declined payment: a
 * cancelled order whose stock was never released would leak inventory.
 */
export function cancelOrderUseCase({
  orders,
  inventory,
  ids,
  clock,
  outbox,
  unitOfWork,
}: CancelOrderDependencies): CancelOrder {
  return async ({ orderId }) =>
    unitOfWork.execute<Order, CancelOrderError>(async () => {
      const now = clock.now();

      const order = await orders.findById(orderId);

      if (order === null) {
        return err({
          type: "order_not_found",
          message: `Order ${orderId} was not found`,
        });
      }

      const cancelled = cancelOrderDomain(order, now);

      if (!cancelled.ok) {
        return err({
          type: cancelled.error.type,
          message: cancelled.error.message,
        });
      }

      const releases: InventoryItem[] = [];

      for (const item of order.items) {
        const stock: InventoryItem | null = await inventory.findByProductId(
          item.productId,
        );

        if (stock === null) {
          return err({
            type: "inventory_not_found",
            message: `No stock record exists for product ${item.productId}`,
          });
        }

        const released = releaseStock(stock, item.quantity, now);

        if (!released.ok) {
          // The order was payable, so its units must be reserved. Failing here
          // means storage and order history disagree; surface it, do not guess.
          return err({
            type: "repository_error",
            message: `Could not release reserved stock: ${released.error.message}`,
          });
        }

        releases.push(released.value);
      }

      for (const release of releases) {
        await inventory.save(release);
      }

      await orders.save(cancelled.value);
      await stageEvent(
        { outbox, ids, clock },
        orderCancelled(cancelled.value, now),
      );

      return ok(cancelled.value);
    });
}
