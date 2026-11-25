/** Time is a capability, so use cases are deterministic in tests. */
export type Clock = {
  now(): string;
};
