import type { Clock } from "../../src/application/ports/clock.js";
import type { EventPublisher } from "../../src/application/ports/event-publisher.js";
import type { IdGenerator } from "../../src/application/ports/id-generator.js";
import type { DomainEvent } from "../../src/domain/shared/domain-event.js";
import { buildHttpApp } from "../../src/infrastructure/http/fastify.js";
import { createInMemoryPaymentGateway } from "../../src/infrastructure/payments/in-memory-payment-gateway.js";
import {
  buildControllers,
  buildInMemoryDependencies,
  buildUseCases,
  type UseCases,
} from "../../src/main/container.js";

export const FIXED_NOW = "2026-01-01T00:00:00.000Z";

type TestEnvironmentOptions = {
  declinePayments?: boolean;
};

export type TestEnvironment = {
  /** The port implementations, including the shared outbox. */
  repositories: ReturnType<typeof buildInMemoryDependencies>;
  /** Events the publisher actually received; empty until the outbox drains. */
  published: DomainEvent[];
  useCases: UseCases;
  controllers: ReturnType<typeof buildControllers>;
  /** Drains pending outbox messages, as the background worker would. */
  drainOutbox: () => Promise<void>;
};

/**
 * Reuses the production wiring and overrides only the ports that tests care
 * about: a fixed clock, predictable ids, captured events, and a gateway that
 * can be told to decline. Same ports, different adapters.
 */
export function createTestEnvironment(
  options: TestEnvironmentOptions = {},
): TestEnvironment {
  const repositories = buildInMemoryDependencies();

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

  const useCases = buildUseCases({
    ...repositories,
    clock,
    ids,
    events,
    gateway,
  });

  return {
    repositories,
    published,
    useCases,
    controllers: buildControllers(useCases),
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
    app: buildHttpApp({ controllers: environment.controllers, logger: false }),
    environment,
  };
}
