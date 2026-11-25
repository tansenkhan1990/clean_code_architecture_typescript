import type { FastifyInstance } from "fastify";
import { loadConfig } from "../infrastructure/config/config.js";
import { buildHttpApp } from "../infrastructure/http/fastify.js";
import {
  createOutboxWorker,
  type OutboxWorker,
} from "../infrastructure/outbox/outbox-worker.js";
import { buildContainer } from "./container.js";

/** One shutdown path for both termination signals. */
function registerShutdown(
  app: FastifyInstance,
  worker: OutboxWorker,
  closeContainer: () => Promise<void>,
): void {
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    await worker.stop();
    await app.close();
    await closeContainer();
    process.exit(0);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}

async function start(): Promise<void> {
  const config = loadConfig();

  if (!config.ok) {
    console.error(config.error.message);
    process.exitCode = 1;
    return;
  }

  let container;

  try {
    container = await buildContainer({
      postgres:
        config.value.databaseUrl === null
          ? null
          : { url: config.value.databaseUrl },
      redis:
        config.value.redisUrl === null ? null : { url: config.value.redisUrl },
      kafka:
        config.value.kafkaBrokers === null
          ? null
          : {
              brokers: config.value.kafkaBrokers,
              clientId: config.value.kafkaClientId,
              consumerGroup: config.value.kafkaConsumerGroup,
            },
      rateLimit: config.value.rateLimit,
    });
  } catch (error) {
    console.error(
      "Could not start the configured adapters:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
    return;
  }

  const { controllers, useCases, close } = container;

  const worker = createOutboxWorker({
    dispatch: useCases.dispatchOutbox,
    intervalMs: config.value.outboxPollIntervalMs,
  });

  const app = buildHttpApp({
    controllers,
    rateLimiter: container.rateLimiter,
    metrics: container.metrics,
    healthChecks: container.healthChecks,
  });

  app.log.info(
    {
      persistence: config.value.databaseUrl === null ? "memory" : "postgresql",
      cache: config.value.redisUrl === null ? "memory" : "redis",
      events: config.value.kafkaBrokers === null ? "stdout" : "kafka",
      rateLimit: config.value.rateLimit,
    },
    "Adapters selected",
  );

  await container.start();
  worker.start();
  registerShutdown(app, worker, close);

  try {
    await app.listen({ port: config.value.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    await worker.stop();
    await app.close();
    await close();
    process.exitCode = 1;
  }
}

await start();
