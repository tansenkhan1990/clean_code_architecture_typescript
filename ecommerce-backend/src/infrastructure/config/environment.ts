import { existsSync } from "node:fs";
import { z } from "zod";
import { err, ok, type Result } from "../../domain/shared/result.js";

export type AuthConfig = {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  /** True when the development fallback is in use; never true in production. */
  usingDevelopmentSecret: boolean;
  /** Brute-force budget for register/login, per caller and route. */
  rateLimit: {
    max: number;
    windowSeconds: number;
  };
  /** Addresses that receive `admin` on registration; empty after bootstrap. */
  bootstrapAdminEmails: string[];
};

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
  auth: AuthConfig;
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

/**
 * A development-only fallback, long enough for HS256 and obviously not a
 * production secret. Production refuses to start without a real one.
 */
const DEVELOPMENT_JWT_SECRET =
  "development-only-secret-change-before-deploying";

const MIN_JWT_SECRET_LENGTH = 32;

const envSchema = z
  .object({
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
    JWT_SECRET: optionalString,
    JWT_ISSUER: z.string().min(1).default("ecommerce-backend"),
    JWT_AUDIENCE: z.string().min(1).default("ecommerce-api"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(900),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    BOOTSTRAP_ADMIN_EMAILS: optionalString,
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1_000),
  })
  .superRefine((data, context) => {
    if (
      data.JWT_SECRET !== undefined &&
      data.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: `must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
      });
    }

    if (data.NODE_ENV === "production" && data.JWT_SECRET === undefined) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "is required in production",
      });
    }
  });

/** Loads a local `.env` when present, then hands back `process.env`. */
export function loadEnvironment(): NodeJS.ProcessEnv {
  if (existsSync(".env")) {
    process.loadEnvFile();
  }

  return process.env;
}

function parseList(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
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
    auth: {
      jwtSecret: parsed.data.JWT_SECRET ?? DEVELOPMENT_JWT_SECRET,
      jwtIssuer: parsed.data.JWT_ISSUER,
      jwtAudience: parsed.data.JWT_AUDIENCE,
      accessTokenTtlSeconds: parsed.data.ACCESS_TOKEN_TTL_SECONDS,
      usingDevelopmentSecret: parsed.data.JWT_SECRET === undefined,
      rateLimit: {
        max: parsed.data.AUTH_RATE_LIMIT_MAX,
        windowSeconds: parsed.data.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      },
      bootstrapAdminEmails: parseList(parsed.data.BOOTSTRAP_ADMIN_EMAILS),
    },
    outboxPollIntervalMs: parsed.data.OUTBOX_POLL_INTERVAL_MS,
  });
}
