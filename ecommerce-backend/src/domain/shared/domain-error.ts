/**
 * Shape of an expected domain failure. Each module narrows it with a
 * discriminated union of literal `type` values, so callers switch safely and
 * no layer has to throw or inspect exception classes.
 */
export type DomainError<TType extends string = string> = {
  type: TType;
  message: string;
};
