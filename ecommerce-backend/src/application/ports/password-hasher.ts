/**
 * Password hashing is deliberately a port: the algorithm, its cost, and the
 * encoding are infrastructure decisions, while the application only needs
 * "store this safely" and "does this match".
 */
export type PasswordHasher = {
  /** Returns a self-describing hash (algorithm and parameters included). */
  hash(password: string): Promise<string>;
  /**
   * A missing credential (`null`) still costs one verification in the
   * adapter, so an unknown account and a wrong password take the same time and
   * cannot be distinguished by an attacker.
   */
  verify(password: string, storedHash: string | null): Promise<boolean>;
};
