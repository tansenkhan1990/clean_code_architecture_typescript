import type { Product } from "../../../domain/product/product.js";
import type { ProductId } from "../../../domain/product/product-id.js";

export type ProductRepository = {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findAll(): Promise<Product[]>;
};
