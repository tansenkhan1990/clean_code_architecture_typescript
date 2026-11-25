import type { InventoryItem } from "../../../domain/inventory/inventory-item.js";
import type { ProductId } from "../../../domain/product/product-id.js";

/** Stock is looked up by product, because one product has one stock record. */
export type InventoryRepository = {
  save(item: InventoryItem): Promise<void>;
  findByProductId(productId: ProductId): Promise<InventoryItem | null>;
};
