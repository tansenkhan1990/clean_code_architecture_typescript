import type { Product } from "../../../domain/product/product.js";
import { err, ok } from "../../../domain/shared/result.js";
import type {
  GetProduct,
  GetProductDependencies,
} from "./get-product.types.js";

export const PRODUCT_CACHE_TTL_SECONDS = 60;

const cacheKey = (id: string): string => `product:${id}`;

/**
 * Read-through: a hit shortens the path, a miss falls back to the repository,
 * and a cache failure is ignored. The cache can only ever make this slower, so
 * its errors are not treated as request failures.
 */
export function getProductUseCase({
  products,
  cache,
}: GetProductDependencies): GetProduct {
  return async ({ id }) => {
    try {
      const cached = await cache.get<Product>(cacheKey(id));

      if (cached !== null) {
        return ok(cached);
      }
    } catch {
      // Cache is an optimisation, not a source of truth.
    }

    let product: Product | null;

    try {
      product = await products.findById(id);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load product",
      });
    }

    if (product === null) {
      return err({
        type: "product_not_found",
        message: `Product ${id} was not found`,
      });
    }

    try {
      await cache.set(cacheKey(id), product, PRODUCT_CACHE_TTL_SECONDS);
    } catch {
      // Losing a cache write costs a future repository read, nothing more.
    }

    return ok(product);
  };
}
