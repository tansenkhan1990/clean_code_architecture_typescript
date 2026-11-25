import { describe, expect, it } from "vitest";
import { dispatchOutboxUseCase } from "../../../src/application/outbox/dispatch-outbox.js";
import type { EventPublisher } from "../../../src/application/ports/event-publisher.js";
import type { DomainEvent } from "../../../src/domain/shared/domain-event.js";
import {
  createTestEnvironment,
  FIXED_NOW,
} from "../../support/test-environment.js";

async function stageCustomerEvent(
  environment: ReturnType<typeof createTestEnvironment>,
) {
  const customer = await environment.useCases.createCustomer({
    email: "linus@example.com",
    name: "Linus",
  });

  if (!customer.ok) throw new Error("Expected a customer");

  return customer.value;
}

function failingPublisher(): EventPublisher {
  return {
    async publish() {
      throw new Error("broker unavailable");
    },
  };
}

function observableClock() {
  let now = FIXED_NOW;

  return {
    clock: { now: () => now },
    advance(ms: number) {
      now = new Date(new Date(now).getTime() + ms).toISOString();
    },
  };
}

describe("outbox dispatcher", () => {
  it("publishes due messages once and marks them delivered", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const pendingBefore = await environment.repositories.outbox.findPending(
      10,
      FIXED_NOW,
    );
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0]?.attempts).toBe(0);
    expect(pendingBefore[0]?.nextAttemptAt).toBe(FIXED_NOW);

    const result = await environment.useCases.dispatchOutbox();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a dispatch");
    expect(result.value).toEqual({
      published: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(environment.published.map((event) => event.name)).toEqual([
      "customer.registered",
    ]);

    await environment.useCases.dispatchOutbox();
    expect(environment.published).toHaveLength(1);
  });

  it("schedules a retry with backoff instead of retrying immediately", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const { clock, advance } = observableClock();
    const dispatch = dispatchOutboxUseCase({
      outbox: environment.repositories.outbox,
      publisher: failingPublisher(),
      clock,
    });

    const failed = await dispatch();

    expect(failed.ok).toBe(true);
    if (!failed.ok) throw new Error("Expected a summary");
    expect(failed.value).toEqual({ published: 0, failed: 1, deadLettered: 0 });

    // Not due yet: the backoff has not elapsed.
    expect(
      await environment.repositories.outbox.findPending(10, clock.now()),
    ).toEqual([]);

    // The message is still pending, with one attempt recorded.
    const [message] = await environment.repositories.outbox.findPending(
      10,
      "2026-01-01T00:00:01.000Z",
    );
    expect(message).toMatchObject({
      attempts: 1,
      lastError: "broker unavailable",
      nextAttemptAt: "2026-01-01T00:00:01.000Z",
      deadLetteredAt: null,
    });

    advance(1_000);

    const recovered = dispatchOutboxUseCase({
      outbox: environment.repositories.outbox,
      publisher: {
        async publish(event) {
          environment.published.push(event);
        },
      },
      clock,
    });

    expect(await recovered()).toMatchObject({
      ok: true,
      value: { published: 1, failed: 0, deadLettered: 0 },
    });
  });

  it("dead-letters a message after the attempt budget", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const { clock, advance } = observableClock();
    const dispatch = dispatchOutboxUseCase({
      outbox: environment.repositories.outbox,
      publisher: failingPublisher(),
      clock,
    });

    // Five failed deliveries, each after its backoff window.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await dispatch();
      expect(result.ok).toBe(true);
      advance(60_000);
    }

    const dead = await environment.repositories.outbox.findDeadLettered(10);
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({
      attempts: 5,
      lastError: "broker unavailable",
    });

    // Dead letters are never picked up again.
    expect(
      await environment.repositories.outbox.findPending(10, clock.now()),
    ).toEqual([]);

    const after = await dispatch();
    expect(after).toMatchObject({
      ok: true,
      value: { published: 0, failed: 0, deadLettered: 0 },
    });
  });

  it("keeps the payload broker-agnostic", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const [message] = await environment.repositories.outbox.findPending(
      10,
      FIXED_NOW,
    );

    expect(message?.event).toEqual<Partial<DomainEvent>>({
      name: "customer.registered",
      occurredAt: expect.any(String) as unknown as string,
      payload: expect.objectContaining({
        customerId: expect.any(String) as unknown as string,
      }) as unknown as Record<string, unknown>,
    });

    expect(JSON.stringify(message)).not.toContain("topic");
    expect(JSON.stringify(message)).not.toContain("kafka");
  });
});
