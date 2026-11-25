/**
 * The order lifecycle. There is no `shipped`/`delivered` yet: adding those is
 * a new state transition, not a new order shape.
 */
export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export function isPendingPayment(status: OrderStatus): boolean {
  return status === "pending_payment";
}
