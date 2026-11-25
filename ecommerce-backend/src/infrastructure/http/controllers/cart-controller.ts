import type { FastifyReply, FastifyRequest } from "fastify";
import type { AddItem } from "../../../application/cart/add-item/add-item.types.js";
import type { GetCart } from "../../../application/cart/get-cart/get-cart.types.js";
import type { RemoveItem } from "../../../application/cart/remove-item/remove-item.types.js";
import { sendApplicationError } from "../http-errors.js";
import { toCartResponse } from "../presenters/cart-presenter.js";
import {
  addItemBodySchema,
  cartItemParamsSchema,
  customerIdParamsSchema,
} from "../schemas/cart-schemas.js";

type CartControllerDependencies = {
  addItem: AddItem;
  removeItem: RemoveItem;
  getCart: GetCart;
};

export function createCartController({
  addItem,
  removeItem,
  getCart,
}: CartControllerDependencies) {
  return {
    async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = customerIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid customer id" });
        return;
      }

      const result = await getCart({ customerId: params.data.customerId });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toCartResponse(result.value.cart));
    },

    async addItem(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = customerIdParamsSchema.safeParse(request.params);
      const body = addItemBodySchema.safeParse(request.body);

      if (!params.success || !body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const result = await addItem({
        customerId: params.data.customerId,
        productId: body.data.productId,
        quantity: body.data.quantity,
      });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toCartResponse(result.value));
    },

    async removeItem(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const params = cartItemParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid cart item" });
        return;
      }

      const result = await removeItem({
        customerId: params.data.customerId,
        productId: params.data.productId,
      });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toCartResponse(result.value));
    },
  };
}

export type CartController = ReturnType<typeof createCartController>;
