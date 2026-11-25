import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import type { Principal } from "../../application/auth/principal.js";
import type { TokenService } from "../../application/ports/token-service.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the `onRequest` hook; `null` when no valid bearer token was sent. */
    principal: Principal | null;
  }
}

function unauthorized(reply: FastifyReply): void {
  void reply
    .header("www-authenticate", 'Bearer realm="api"')
    .code(401)
    .send({ message: "Authentication required" });
}

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (typeof header !== "string") {
    return null;
  }

  const separator = header.indexOf(" ");

  if (separator === -1) {
    return null;
  }

  if (header.slice(0, separator).toLowerCase() !== "bearer") {
    return null;
  }

  const token = header.slice(separator + 1).trim();
  return token.length === 0 ? null : token;
}

/**
 * Extracts the caller once, for every route. A missing or invalid token is not
 * an error here: public routes must still work, and the protected ones decide
 * what to do with `principal === null`.
 */
export function registerAuthentication(
  app: FastifyInstance,
  tokens: TokenService,
): void {
  app.decorateRequest("principal", null);

  app.addHook("onRequest", async (request) => {
    const token = readBearerToken(request);

    if (token === null) {
      return;
    }

    try {
      request.principal = await tokens.verify(token);
    } catch {
      // A verifier failure is an unauthenticated request, not a server fault.
      request.principal = null;
    }
  });
}

/** Route guard: a verified principal must exist. */
export const requireAuth: preHandlerHookHandler = async (request, reply) => {
  if (request.principal === null) {
    unauthorized(reply);
  }
};

/** Route guard: only administrators may continue. */
export const requireAdmin: preHandlerHookHandler = async (request, reply) => {
  if (request.principal === null) {
    unauthorized(reply);
    return;
  }

  if (request.principal.role !== "admin") {
    void reply
      .code(403)
      .send({ message: "You are not allowed to access this resource" });
  }
};

/**
 * Handlers run only after `requireAuth`, but the type system does not know
 * that, and a silent `null` would turn a wiring mistake into a crash. This
 * makes the assumption explicit and answers 401 if it is ever wrong.
 */
export function principalOf(request: FastifyRequest): Principal {
  const principal = request.principal;

  if (principal === null) {
    const error = new Error("Authentication required") as Error & {
      statusCode: number;
    };
    error.statusCode = 401;
    throw error;
  }

  return principal;
}
