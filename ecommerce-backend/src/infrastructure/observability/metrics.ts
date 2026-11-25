import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export type CheckoutMetricOutcome =
  "completed" | "replayed" | "declined" | "in_progress" | "failed";

export type Metrics = {
  registry: Registry;
  observeHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void;
  recordCheckout(outcome: CheckoutMetricOutcome): void;
  recordOutboxDelivery(published: number, failed: number): void;
  render(): Promise<string>;
  contentType: string;
};

/**
 * Metrics are an infrastructure concern: the application returns meaningful
 * outcomes, and this module turns them into series. Cardinality is bounded by
 * using the *route pattern*, never the raw URL.
 */
export function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpRequests = new Counter({
    name: "http_requests_total",
    help: "HTTP requests by method, route, and status",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
  });

  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const checkout = new Counter({
    name: "checkout_total",
    help: "Checkout attempts by outcome",
    labelNames: ["outcome"] as const,
    registers: [registry],
  });

  const outbox = new Counter({
    name: "outbox_messages_total",
    help: "Outbox messages by delivery result",
    labelNames: ["result"] as const,
    registers: [registry],
  });

  return {
    registry,
    contentType: registry.contentType,

    observeHttpRequest({ method, route, statusCode, durationSeconds }) {
      const labels = {
        method,
        route,
        status: String(statusCode),
      };

      httpRequests.inc(labels);
      httpDuration.observe(labels, durationSeconds);
    },

    recordCheckout(outcome) {
      checkout.inc({ outcome });
    },

    recordOutboxDelivery(published, failed) {
      if (published > 0) {
        outbox.inc({ result: "published" }, published);
      }

      if (failed > 0) {
        outbox.inc({ result: "failed" }, failed);
      }
    },

    render() {
      return registry.metrics();
    },
  };
}
