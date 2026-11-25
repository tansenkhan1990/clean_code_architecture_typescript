import { SignJWT, jwtVerify } from "jose";
import type { Principal } from "../../application/auth/principal.js";
import type {
  AccessToken,
  TokenService,
} from "../../application/ports/token-service.js";
import { isRole } from "../../domain/auth/role.js";

export type JwtTokenServiceOptions = {
  /** Shared secret; at least 32 characters. In production, a managed secret. */
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
};

/**
 * HS256 access tokens.
 *
 * Only the claims the application needs are carried: the customer id (`sub`),
 * the email, and the role. Issuer and audience are verified on the way in, so
 * a token minted for another service with the same secret is not accepted.
 */
export function createJwtTokenService({
  secret,
  issuer,
  audience,
  ttlSeconds,
}: JwtTokenServiceOptions): TokenService {
  const key = new TextEncoder().encode(secret);

  return {
    async issue(principal: Principal): Promise<AccessToken> {
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + ttlSeconds;

      const token = await new SignJWT({
        email: principal.email,
        role: principal.role,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(principal.customerId)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(key);

      return {
        token,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      };
    },

    async verify(token: string): Promise<Principal | null> {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer,
          audience,
          algorithms: ["HS256"],
          clockTolerance: 5,
        });

        const email = payload["email"];
        const role = payload["role"];

        if (
          typeof payload.sub !== "string" ||
          payload.sub.length === 0 ||
          typeof email !== "string" ||
          typeof role !== "string" ||
          !isRole(role)
        ) {
          return null;
        }

        return { customerId: payload.sub, email, role };
      } catch {
        // Expired, malformed, wrong signature, wrong issuer/audience: all the
        // same answer to the caller.
        return null;
      }
    },
  };
}
