/** Failures that can happen while assembling an order. */
export type OrderDomainError =
  | {
      type: "empty_order";
      message: string;
    }
  | {
      type: "invalid_order_item";
      message: string;
    };

/**
 * Failures of a state transition, kept separate from creation errors so a
 * caller handling `payOrder` never has to consider "an order has no items".
 */
export type OrderTransitionError =
  | {
      type: "order_already_paid";
      message: string;
    }
  | {
      type: "order_cancelled";
      message: string;
    };
