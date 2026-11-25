import type { Clock } from "../../src/application/ports/clock.js";
import type { EventPublisher } from "../../src/application/ports/event-publisher.js";
import type { IdGenerator } from "../../src/application/ports/id-generator.js";
import type { DomainEvent } from "../../src/domain/shared/domain-event.js";
import { createJwtTokenService } from "../../src/infrastructure/auth/jwt-token-service.js";
import { createScryptPasswordHasher } from "../../src/infrastructure/auth/scrypt-password-hasher.js";
import { buildHttpApp } from "../../src/infrastructure/http/fastify.js";
import { createInMemoryPaymentGateway } from "../../src/infrastructure/payments/in-memory-payment-gateway.js";
import {
  buildControllers,
  buildInMemoryDependencies,
  buildUseCases,
  type AuthDependencies,
  type UseCases,
} from "../../src/main/container.js";

export const FIXED_NOW = "2026-01-01T00:00:00.000Z";

/** Meets the domain's 12-character floor without being a real credential. */
export const TEST_PASSWORD = "correct horse battery staple";

const TEST_JWT_SECRET = "test-only-secret-that-is-long-enough-32";

type TestEnvironmentOptions = {
  declinePayments?: boolean;
  bootstrapAdminEmails?: readonly string[];
};

export type TestEnvironment = {
  /** The port implementations, including the shared outbox. */
  repositories: ReturnType<typeof buildInMemoryDependencies>;
  /** Events the publisher actually received; empty until the outbox drains. */
  published: DomainEvent[];
  useCases: UseCases;
  controllers: ReturnType<typeof buildControllers>;
  auth: AuthDependencies;
  /** Drains pending outbox messages, as the background worker would. */
  drainOutbox: () => Promise<void>;
};

/**
 * Real auth adapters, with a scrypt cost low enough for a test suite. The
 * verification path, the token format, and the claims are the production ones.
 */
export function createTestAuth(): AuthDependencies {
  return {
    hasher: createScryptPasswordHasher({ cost: { n: 1_024 } }),
    tokens: createJwtTokenService({
      secret: TEST_JWT_SECRET,
      issuer: "ecommerce-backend",
      audience: "ecommerce-api",
      ttlSeconds: 900,
    }),
  };
}

/** Registers through the real use case and returns the customer profile. */
export async function registerTestCustomer(
  environment: TestEnvironment,
  input: { email?: string; name?: string } = {},
) {
  const result = await environment.useCases.register({
    email: input.email ?? "ada@example.com",
    name: input.name ?? "Ada",
    password: TEST_PASSWORD,
  });

  if (!result.ok) {
    throw new Error(`Expected a registration: ${result.error.message}`);
  }

  return result.value.customer;
}

/**
 * Reuses the production wiring and overrides only the ports that tests care
 * about: a fixed clock, predictable ids, captured events, and a gateway that
 * can be told to decline. Same ports, different adapters.
 */
export function createTestEnvironment(
  options: TestEnvironmentOptions = {},
): TestEnvironment {
  const repositories = buildInMemoryDependencies();
  const auth = createTestAuth();

  const clock: Clock = { now: () => FIXED_NOW };
  let sequence = 0;
  const ids: IdGenerator = { nextId: () => `id-${(sequence += 1)}` };

  const published: DomainEvent[] = [];
  const events: EventPublisher = {
    async publish(event) {
      published.push(event);
    },
  };

  const gateway = createInMemoryPaymentGateway(
    options.declinePayments === true ? { declineWhen: () => true } : {},
  );

  const useCases = buildUseCases(
    {
      ...repositories,
      clock,
      ids,
      events,
      gateway,
    },
    auth,
    { bootstrapAdminEmails: options.bootstrapAdminEmails ?? [] },
  );

  return {
    repositories,
    published,
    useCases,
    controllers: buildControllers(useCases),
    auth,
    async drainOutbox() {
      const result = await useCases.dispatchOutbox();

      if (!result.ok) {
        throw new Error(result.error.message);
      }
    },
  };
}

export function createTestHttpApp(options: TestEnvironmentOptions = {}) {
  const environment = createTestEnvironment(options);

  return {
    app: buildHttpApp({
      controllers: environment.controllers,
      logger: false,
      tokens: environment.auth.tokens,
    }),
    environment,
  };
}
