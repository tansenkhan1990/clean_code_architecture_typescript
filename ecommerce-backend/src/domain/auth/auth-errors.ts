export type AuthDomainError =
  | {
      type: "invalid_password";
      message: string;
    }
  | {
      type: "invalid_role";
      message: string;
    };
