import type { CustomerId } from "../../domain/customer/customer-id.js";
import type { Order } from "../../domain/order/order.js";
import type { Payment } from "../../domain/payment/payment.js";
import type { Result } from "../../domain/shared/result.js";
import type { CancelOrder } from "../order/cancel-order/cancel-order.types.js";
import type {
  CreateOrder,
  CreateOrderError,
} from "../order/create-order/create-order.types.js";
import type {
  ProcessPayment,
  ProcessPaymentError,
} from "../payment/process-payment/process-payment.types.js";
import type { Clock } from "../ports/clock.js";
import type { IdempotencyStore } from "../ports/idempotency-store.js";
import type { UnitOfWorkError } from "../ports/unit-of-work.js";

export type CheckoutInput = {
  customerId: CustomerId;
  /**
   * Supplied by the caller (`Idempotency-Key`). Repeating a request with the
   * same key returns the original order and payment instead of charging again.
   */
  idempotencyKey?: string;
};

export type CheckoutError =
  | CreateOrderError
  | ProcessPaymentError
  | UnitOfWorkError
  | {
      type: "idempotency_unavailable";
      message: string;
    }
  | {
      type: "checkout_in_progress";
      message: string;
    };

export type CheckoutResult = {
  order: Order;
  payment: Payment;
};

/** `replayed` is true when the response came from the idempotency store. */
export type CheckoutOutcome = CheckoutResult & {
  replayed: boolean;
};

export type CheckoutDependencies = {
  createOrder: CreateOrder;
  processPayment: ProcessPayment;
  cancelOrder: CancelOrder;
  idempotency: IdempotencyStore;
  clock: Clock;
};

export type Checkout = (
  input: CheckoutInput,
) => Promise<Result<CheckoutOutcome, CheckoutError>>;
