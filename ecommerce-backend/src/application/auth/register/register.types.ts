import type { AuthDomainError } from "../../../domain/auth/auth-errors.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { OutboxRepository } from "../../ports/outbox.js";
import type { PasswordHasher } from "../../ports/password-hasher.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CustomerRepository } from "../../ports/repositories/customer-repository.js";
import type { TokenService } from "../../ports/token-service.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";
import type { AuthenticatedSession } from "../session.js";

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export type RegisterError =
  | AuthDomainError
  | {
      type: "invalid_customer";
      message: string;
    }
  | {
      type: "email_already_registered";
      message: string;
    }
  | UnitOfWorkError;

export type RegisterDependencies = {
  customers: CustomerRepository;
  accounts: AccountRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  ids: IdGenerator;
  clock: Clock;
  outbox: OutboxRepository;
  unitOfWork: UnitOfWork;
  /**
   * Addresses that receive `admin` on registration. This is how a fresh
   * deployment gets its first administrator; it is configuration, not input.
   */
  bootstrapAdminEmails: readonly string[];
};

export type Register = (
  input: RegisterInput,
) => Promise<Result<AuthenticatedSession, RegisterError>>;
