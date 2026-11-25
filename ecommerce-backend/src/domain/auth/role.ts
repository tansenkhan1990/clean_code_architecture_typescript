/**
 * The closed set of roles. Authorization is written against these values, so a
 * typo in a token or a row becomes a rejected role rather than a silent grant.
 */
export const ROLES = ["customer", "admin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
