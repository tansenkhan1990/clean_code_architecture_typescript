import type { FastifyReply, FastifyRequest } from "fastify";
import type { Checkout } from "../../../application/checkout/checkout.types.js";
import { sendApplicationError } from "../http-errors.js";
import { toCheckoutResponse } from "../presenters/checkout-presenter.js";
import { checkoutBodySchema } from "../schemas/order-schemas.js";

type CheckoutControllerDependencies = {
  checkout: Checkout;
};

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/**
 * Reads the caller's idempotency key. A malformed header is a client error;
 * an absent one simply means "no replay protection for this request".
 */
function readIdempotencyKey(
  request: FastifyRequest,
): { ok: true; key: string | undefined } | { ok: false } {
  const header = request.headers["idempotency-key"];

  if (header === undefined) {
    return { ok: true, key: undefined };
  }

  if (typeof header !== "string") {
    return { ok: false };
  }

  const key = header.trim();

  if (key.length === 0 || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false };
  }

  return { ok: true, key };
}

export function createCheckoutController({
  checkout,
}: CheckoutControllerDependencies) {
  return {
    async checkout(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const body = checkoutBodySchema.safeParse(request.body);
      const idempotencyKey = readIdempotencyKey(request);

      if (!body.success || !idempotencyKey.ok) {
        reply.code(400).send({ message: "Invalid request" });
        return;
      }

      const result = await checkout(
        idempotencyKey.key === undefined
          ? { customerId: body.data.customerId }
          : {
              customerId: body.data.customerId,
              idempotencyKey: idempotencyKey.key,
            },
      );

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      if (result.value.replayed) {
        reply.header("idempotent-replay", "true");
      }

      reply
        .code(result.value.replayed ? 200 : 201)
        .send(toCheckoutResponse(result.value));
    },
  };
}

export type CheckoutController = ReturnType<typeof createCheckoutController>;
