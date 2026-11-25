import type { Product } from "../../../domain/product/product.js";
import type { ProductId } from "../../../domain/product/product-id.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Cache } from "../../ports/cache.js";
import type { ProductRepository } from "../../ports/repositories/product-repository.js";

export type GetProductInput = {
  id: ProductId;
};

export type GetProductError =
  | {
      type: "product_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type GetProductDependencies = {
  products: ProductRepository;
  cache: Cache;
};

export type GetProduct = (
  input: GetProductInput,
) => Promise<Result<Product, GetProductError>>;
