import type { Product } from "../../../domain/product/product.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { InventoryRepository } from "../../ports/repositories/inventory-repository.js";
import type { ProductRepository } from "../../ports/repositories/product-repository.js";
import type { UnitOfWork, UnitOfWorkError } from "../../ports/unit-of-work.js";

export type CreateProductInput = {
  name: string;
  amountInMinorUnits: number;
  currency: string;
  /** Initial stock on hand. Defaults to zero, which means "not sellable yet". */
  availableQuantity?: number;
};

export type CreateProductError =
  | {
      type: "invalid_product";
      message: string;
    }
  | {
      type: "invalid_inventory";
      message: string;
    };

export type CreateProductDependencies = {
  products: ProductRepository;
  inventory: InventoryRepository;
  ids: IdGenerator;
  clock: Clock;
  unitOfWork: UnitOfWork;
};

export type CreateProduct = (
  input: CreateProductInput,
) => Promise<Result<Product, CreateProductError | UnitOfWorkError>>;
