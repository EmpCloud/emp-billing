import { logger } from "../../../utils/logger";
import { config } from "../../../config";
import type { IPaymentGateway } from "./IPaymentGateway";
import { StripeGateway } from "./stripe.gateway";
import { RazorpayGateway } from "./razorpay.gateway";
import { PayPalGateway } from "./paypal.gateway";

// ── Gateway Registry ────────────────────────────────────────────────────────

const gateways = new Map<string, IPaymentGateway>();

/**
 * Register a payment gateway in the registry.
 * Overwrites any existing gateway with the same name.
 */
export function registerGateway(gateway: IPaymentGateway): void {
  gateways.set(gateway.name, gateway);
  logger.info(`Payment gateway registered: ${gateway.displayName} (${gateway.name})`);
}

/**
 * Retrieve a registered payment gateway by name.
 * @throws Error if the gateway is not registered.
 */
export function getGateway(name: string): IPaymentGateway {
  const gateway = gateways.get(name);
  if (!gateway) {
    throw new Error(
      `Payment gateway "${name}" is not registered. ` +
        `Available gateways: ${[...gateways.keys()].join(", ") || "(none)"}`
    );
  }
  return gateway;
}

/**
 * List all registered payment gateways.
 */
export function listGateways(): IPaymentGateway[] {
  return [...gateways.values()];
}

/**
 * Read environment configuration and initialize all configured gateways.
 * Call this once at application startup.
 */
export function initializeGateways(): void {
  const configured: string[] = [];

  // Stripe
  if (config.gateways.stripe.secretKey) {
    const stripe = new StripeGateway({
      secretKey: config.gateways.stripe.secretKey,
      webhookSecret: config.gateways.stripe.webhookSecret,
    });
    registerGateway(stripe);
    configured.push("Stripe");
  }

  // Razorpay
  if (config.gateways.razorpay.keyId) {
    const razorpay = new RazorpayGateway({
      keyId: config.gateways.razorpay.keyId,
      keySecret: config.gateways.razorpay.keySecret,
      webhookSecret: config.gateways.razorpay.webhookSecret,
    });
    registerGateway(razorpay);
    configured.push("Razorpay");
  }

  // PayPal
  if (config.gateways.paypal.clientId) {
    const paypal = new PayPalGateway({
      clientId: config.gateways.paypal.clientId,
      clientSecret: config.gateways.paypal.clientSecret,
      webhookId: config.gateways.paypal.webhookId,
      sandbox: config.gateways.paypal.sandbox,
    });
    registerGateway(paypal);
    configured.push("PayPal");
  }

  if (configured.length === 0) {
    logger.warn("No payment gateways configured. Set STRIPE_SECRET_KEY, RAZORPAY_KEY_ID, or PAYPAL_CLIENT_ID in env.");
  } else {
    logger.info(`Payment gateways initialized: ${configured.join(", ")}`);
  }
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export type {
  IPaymentGateway,
  CreateOrderInput,
  CreateOrderResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  ChargeCustomerInput,
  ChargeCustomerResult,
  RefundInput,
  RefundResult,
  WebhookPayload,
  WebhookResult,
} from "./IPaymentGateway";

export { StripeGateway } from "./stripe.gateway";
export { RazorpayGateway } from "./razorpay.gateway";
export { PayPalGateway } from "./paypal.gateway";
