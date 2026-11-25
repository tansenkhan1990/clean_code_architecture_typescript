/** Identity creation is a capability, so use cases never call `randomUUID`. */
export type IdGenerator = {
  nextId(): string;
};
