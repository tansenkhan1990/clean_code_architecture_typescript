export type PaymentDomainError =
  | {
      type: "invalid_payment_amount";
      message: string;
    }
  | {
      type: "payment_already_resolved";
      message: string;
    };
