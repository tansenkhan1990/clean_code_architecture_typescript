import type { Order, OrderId } from "../../../domain/order/order.js";
import type { Payment } from "../../../domain/payment/payment.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { OutboxRepository } from "../../ports/outbox.js";
import type { PaymentGateway } from "../../ports/payment-gateway.js";
import type { InventoryRepository } from "../../ports/repositories/inventory-repository.js";
import type { OrderRepository } from "../../ports/repositories/order-repository.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";

export type ProcessPaymentInput = {
  orderId: OrderId;
};

/**
 * Declines carry the failed payment so a caller can persist or report the
 * attempt; the amount of an order is never invented at the boundary.
 *
 * `payment_requires_reconciliation` is the honest state after a successful
 * charge whose local commit failed. It is not a retryable "try again" error:
 * the money has already moved, so the transaction id is what an operator needs.
 */
export type ProcessPaymentError =
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
      type: "invalid_payment";
      message: string;
    }
  | {
      type: "inventory_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    }
  | {
      type: "payment_declined";
      message: string;
      payment: Payment;
    }
  | {
      type: "payment_gateway_unavailable";
      message: string;
      payment: Payment;
    }
  | {
      type: "payment_requires_reconciliation";
      message: string;
      payment: Payment;
      cause: string;
    };

export type ProcessPaymentResult = {
  order: Order;
  payment: Payment;
};

export type ProcessPaymentDependencies = {
  orders: OrderRepository;
  inventory: InventoryRepository;
  gateway: PaymentGateway;
  ids: IdGenerator;
  clock: Clock;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
};

export type ProcessPayment = (
  input: ProcessPaymentInput,
) => Promise<
  Result<ProcessPaymentResult, ProcessPaymentError | UnitOfWorkError>
>;
