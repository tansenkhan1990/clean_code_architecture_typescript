/** A payment is only ever pending once; it then resolves exactly once. */
export type PaymentStatus = "pending" | "succeeded" | "failed";

export function isPending(status: PaymentStatus): boolean {
  return status === "pending";
}
