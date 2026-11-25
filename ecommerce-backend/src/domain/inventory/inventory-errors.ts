export type InventoryDomainError =
  | {
      type: "invalid_quantity";
      message: string;
    }
  | {
      type: "insufficient_stock";
      message: string;
    };
