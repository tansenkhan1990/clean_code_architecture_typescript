import type { FastifyInstance } from "fastify";
import type { Metrics } from "../observability/metrics.js";
import { runHealthChecks, type HealthCheck } from "../health/health-check.js";

export type HealthRoutesOptions = {
  checks: HealthCheck[];
  metrics?: Metrics;
};

/**
 * Liveness, readiness, and metrics — the three endpoints an orchestrator and a
 * scraper expect, and the only routes exempt from rate limiting.
 */
export function registerHealthRoutes(
  app: FastifyInstance,
  { checks, metrics }: HealthRoutesOptions,
): void {
  app.get("/health", async () => ({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get("/ready", async (_request, reply) => {
    const report = await runHealthChecks(checks);

    reply.code(report.status === "ok" ? 200 : 503);

    return report;
  });

  if (metrics !== undefined) {
    app.get("/metrics", async (_request, reply) => {
      reply.type(metrics.contentType);
      return metrics.render();
    });
  }
}
