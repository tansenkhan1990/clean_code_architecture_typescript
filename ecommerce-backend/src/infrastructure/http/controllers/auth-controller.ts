import type { FastifyReply, FastifyRequest } from "fastify";
import type { Login } from "../../../application/auth/login/login.types.js";
import type { Register } from "../../../application/auth/register/register.types.js";
import type { GetCustomer } from "../../../application/customer/get-customer/get-customer.types.js";
import { principalOf } from "../auth-guards.js";
import { sendApplicationError } from "../http-errors.js";
import { toAuthResponse } from "../presenters/auth-presenter.js";
import { toCustomerResponse } from "../presenters/customer-presenter.js";
import {
  loginBodySchema,
  registerBodySchema,
} from "../schemas/auth-schemas.js";

type AuthControllerDependencies = {
  register: Register;
  login: Login;
  getCustomer: GetCustomer;
};

export function createAuthController({
  register,
  login,
  getCustomer,
}: AuthControllerDependencies) {
  return {
    async register(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const body = registerBodySchema.safeParse(request.body);

      if (!body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const result = await register(body.data);

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(201).send(toAuthResponse(result.value));
    },

    async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const body = loginBodySchema.safeParse(request.body);

      if (!body.success) {
        reply.code(400).send({ message: "Invalid request body" });
        return;
      }

      const result = await login(body.data);

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send(toAuthResponse(result.value));
    },

    async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const principal = principalOf(request);

      const result = await getCustomer({ id: principal.customerId });

      if (!result.ok) {
        sendApplicationError(reply, result.error);
        return;
      }

      reply.code(200).send({
        customer: toCustomerResponse(result.value),
        role: principal.role,
      });
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
