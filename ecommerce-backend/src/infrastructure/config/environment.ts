import { existsSync } from "node:fs";
import { z } from "zod";
import { err, ok, type Result } from "../../domain/shared/result.js";

export type Config = {
  port: number;
  nodeEnv: "development" | "test" | "production";
  /** Set to use PostgreSQL (Prisma); null keeps the in-memory adapters. */
  databaseUrl: string | null;
  /** Set to use Redis for cache, idempotency, and rate limiting. */
  redisUrl: string | null;
  /** Set to publish outbox events to Kafka and run the consumer. */
  kafkaBrokers: string[] | null;
  kafkaClientId: string;
  kafkaConsumerGroup: string;
  rateLimit: {
    max: number;
    windowSeconds: number;
  };
  outboxPollIntervalMs: number;
};

export type ConfigError = {
  type: "invalid_configuration";
  message: string;
};

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // An empty value (docker compose passes one for an unset variable) means
  // "use the fallback adapter", not "connect to an empty URI".
  DATABASE_URL: optionalString,
  REDIS_URL: optionalString,
  KAFKA_BROKERS: optionalString,
  KAFKA_CLIENT_ID: z.string().min(1).default("ecommerce-backend"),
  KAFKA_CONSUMER_GROUP: z.string().min(1).default("ecommerce-order-events"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1_000),
});

/** Loads a local `.env` when present, then hands back `process.env`. */
export function loadEnvironment(): NodeJS.ProcessEnv {
  if (existsSync(".env")) {
    process.loadEnvFile();
  }

  return process.env;
}

function parseBrokers(value: string | undefined): string[] | null {
  if (value === undefined) {
    return null;
  }

  const brokers = value
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

  return brokers.length === 0 ? null : brokers;
}

/**
 * Validates the environment once, at the edge. No other module reads
 * `process.env`, so defaults and failure messages cannot drift apart.
 */
export function parseEnvironment(
  env: NodeJS.ProcessEnv,
): Result<Config, ConfigError> {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");

    return err({
      type: "invalid_configuration",
      message: `Invalid configuration: ${details}`,
    });
  }

  return ok({
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    databaseUrl: parsed.data.DATABASE_URL ?? null,
    redisUrl: parsed.data.REDIS_URL ?? null,
    kafkaBrokers: parseBrokers(parsed.data.KAFKA_BROKERS),
    kafkaClientId: parsed.data.KAFKA_CLIENT_ID,
    kafkaConsumerGroup: parsed.data.KAFKA_CONSUMER_GROUP,
    rateLimit: {
      max: parsed.data.RATE_LIMIT_MAX,
      windowSeconds: parsed.data.RATE_LIMIT_WINDOW_SECONDS,
    },
    outboxPollIntervalMs: parsed.data.OUTBOX_POLL_INTERVAL_MS,
  });
}
