import type { Product } from "../../../domain/product/product.js";
import type { Result } from "../../../domain/shared/result.js";
import type { ProductRepository } from "../../ports/repositories/product-repository.js";

export type ListProductsError = {
  type: "repository_error";
  message: string;
};

export type ListProductsDependencies = {
  products: ProductRepository;
};

export type ListProducts = () => Promise<Result<Product[], ListProductsError>>;
