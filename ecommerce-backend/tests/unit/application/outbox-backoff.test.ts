import { describe, expect, it } from "vitest";
import {
  isDeadLettered,
  MAX_DELIVERY_ATTEMPTS,
  retryDelayMs,
} from "../../../src/application/outbox/backoff.js";

describe("outbox backoff", () => {
  it("doubles the delay per attempt", () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(2)).toBe(2_000);
    expect(retryDelayMs(3)).toBe(4_000);
    expect(retryDelayMs(4)).toBe(8_000);
  });

  it("caps the delay at a minute", () => {
    expect(retryDelayMs(10)).toBe(60_000);
    expect(retryDelayMs(50)).toBe(60_000);
  });

  it("dead-letters only after the attempt budget", () => {
    expect(isDeadLettered(MAX_DELIVERY_ATTEMPTS - 1)).toBe(false);
    expect(isDeadLettered(MAX_DELIVERY_ATTEMPTS)).toBe(true);
  });
});
