import type { Cart } from "../../../domain/cart/cart.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { ProductId } from "../../../domain/product/product-id.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { IdGenerator } from "../../ports/id-generator.js";
import type { CartRepository } from "../../ports/repositories/cart-repository.js";
import type { InventoryRepository } from "../../ports/repositories/inventory-repository.js";
import type { ProductRepository } from "../../ports/repositories/product-repository.js";

export type AddItemInput = {
  customerId: CustomerId;
  productId: ProductId;
  quantity: number;
};

export type AddItemError =
  | {
      type: "product_not_found";
      message: string;
    }
  | {
      type: "inventory_not_found";
      message: string;
    }
  | {
      type: "insufficient_stock";
      message: string;
    }
  | {
      type: "invalid_cart_quantity";
      message: string;
    }
  | {
      type: "cart_currency_mismatch";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type AddItemDependencies = {
  carts: CartRepository;
  products: ProductRepository;
  inventory: InventoryRepository;
  ids: IdGenerator;
  clock: Clock;
};

export type AddItem = (
  input: AddItemInput,
) => Promise<Result<Cart, AddItemError>>;
