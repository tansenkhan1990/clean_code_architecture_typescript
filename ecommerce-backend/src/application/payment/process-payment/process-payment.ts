import {
  commitReservation,
  type InventoryItem,
} from "../../../domain/inventory/inventory-item.js";
import { payOrder, type Order } from "../../../domain/order/order.js";
import { orderPaid } from "../../../domain/order/order-events.js";
import {
  createPayment,
  failPayment,
  succeedPayment,
} from "../../../domain/payment/payment.js";
import { err, ok } from "../../../domain/shared/result.js";
import { stageEvent } from "../../outbox/stage-event.js";
import type { ChargeResult } from "../../ports/payment-gateway.js";
import type {
  ProcessPayment,
  ProcessPaymentDependencies,
  ProcessPaymentError,
} from "./process-payment.types.js";

/**
 * Payment crosses a distributed-system boundary, and this use case says so
 * instead of hiding it:
 *
 *   1. read and validate the order                  (no writes)
 *   2. charge the provider                          (external, not our data)
 *   3. commit stock, mark paid, stage order.paid     (one transaction)
 *
 * Step 2 is deliberately outside the transaction: a PostgreSQL rollback cannot
 * un-charge a card. The charge carries an idempotency key so a retry of step 2
 * returns the original provider reference instead of taking money twice.
 *
 * If step 3 fails after a successful charge, the caller gets
 * `payment_requires_reconciliation`: money moved but the order was not
 * recorded as paid. That is a real distributed-systems state, and it needs a
 * human or a reconciliation job, not a `try/catch`.
 */
export function processPaymentUseCase({
  orders,
  inventory,
  gateway,
  ids,
  clock,
  outbox,
  unitOfWork,
}: ProcessPaymentDependencies): ProcessPayment {
  return async ({ orderId }) => {
    const now = clock.now();

    const order: Order | null = await orders.findById(orderId);

    if (order === null) {
      return err({
        type: "order_not_found",
        message: `Order ${orderId} was not found`,
      });
    }

    const payable = payOrder(order, now);

    if (!payable.ok) {
      return err({
        type: payable.error.type,
        message: payable.error.message,
      });
    }

    const pending = createPayment({
      id: ids.nextId(),
      orderId: order.id,
      amount: order.total,
      createdAt: now,
    });

    if (!pending.ok) {
      return err({
        type: "invalid_payment",
        message: pending.error.message,
      });
    }

    let charge: ChargeResult;

    try {
      charge = await gateway.charge({
        orderId: order.id,
        customerId: order.customerId,
        amount: order.total,
        idempotencyKey: pending.value.id,
      });
    } catch {
      const failed = failPayment(
        pending.value,
        "Payment gateway did not respond",
        now,
      );

      return err({
        type: "payment_gateway_unavailable",
        message: "Payment gateway is unavailable",
        payment: failed.ok ? failed.value : pending.value,
      });
    }

    if (!charge.ok) {
      const failed = failPayment(pending.value, charge.error.message, now);
      const payment = failed.ok ? failed.value : pending.value;

      return charge.error.type === "payment_declined"
        ? err({
            type: "payment_declined",
            message: charge.error.message,
            payment,
          })
        : err({
            type: "payment_gateway_unavailable",
            message: charge.error.message,
            payment,
          });
    }

    const succeeded = succeedPayment(
      pending.value,
      charge.value.providerReference,
      now,
    );

    if (!succeeded.ok) {
      return err({
        type: "invalid_payment",
        message: succeeded.error.message,
      });
    }

    const recorded = await unitOfWork.execute<Order, ProcessPaymentError>(
      async () => {
        const current: Order | null = await orders.findById(orderId);

        if (current === null) {
          return err({
            type: "order_not_found" as const,
            message: `Order ${orderId} was not found`,
          });
        }

        const transition = payOrder(current, now);

        if (!transition.ok) {
          return err({
            type: transition.error.type,
            message: transition.error.message,
          });
        }

        // The charge succeeded, so held units become sold units.
        const commits: InventoryItem[] = [];

        for (const item of current.items) {
          const stock: InventoryItem | null = await inventory.findByProductId(
            item.productId,
          );

          if (stock === null) {
            return err({
              type: "inventory_not_found" as const,
              message: `No stock record exists for product ${item.productId}`,
            });
          }

          const committed = commitReservation(stock, item.quantity, now);

          if (!committed.ok) {
            return err({
              type: "repository_error" as const,
              message: `Could not commit reserved stock: ${committed.error.message}`,
            });
          }

          commits.push(committed.value);
        }

        for (const commit of commits) {
          await inventory.save(commit);
        }

        await orders.save(transition.value);
        await stageEvent(
          { outbox, ids, clock },
          orderPaid(transition.value, charge.value.providerReference, now),
        );

        return ok(transition.value);
      },
    );

    if (!recorded.ok) {
      return err({
        type: "payment_requires_reconciliation",
        message:
          "The payment was taken but the order could not be recorded as paid",
        payment: succeeded.value,
        cause: recorded.error.type,
      });
    }

    return ok({
      order: recorded.value,
      payment: succeeded.value,
    });
  };
}
