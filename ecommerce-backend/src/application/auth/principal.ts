import type { Role } from "../../domain/auth/role.js";

/**
 * The authenticated caller, as the application layer understands it. It is
 * derived from a verified token at the edge; use cases never parse HTTP.
 */
export type Principal = {
  customerId: string;
  email: string;
  role: Role;
};
