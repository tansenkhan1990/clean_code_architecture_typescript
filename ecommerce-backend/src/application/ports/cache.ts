/**
 * A read-through cache. It is an optimisation, never a source of truth: a miss
 * simply means "ask the repository", and callers must tolerate failures.
 */
export type Cache = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
};
