import type { Result } from "../../../domain/shared/result.js";
import type { PasswordHasher } from "../../ports/password-hasher.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CustomerRepository } from "../../ports/repositories/customer-repository.js";
import type { TokenService } from "../../ports/token-service.js";
import type { AuthenticatedSession } from "../session.js";

export type LoginInput = {
  email: string;
  password: string;
};

/**
 * One failure for every reason: unknown address, no credential record, and a
 * wrong password are indistinguishable to the caller, so login cannot be used
 * to discover which addresses are registered.
 */
export type LoginError =
  | {
      type: "invalid_credentials";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type LoginDependencies = {
  customers: CustomerRepository;
  accounts: AccountRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
};

export type Login = (
  input: LoginInput,
) => Promise<Result<AuthenticatedSession, LoginError>>;
