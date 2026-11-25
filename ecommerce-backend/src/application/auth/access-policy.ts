import type { Principal } from "./principal.js";

export type AuthorizationError = {
  type: "forbidden";
  message: string;
};

/**
 * One message for every refusal: it tells the caller that this principal may
 * not perform this operation, and nothing about what exists or who owns it.
 */
export const FORBIDDEN: AuthorizationError = {
  type: "forbidden",
  message: "You are not allowed to access this resource",
};

/**
 * Ownership is a business rule, so it lives here rather than in a route table:
 * a customer may act for itself, and an administrator may act for anyone.
 */
export function canActForCustomer(
  principal: Principal,
  customerId: string,
): boolean {
  return principal.role === "admin" || principal.customerId === customerId;
}

export function canAccessOrder(
  principal: Principal,
  order: { customerId: string },
): boolean {
  return canActForCustomer(principal, order.customerId);
}
