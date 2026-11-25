export type CustomerDomainError =
  | {
      type: "invalid_email";
      message: string;
    }
  | {
      type: "invalid_customer_name";
      message: string;
    };
