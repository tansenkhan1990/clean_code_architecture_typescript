export type ProductDomainError =
  | {
      type: "invalid_product_name";
      message: string;
    }
  | {
      type: "invalid_amount";
      message: string;
    }
  | {
      type: "invalid_currency";
      message: string;
    }
  | {
      type: "currency_mismatch";
      message: string;
    };
