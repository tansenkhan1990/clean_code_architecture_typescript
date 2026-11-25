import type { FastifyReply, FastifyRequest } from "fastify";
import {
  canActForCustomer,
  FORBIDDEN,
} from "../../../application/auth/access-policy.js";
import type { GetCustomer } from "../../../application/customer/get-customer/get-customer.types.js";
import { principalOf } from "../auth-guards.js";
import { sendApplicationError } from "../http-errors.js";
import { toCustomerResponse } from "../presenters/customer-presenter.js";
import { customerIdParamsSchema } from "../schemas/customer-schemas.js";

type CustomerControllerDependencies = {
  getCustomer: GetCustomer;
};

/**
 * Registration lives at `/auth/register`, not here: a customer without
 * credentials cannot be created. This controller only reads.
 */
export function createCustomerController({
  getCustomer,
}: CustomerControllerDependencies) {
  return {
    async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = customerIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid customer id" });
        return;
      }

      const principal = principalOf(request);

      if (!canActForCustomer(principal, params.data.id)) {
        sendApplicationError(reply, FORBIDDEN);
        return;
      }

      const result = await getCustomer({ id: params.data.id });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toCustomerResponse(result.value));
    },
  };
}

export type CustomerController = ReturnType<typeof createCustomerController>;
