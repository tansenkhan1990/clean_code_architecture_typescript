export type CartDomainError =
  | {
      type: "invalid_cart_quantity";
      message: string;
    }
  | {
      type: "item_not_in_cart";
      message: string;
    }
  | {
      type: "cart_currency_mismatch";
      message: string;
    };
