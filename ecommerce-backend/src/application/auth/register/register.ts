import {
  createAccount,
  validatePassword,
} from "../../../domain/auth/account.js";
import type { Role } from "../../../domain/auth/role.js";
import {
  createCustomer,
  type Customer,
} from "../../../domain/customer/customer.js";
import { customerRegistered } from "../../../domain/customer/customer-events.js";
import { err, ok } from "../../../domain/shared/result.js";
import { stageEvent } from "../../outbox/stage-event.js";
import type { AuthenticatedSession } from "../session.js";
import type {
  Register,
  RegisterDependencies,
  RegisterError,
} from "./register.types.js";

/**
 * Registration is the only way a customer comes into existence: the profile,
 * the credential, and the `customer.registered` event commit together. There is
 * no path that creates a customer who cannot log in.
 *
 * The password is hashed *before* the transaction opens: key derivation is
 * deliberately slow, and holding a serializable transaction open while the CPU
 * works would block other writers for no reason.
 */
export function registerUseCase({
  customers,
  accounts,
  hasher,
  tokens,
  ids,
  clock,
  outbox,
  unitOfWork,
  bootstrapAdminEmails,
}: RegisterDependencies): Register {
  return async (input) => {
    const password = validatePassword(input.password);

    if (!password.ok) {
      return err(password.error);
    }

    const passwordHash = await hasher.hash(password.value);

    const registered = await unitOfWork.execute<
      { customer: Customer; role: Role },
      RegisterError
    >(async () => {
      const now = clock.now();

      const customer = createCustomer({
        id: ids.nextId(),
        email: input.email,
        name: input.name,
        createdAt: now,
      });

      if (!customer.ok) {
        return err({
          type: "invalid_customer",
          message: customer.error.message,
        });
      }

      const existing = await customers.findByEmail(customer.value.email);

      if (existing !== null) {
        return err({
          type: "email_already_registered",
          message: "A customer with this email already exists",
        });
      }

      // Only an address listed by the operator can register as an
      // administrator; every other registration is a customer. Elevating an
      // existing account is a separate, auditable action (`npm run
      // admin:grant`).
      const role: Role = bootstrapAdminEmails.includes(customer.value.email)
        ? "admin"
        : "customer";

      const account = createAccount({
        customerId: customer.value.id,
        passwordHash,
        role,
        createdAt: now,
      });

      if (!account.ok) {
        return err(account.error);
      }

      await customers.save(customer.value);
      await accounts.save(account.value);
      await stageEvent(
        { outbox, ids, clock },
        customerRegistered(customer.value, now),
      );

      return ok({ customer: customer.value, role });
    });

    if (!registered.ok) {
      return registered;
    }

    // Issued only after the commit: a token for a rolled-back registration
    // would be a credential to an account that does not exist.
    const { customer, role } = registered.value;

    const session: AuthenticatedSession = {
      customer,
      role,
      accessToken: await tokens.issue({
        customerId: customer.id,
        email: customer.email,
        role,
      }),
    };

    return ok(session);
  };
}
