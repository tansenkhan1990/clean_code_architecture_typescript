import type { Order } from "../../../domain/order/order.js";

export type OrderItemResponse = {
  productId: string;
  quantity: number;
  unitPrice: {
    amountInMinorUnits: number;
    currency: string;
  };
  lineTotal: {
    amountInMinorUnits: number;
    currency: string;
  };
};

export type OrderResponse = {
  id: string;
  customerId: string;
  items: OrderItemResponse[];
  total: {
    amountInMinorUnits: number;
    currency: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
};

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    customerId: order.customerId,
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: {
        amountInMinorUnits: item.unitPrice.amountInMinorUnits,
        currency: item.unitPrice.currency,
      },
      lineTotal: {
        amountInMinorUnits: item.lineTotal.amountInMinorUnits,
        currency: item.lineTotal.currency,
      },
    })),
    total: {
      amountInMinorUnits: order.total.amountInMinorUnits,
      currency: order.total.currency,
    },
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
  };
}
