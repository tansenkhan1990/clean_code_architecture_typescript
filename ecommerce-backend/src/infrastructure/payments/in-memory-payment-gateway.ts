import type {
  PaymentGateway,
  PaymentGatewayRequest,
} from "../../application/ports/payment-gateway.js";

export type InMemoryPaymentGatewayOptions = {
  /** Decide declines per request; by default every charge succeeds. */
  declineWhen?: (request: PaymentGatewayRequest) => boolean;
  referencePrefix?: string;
};

/**
 * A gateway for local runs and tests: deterministic references, no network,
 * and a decline hook so the failure path is reachable. Stripe (or any real
 * processor) implements the same port.
 *
 * Charges are remembered by idempotency key, mirroring how a real provider
 * protects a retried request from taking money twice.
 */
export function createInMemoryPaymentGateway(
  options: InMemoryPaymentGatewayOptions = {},
): PaymentGateway {
  const prefix = options.referencePrefix ?? "test";
  const references = new Map<string, string>();

  return {
    async charge(request) {
      const previous = references.get(request.idempotencyKey);

      if (previous !== undefined) {
        return { ok: true, value: { providerReference: previous } };
      }

      if (options.declineWhen?.(request) === true) {
        return {
          ok: false,
          error: {
            type: "payment_declined",
            message: "Card was declined by the payment gateway",
          },
        };
      }

      const providerReference = `${prefix}_${references.size + 1}`;
      references.set(request.idempotencyKey, providerReference);

      return {
        ok: true,
        value: { providerReference },
      };
    },
  };
}
