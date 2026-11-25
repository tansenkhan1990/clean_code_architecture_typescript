import { describe, expect, it } from "vitest";
import { dispatchOutboxUseCase } from "../../../src/application/outbox/dispatch-outbox.js";
import type { EventPublisher } from "../../../src/application/ports/event-publisher.js";
import type { DomainEvent } from "../../../src/domain/shared/domain-event.js";
import { createTestEnvironment } from "../../support/test-environment.js";

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

describe("outbox dispatcher", () => {
  it("publishes pending messages once and marks them delivered", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const pendingBefore = await environment.repositories.outbox.findPending(10);
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0]?.attempts).toBe(0);

    const result = await environment.useCases.dispatchOutbox();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a dispatch");
    expect(result.value).toEqual({ published: 1, failed: 0 });
    expect(environment.published.map((event) => event.name)).toEqual([
      "customer.registered",
    ]);

    await environment.useCases.dispatchOutbox();
    expect(environment.published).toHaveLength(1);
  });

  it("records a failed delivery and leaves the message pending for a retry", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const failing: EventPublisher = {
      async publish() {
        throw new Error("broker unavailable");
      },
    };

    const dispatch = dispatchOutboxUseCase({
      outbox: environment.repositories.outbox,
      publisher: failing,
      clock: environment.repositories.clock,
    });

    const failed = await dispatch();

    expect(failed.ok).toBe(true);
    if (!failed.ok) throw new Error("Expected a summary");
    expect(failed.value).toEqual({ published: 0, failed: 1 });
    expect(environment.published).toEqual([]);

    const pending = await environment.repositories.outbox.findPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      attempts: 1,
      lastError: "broker unavailable",
      publishedAt: null,
    });

    // The next poll with a healthy broker delivers it and clears the row.
    const recovered = await environment.useCases.dispatchOutbox();
    expect(recovered.ok).toBe(true);

    const remaining = await environment.repositories.outbox.findPending(10);
    expect(remaining).toEqual([]);
    expect(environment.published.map((event) => event.name)).toEqual([
      "customer.registered",
    ]);
  });

  it("keeps the broker-agnostic event shape", async () => {
    const environment = createTestEnvironment();
    await stageCustomerEvent(environment);

    const [message] = await environment.repositories.outbox.findPending(10);

    expect(message?.event).toEqual<Partial<DomainEvent>>({
      name: "customer.registered",
      occurredAt: expect.any(String) as unknown as string,
      payload: expect.objectContaining({
        customerId: expect.any(String) as unknown as string,
      }) as unknown as Record<string, unknown>,
    });

    // Nothing broker-specific leaked into the outbox record.
    expect(JSON.stringify(message)).not.toContain("topic");
    expect(JSON.stringify(message)).not.toContain("kafka");
  });
});
