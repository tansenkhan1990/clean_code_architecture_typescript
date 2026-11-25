import { err, ok, type Result } from "../shared/result.js";
import type { ProductDomainError } from "./product-errors.js";

/**
 * Money as integer minor units plus a currency code. Floats are never used for
 * prices: 19.99 is stored as 1999, so totals cannot drift.
 */
export type Money = {
  amountInMinorUnits: number;
  currency: string;
};

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function createMoney(
  amountInMinorUnits: number,
  currency: string,
): Result<Money, ProductDomainError> {
  const normalizedCurrency = currency.trim().toUpperCase();

  if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits < 0) {
    return err({
      type: "invalid_amount",
      message: "Amount must be a non-negative integer in minor units",
    });
  }

  if (!CURRENCY_PATTERN.test(normalizedCurrency)) {
    return err({
      type: "invalid_currency",
      message: "Currency must be a three-letter ISO code",
    });
  }

  return ok({
    amountInMinorUnits,
    currency: normalizedCurrency,
  });
}

/** Adds two amounts, refusing to mix currencies silently. */
export function addMoney(
  left: Money,
  right: Money,
): Result<Money, ProductDomainError> {
  if (left.currency !== right.currency) {
    return err({
      type: "currency_mismatch",
      message: `Cannot combine ${left.currency} with ${right.currency}`,
    });
  }

  return createMoney(
    left.amountInMinorUnits + right.amountInMinorUnits,
    left.currency,
  );
}

/** Multiplies an amount by a whole quantity; the caller has bounded quantity. */
export function multiplyMoney(money: Money, quantity: number): Money {
  return {
    amountInMinorUnits: money.amountInMinorUnits * quantity,
    currency: money.currency,
  };
}

export function formatMoney(money: Money): string {
  return `${(money.amountInMinorUnits / 100).toFixed(2)} ${money.currency}`;
}
