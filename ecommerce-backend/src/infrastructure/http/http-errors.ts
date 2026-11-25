import type { FastifyReply } from "fastify";

/**
 * Error type to status. The suffix conventions below already cover the bulk of
 * the mapping, so this table only holds the types that need a specific code.
 */
const EXPLICIT_STATUSES: Record<string, number> = {
  invalid_credentials: 401,
  forbidden: 403,
  invalid_customer: 400,
  invalid_product: 400,
  invalid_inventory: 400,
  invalid_order: 400,
  invalid_payment: 400,
  invalid_cart_quantity: 400,
  cart_currency_mismatch: 409,
  insufficient_stock: 409,
  email_already_registered: 409,
  order_already_paid: 409,
  order_cancelled: 409,
  empty_cart: 409,
  item_not_in_cart: 409,
  payment_declined: 402,
  payment_gateway_unavailable: 502,
  idempotency_unavailable: 503,
  checkout_in_progress: 409,
};

export function statusForError(errorType: string): number {
  // The table wins over the suffix conventions: `invalid_credentials` is an
  // authentication failure (401), not a malformed request (400).
  const explicit = EXPLICIT_STATUSES[errorType];

  if (explicit !== undefined) {
    return explicit;
  }

  if (errorType.endsWith("_not_found")) {
    return 404;
  }

  if (errorType.startsWith("invalid_")) {
    return 400;
  }

  return 500;
}

/**
 * Expected failures explain themselves; server faults stay opaque so storage
 * or broker details never reach a client.
 */
export function sendApplicationError(
  reply: FastifyReply,
  error: { type: string; message: string },
): void {
  const status = statusForError(error.type);

  if (status >= 500) {
    reply.code(status).send({ message: "Internal server error" });
    return;
  }

  reply.code(status).send({ message: error.message });
}
