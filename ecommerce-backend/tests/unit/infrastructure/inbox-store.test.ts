import { describe, expect, it } from "vitest";
import { createInMemoryInboxStore } from "../../../src/infrastructure/inbox/in-memory-inbox-store.js";

describe("inbox", () => {
  it("accepts an event once and reports the redelivery as seen", async () => {
    const inbox = createInMemoryInboxStore();
    const input = {
      id: "event-1",
      eventName: "order.paid",
      processedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(await inbox.markProcessed(input)).toBe(true);
    expect(await inbox.markProcessed(input)).toBe(false);
    expect(await inbox.hasProcessed("event-1")).toBe(true);
    expect(await inbox.hasProcessed("event-2")).toBe(false);
  });

  it("treats different events independently", async () => {
    const inbox = createInMemoryInboxStore();

    expect(
      await inbox.markProcessed({
        id: "a",
        eventName: "order.created",
        processedAt: "now",
      }),
    ).toBe(true);
    expect(
      await inbox.markProcessed({
        id: "b",
        eventName: "order.created",
        processedAt: "now",
      }),
    ).toBe(true);
  });
});
