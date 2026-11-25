import { err, ok } from "../../../domain/shared/result.js";
import type { Login, LoginDependencies, LoginError } from "./login.types.js";

/**
 * Verifies an email/password pair and issues an access token.
 *
 * The account is loaded by email (the address is normalised by the customer
 * domain on registration), then the credential is verified. When either lookup
 * misses, the hasher is still asked to verify against nothing, which spends
 * the same work as a real comparison.
 */
export function loginUseCase({
  customers,
  accounts,
  hasher,
  tokens,
}: LoginDependencies): Login {
  return async ({ email, password }) => {
    let customer: Awaited<ReturnType<typeof customers.findByEmail>>;
    let account: Awaited<ReturnType<typeof accounts.findByCustomerId>>;

    try {
      customer = await customers.findByEmail(email);
      account =
        customer === null ? null : await accounts.findByCustomerId(customer.id);
    } catch {
      return err<LoginError>({
        type: "repository_error",
        message: "Could not load the account",
      });
    }

    const matches = await hasher.verify(
      password,
      account?.passwordHash ?? null,
    );

    if (customer === null || account === null || !matches) {
      return err<LoginError>({
        type: "invalid_credentials",
        message: "Email or password is incorrect",
      });
    }

    return ok({
      customer,
      role: account.role,
      accessToken: await tokens.issue({
        customerId: customer.id,
        email: customer.email,
        role: account.role,
      }),
    });
  };
}
