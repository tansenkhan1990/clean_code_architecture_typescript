import { createInventoryItem } from "../../../domain/inventory/inventory-item.js";
import { createMoney } from "../../../domain/product/money.js";
import {
  createProduct,
  type Product,
} from "../../../domain/product/product.js";
import { err, ok } from "../../../domain/shared/result.js";
import type {
  CreateProduct,
  CreateProductDependencies,
  CreateProductError,
} from "./create-product.types.js";

/**
 * A product without stock cannot be sold, so creating one also opens its
 * inventory record. Splitting them would allow a product that no cart can fill,
 * which is why both rows go in one transaction.
 */
export function createProductUseCase({
  products,
  inventory,
  ids,
  clock,
  unitOfWork,
}: CreateProductDependencies): CreateProduct {
  return async (input) =>
    unitOfWork.execute<Product, CreateProductError>(async () => {
      const now = clock.now();

      const price = createMoney(input.amountInMinorUnits, input.currency);

      if (!price.ok) {
        return err({
          type: "invalid_product",
          message: price.error.message,
        });
      }

      const product = createProduct({
        id: ids.nextId(),
        name: input.name,
        price: price.value,
        createdAt: now,
      });

      if (!product.ok) {
        return err({
          type: "invalid_product",
          message: product.error.message,
        });
      }

      const stock = createInventoryItem({
        id: ids.nextId(),
        productId: product.value.id,
        quantity: input.availableQuantity ?? 0,
        updatedAt: now,
      });

      if (!stock.ok) {
        return err({
          type: "invalid_inventory",
          message: stock.error.message,
        });
      }

      await products.save(product.value);
      await inventory.save(stock.value);

      return ok(product.value);
    });
}
