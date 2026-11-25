import type { Payment } from "../../../domain/payment/payment.js";

export type PaymentResponse = {
  id: string;
  orderId: string;
  amount: {
    amountInMinorUnits: number;
    currency: string;
  };
  status: string;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: {
      amountInMinorUnits: payment.amount.amountInMinorUnits,
      currency: payment.amount.currency,
    },
    status: payment.status,
    providerReference: payment.providerReference,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
