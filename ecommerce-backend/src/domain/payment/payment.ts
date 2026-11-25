import type { OrderId } from "../order/order.js";
import type { Money } from "../product/money.js";
import { err, ok, type Result } from "../shared/result.js";
import type { PaymentDomainError } from "./payment-errors.js";
import type { PaymentStatus } from "./payment-status.js";

export type PaymentId = string;

export type Payment = {
  id: PaymentId;
  orderId: OrderId;
  amount: Money;
  status: PaymentStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createPayment(input: {
  id: PaymentId;
  orderId: OrderId;
  amount: Money;
  createdAt: string;
}): Result<Payment, PaymentDomainError> {
  if (input.amount.amountInMinorUnits <= 0) {
    return err({
      type: "invalid_payment_amount",
      message: "A payment amount must be greater than zero",
    });
  }

  return ok({
    id: input.id,
    orderId: input.orderId,
    amount: input.amount,
    status: "pending",
    providerReference: null,
    failureReason: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function succeedPayment(
  payment: Payment,
  providerReference: string,
  succeededAt: string,
): Result<Payment, PaymentDomainError> {
  if (payment.status !== "pending") {
    return err({
      type: "payment_already_resolved",
      message: `Payment is already ${payment.status}`,
    });
  }

  return ok({
    ...payment,
    status: "succeeded",
    providerReference,
    updatedAt: succeededAt,
  });
}

export function failPayment(
  payment: Payment,
  failureReason: string,
  failedAt: string,
): Result<Payment, PaymentDomainError> {
  if (payment.status !== "pending") {
    return err({
      type: "payment_already_resolved",
      message: `Payment is already ${payment.status}`,
    });
  }

  return ok({
    ...payment,
    status: "failed",
    failureReason,
    updatedAt: failedAt,
  });
}
