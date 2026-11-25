import { err, ok, type Result } from "../shared/result.js";
import type { Money } from "./money.js";
import type { ProductDomainError } from "./product-errors.js";
import type { ProductId } from "./product-id.js";

export const MAX_PRODUCT_NAME_LENGTH = 160;

/**
 * What the customer buys. Availability is not a product property: it is the
 * inventory aggregate's business, so nothing is duplicated here.
 */
export type Product = {
  id: ProductId;
  name: string;
  price: Money;
  createdAt: string;
};

/** A product must be named and priced above zero, or payment means nothing. */
export function createProduct(input: {
  id: ProductId;
  name: string;
  price: Money;
  createdAt: string;
}): Result<Product, ProductDomainError> {
  const name = input.name.trim();

  if (name.length === 0) {
    return err({
      type: "invalid_product_name",
      message: "Product name cannot be empty",
    });
  }

  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    return err({
      type: "invalid_product_name",
      message: `Product name cannot exceed ${MAX_PRODUCT_NAME_LENGTH} characters`,
    });
  }

  if (input.price.amountInMinorUnits <= 0) {
    return err({
      type: "invalid_amount",
      message: "Product price must be greater than zero",
    });
  }

  return ok({
    id: input.id,
    name,
    price: input.price,
    createdAt: input.createdAt,
  });
}
