import type { AuthenticatedSession } from "../../../application/auth/session.js";
import {
  toCustomerResponse,
  type CustomerResponse,
} from "./customer-presenter.js";

export type AuthResponse = {
  customer: CustomerResponse;
  role: string;
  accessToken: {
    token: string;
    tokenType: "Bearer";
    expiresAt: string;
  };
};

/** The credential record itself never leaves the process. */
export function toAuthResponse({
  customer,
  role,
  accessToken,
}: AuthenticatedSession): AuthResponse {
  return {
    customer: toCustomerResponse(customer),
    role,
    accessToken: {
      token: accessToken.token,
      tokenType: "Bearer",
      expiresAt: accessToken.expiresAt,
    },
  };
}
