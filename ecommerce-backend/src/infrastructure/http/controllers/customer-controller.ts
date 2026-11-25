import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCustomer } from "../../../application/customer/create-customer/create-customer.types.js";
import type { GetCustomer } from "../../../application/customer/get-customer/get-customer.types.js";
import { sendApplicationError } from "../http-errors.js";
import { toCustomerResponse } from "../presenters/customer-presenter.js";
import {
  createCustomerBodySchema,
  customerIdParamsSchema,
} from "../schemas/customer-schemas.js";

type CustomerControllerDependencies = {
  createCustomer: CreateCustomer;
  getCustomer: GetCustomer;
};

/** HTTP adapter for customers: parse, call a use case, present the result. */
export function createCustomerController({
  createCustomer,
  getCustomer,
}: CustomerControllerDependencies) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const body = createCustomerBodySchema.safeParse(request.body);

      if (!body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const result = await createCustomer(body.data);

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(201).send(toCustomerResponse(result.value));
    },

    async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = customerIdParamsSchema.safeParse(request.params);

      if (!params.success) {
        reply.code(400).send({ message: "Invalid customer id" });
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
