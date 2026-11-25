import type { Role } from "../../domain/auth/role.js";
import type { Customer } from "../../domain/customer/customer.js";
import type { AccessToken } from "../ports/token-service.js";

/**
 * What a successful register or login returns. Keeping it in one place means a
 * client can treat both responses identically.
 */
export type AuthenticatedSession = {
  customer: Customer;
  role: Role;
  accessToken: AccessToken;
};
