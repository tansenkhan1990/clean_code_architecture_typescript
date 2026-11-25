import type { CheckoutOutcome } from "../../../application/checkout/checkout.types.js";
import { toOrderResponse, type OrderResponse } from "./order-presenter.js";
import {
  toPaymentResponse,
  type PaymentResponse,
} from "./payment-presenter.js";

export type CheckoutResponse = {
  order: OrderResponse;
  payment: PaymentResponse;
  /** True when the body was replayed from the idempotency store. */
  replayed: boolean;
};

export function toCheckoutResponse(outcome: CheckoutOutcome): CheckoutResponse {
  return {
    order: toOrderResponse(outcome.order),
    payment: toPaymentResponse(outcome.payment),
    replayed: outcome.replayed,
  };
}
