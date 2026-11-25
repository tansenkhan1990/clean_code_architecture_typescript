import type { FastifyReply, FastifyRequest } from "fastify";
import {
  canAccessOrder,
  canActForCustomer,
  FORBIDDEN,
} from "../../../application/auth/access-policy.js";
import type { CancelOrder } from "../../../application/order/cancel-order/cancel-order.types.js";
import type { CreateOrder } from "../../../application/order/create-order/create-order.types.js";
import type { GetOrder } from "../../../application/order/get-order/get-order.types.js";
import type { ProcessPayment } from "../../../application/payment/process-payment/process-payment.types.js";
import { principalOf } from "../auth-guards.js";
import { sendApplicationError } from "../http-errors.js";
import { toOrderResponse } from "../presenters/order-presenter.js";
import { toPaymentResponse } from "../presenters/payment-presenter.js";
import {
  createOrderBodySchema,
  orderIdParamsSchema,
} from "../schemas/order-schemas.js";

type OrderControllerDependencies = {
  createOrder: CreateOrder;
  getOrder: GetOrder;
  cancelOrder: CancelOrder;
  processPayment: ProcessPayment;
};

export function createOrderController({
  createOrder,
  getOrder,
  cancelOrder,
  processPayment,
}: OrderControllerDependencies) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const body = createOrderBodySchema.safeParse(request.body);

      if (!body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const principal = principalOf(request);

      // Ordering on someone else's behalf is an administrator action.
      if (!canActForCustomer(principal, body.data.customerId)) {
        sendApplicationError(reply, FORBIDDEN);
        return;
      }

      const result = await createOrder({ customerId: body.data.customerId });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(201).send(toOrderResponse(result.value));
    },

    async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = orderIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid order id" });
        return;
      }

      const result = await getOrder({ id: params.data.id });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      const principal = principalOf(request);

      if (!canAccessOrder(principal, result.value)) {
        sendApplicationError(reply, FORBIDDEN);
        return;
      }

      reply.code(200).send(toOrderResponse(result.value));
    },

    async cancel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = orderIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid order id" });
        return;
      }

      const existing = await getOrder({ id: params.data.id });

      if (!existing.ok) {
        sendApplicationError(reply, existing.error);
        return;
      }

      const principal = principalOf(request);

      if (!canAccessOrder(principal, existing.value)) {
        sendApplicationError(reply, FORBIDDEN);
        return;
      }

      const result = await cancelOrder({ orderId: params.data.id });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toOrderResponse(result.value));
    },

    async pay(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = orderIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid order id" });
        return;
      }

      const existing = await getOrder({ id: params.data.id });

      if (!existing.ok) {
        sendApplicationError(reply, existing.error);
        return;
      }

      const principal = principalOf(request);

      if (!canAccessOrder(principal, existing.value)) {
        sendApplicationError(reply, FORBIDDEN);
        return;
      }

      const result = await processPayment({ orderId: params.data.id });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send({
        order: toOrderResponse(result.value.order),
        payment: toPaymentResponse(result.value.payment),
      });
    },
  };
}

export type OrderController = ReturnType<typeof createOrderController>;
