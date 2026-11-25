import { err, ok } from "../../domain/shared/result.js";
import type {
  Checkout,
  CheckoutDependencies,
  CheckoutOutcome,
  CheckoutResult,
} from "./checkout.types.js";

/** Long enough for a client retry window, short enough to stay disposable. */
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** A claim protects an in-flight request; it expires if the process dies. */
const IDEMPOTENCY_CLAIM_TTL_SECONDS = 30;

/**
 * Checkout is a composition, not a fifth copy of the same logic: place the
 * order, take the money, and cancel the order if the money never arrives.
 *
 * With an idempotency key it also refuses to do that twice. The key is scoped
 * to the customer, only successful outcomes are stored (a decline is a real
 * answer the caller may retry), and `acquire` closes the concurrency hole: two
 * simultaneous requests with the same new key cannot both start.
 */
export function checkoutUseCase({
  createOrder,
  processPayment,
  cancelOrder,
  idempotency,
  clock,
}: CheckoutDependencies): Checkout {
  return async (input) => {
    const key =
      input.idempotencyKey === undefined
        ? null
        : `checkout:${input.customerId}:${input.idempotencyKey}`;

    let claimed = false;

    if (key !== null) {
      try {
        const existing = await idempotency.find<CheckoutResult>(key);

        if (existing !== null) {
          return ok<CheckoutOutcome>({ ...existing.result, replayed: true });
        }

        const reservation = await idempotency.acquire(
          key,
          IDEMPOTENCY_CLAIM_TTL_SECONDS,
        );

        if (reservation === "busy") {
          return err({
            type: "checkout_in_progress",
            message:
              "A checkout with this idempotency key is already in progress",
          });
        }

        claimed = true;
      } catch {
        // Without a reliable store a retry could charge twice, so this request
        // fails closed rather than gambling with money.
        return err({
          type: "idempotency_unavailable",
          message: "Could not check the idempotency key",
        });
      }
    }

    try {
      const order = await createOrder({ customerId: input.customerId });

      if (!order.ok) {
        return err(order.error);
      }

      const payment = await processPayment({ orderId: order.value.id });

      if (!payment.ok) {
        // Compensating action: an unpaid order would otherwise hold stock
        // forever. The original failure is what the caller must see, even if
        // the compensation cannot be recorded.
        await cancelOrder({ orderId: order.value.id });

        return err(payment.error);
      }

      const outcome: CheckoutOutcome = {
        order: payment.value.order,
        payment: payment.value.payment,
        replayed: false,
      };

      if (key !== null) {
        try {
          await idempotency.save(
            key,
            {
              result: { order: outcome.order, payment: outcome.payment },
              createdAt: clock.now(),
            },
            IDEMPOTENCY_TTL_SECONDS,
          );
        } catch {
          // The money moved and the order exists; reporting a failure here
          // would invite a retry that creates a second order. The outcome is
          // returned as-is, and the missed replay protection is logged by the
          // adapter.
        }
      }

      return ok(outcome);
    } finally {
      if (claimed) {
        try {
          await idempotency.release(key as string);
        } catch {
          // The claim expires on its own; releasing is best effort.
        }
      }
    }
  };
}
