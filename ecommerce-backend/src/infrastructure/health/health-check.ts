/**
 * A dependency the process needs in order to serve traffic. Liveness answers
 * "is this process alive"; readiness answers "should a load balancer send it
 * work", which is why it pings the database and the cache.
 */
export type HealthCheck = {
  name: string;
  check(): Promise<void>;
};

export type HealthReport = {
  status: "ok" | "degraded";
  checks: Record<string, "up" | "down">;
};

export async function runHealthChecks(
  checks: HealthCheck[],
): Promise<HealthReport> {
  const results = await Promise.allSettled(
    checks.map(async (check) => {
      await check.check();
      return check.name;
    }),
  );

  const report: Record<string, "up" | "down"> = {};

  results.forEach((result, index) => {
    const name = checks[index]?.name ?? "unknown";
    report[name] = result.status === "fulfilled" ? "up" : "down";
  });

  const healthy = Object.values(report).every((status) => status === "up");

  return {
    status: healthy ? "ok" : "degraded",
    checks: report,
  };
}
