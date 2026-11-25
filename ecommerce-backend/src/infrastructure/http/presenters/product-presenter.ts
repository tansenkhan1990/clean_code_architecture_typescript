import type { Product } from "../../../domain/product/product.js";

export type ProductResponse = {
  id: string;
  name: string;
  price: {
    amountInMinorUnits: number;
    currency: string;
  };
  createdAt: string;
};

export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    price: {
      amountInMinorUnits: product.price.amountInMinorUnits,
      currency: product.price.currency,
    },
    createdAt: product.createdAt,
  };
}
