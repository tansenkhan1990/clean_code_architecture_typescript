import type { Money } from "../../domain/product/money.js";
import type { Result } from "../../domain/shared/result.js";

export type PaymentGatewayRequest = {
  orderId: string;
  customerId: string;
  amount: Money;
  /**
   * Sent to the provider so a retry of the same charge returns the original
   * result instead of moving money again. Every real processor supports this.
   */
  idempotencyKey: string;
};

/**
 * The two ways a charge can legitimately fail. A decline is a business
 * outcome the customer can act on; an outage is an infrastructure problem.
 */
export type PaymentGatewayFailure =
  | {
      type: "payment_declined";
      message: string;
    }
  | {
      type: "payment_gateway_unavailable";
      message: string;
    };

export type ChargeResult = Result<
  { providerReference: string },
  PaymentGatewayFailure
>;

/** A processor (Stripe, Adyen, ...) that can take money for an order. */
export type PaymentGateway = {
  charge(request: PaymentGatewayRequest): Promise<ChargeResult>;
};
