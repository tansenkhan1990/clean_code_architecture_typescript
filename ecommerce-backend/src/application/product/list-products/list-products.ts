import { err, ok } from "../../../domain/shared/result.js";
import type {
  ListProducts,
  ListProductsDependencies,
} from "./list-products.types.js";

export function listProductsUseCase({
  products,
}: ListProductsDependencies): ListProducts {
  return async () => {
    try {
      return ok(await products.findAll());
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load products",
      });
    }
  };
}
