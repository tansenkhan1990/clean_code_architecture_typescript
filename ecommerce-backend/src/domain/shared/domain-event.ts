/**
 * Something that already happened in the business and that the outside world
 * may care about. The domain describes events; it never publishes them.
 */
export type DomainEvent<
  TName extends string = string,
  TPayload = Record<string, unknown>,
> = {
  name: TName;
  occurredAt: string;
  payload: TPayload;
};
