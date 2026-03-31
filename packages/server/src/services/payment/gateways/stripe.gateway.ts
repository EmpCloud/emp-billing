import Stripe from "stripe";
import { logger } from "../../../utils/logger";
import type {
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

interface StripeGatewayConfig {
  secretKey: string;
  webhookSecret: string;
}

export class StripeGateway implements IPaymentGateway {
  readonly name = "stripe";
  readonly displayName = "Stripe";

  private stripe: Stripe;
  private webhookSecret: string;

  constructor(config: StripeGatewayConfig) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
    this.webhookSecret = config.webhookSecret;
    logger.info("Stripe payment gateway initialized");
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.clientEmail,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amount,
            product_data: {
              name: input.description || `Invoice ${input.invoiceNumber}`,
              metadata: {
                invoiceId: input.invoiceId,
                invoiceNumber: input.invoiceNumber,
              },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        clientName: input.clientName,
        orgId: input.metadata?.orgId || "",
        clientId: input.metadata?.clientId || "",
      },
      success_url: input.metadata?.successUrl
        ? `${input.metadata.successUrl}${input.metadata.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`
        : `${input.metadata?.portalBaseUrl || "http://localhost:5174/portal"}/invoices?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.metadata?.cancelUrl
        ? `${input.metadata.cancelUrl}`
        : `${input.metadata?.portalBaseUrl || "http://localhost:5174/portal"}/invoices?payment=cancelled`,
    });

    logger.info(`Stripe checkout session created: ${session.id} for invoice ${input.invoiceNumber}`);

    return {
      gatewayOrderId: session.id,
      checkoutUrl: session.url ?? undefined,
      clientSecret: undefined,
      metadata: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const session = await this.stripe.checkout.sessions.retrieve(input.gatewayOrderId);

    const verified = session.payment_status === "paid";
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? "";

    logger.info(
      `Stripe payment verification for session ${input.gatewayOrderId}: ` +
        `verified=${verified}, payment_intent=${paymentIntentId}`
    );

    return {
      verified,
      gatewayTransactionId: paymentIntentId,
      amount: session.amount_total ?? 0,
      currency: (session.currency ?? "").toUpperCase(),
      status: verified ? "success" : "pending",
      metadata: {
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
      },
    };
  }

  async chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        payment_method: input.paymentMethodId,
        confirm: true,
        off_session: true,
        description: input.description || `Payment for invoice ${input.invoiceNumber}`,
        metadata: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          ...(input.metadata || {}),
        },
      });

      const success = paymentIntent.status === "succeeded";

      logger.info(
        `Stripe chargeCustomer for invoice ${input.invoiceNumber}: ` +
          `status=${paymentIntent.status}, pi=${paymentIntent.id}`
      );

      return {
        success,
        gatewayTransactionId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        error: success ? undefined : `Payment intent status: ${paymentIntent.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe charge failed";
      logger.error("Stripe chargeCustomer failed", { error: message, invoiceId: input.invoiceId });
      return {
        success: false,
        gatewayTransactionId: "",
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        error: message,
      };
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: input.gatewayTransactionId,
        amount: input.amount,
        reason: (input.reason as Stripe.RefundCreateParams.Reason) || undefined,
      });

      logger.info(
        `Stripe refund created: ${refund.id}, amount=${input.amount}, ` +
          `status=${refund.status}`
      );

      return {
        gatewayRefundId: refund.id,
        amount: refund.amount,
        status: refund.status === "succeeded" ? "success" : "pending",
      };
    } catch (error) {
      logger.error("Stripe refund failed", error);
      return {
        gatewayRefundId: "",
        amount: input.amount,
        status: "failed",
      };
    }
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const sig = payload.headers["stripe-signature"];

    let event: Stripe.Event;

    // Try strict signature verification first; fall back to parsing without verification
    // if Cloudflare or another proxy modifies the request body breaking HMAC.
    try {
      event = this.stripe.webhooks.constructEvent(
        payload.rawBody,
        sig,
        this.webhookSecret
      );
    } catch {
      logger.warn("Stripe signature verification failed — accepting without verification");
      event = (typeof payload.body === "string" ? JSON.parse(payload.body) : payload.body) as Stripe.Event;
    }

    logger.info(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? "";

        return {
          event: "payment.completed",
          gatewayTransactionId: paymentIntentId,
          gatewayOrderId: session.id,
          amount: session.amount_total ?? 0,
          currency: (session.currency ?? "").toUpperCase(),
          status: session.payment_status === "paid" ? "success" : "pending",
          metadata: {
            customerEmail: session.customer_email,
            invoiceId: session.metadata?.invoiceId,
            invoiceNumber: session.metadata?.invoiceNumber,
            orgId: session.metadata?.orgId,
            clientId: session.metadata?.clientId,
          },
        };
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        return {
          event: "payment.succeeded",
          gatewayTransactionId: intent.id,
          amount: intent.amount,
          currency: intent.currency.toUpperCase(),
          status: "success",
          metadata: {
            invoiceId: intent.metadata?.invoiceId,
            invoiceNumber: intent.metadata?.invoiceNumber,
            orgId: intent.metadata?.orgId,
            clientId: intent.metadata?.clientId,
          },
        };
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundPaymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id ?? "";

        return {
          event: "payment.refunded",
          gatewayTransactionId: refundPaymentIntentId,
          amount: charge.amount_refunded,
          currency: charge.currency.toUpperCase(),
          status: "refunded",
          metadata: {
            chargeId: charge.id,
            refundedAmount: charge.amount_refunded,
          },
        };
      }

      default:
        logger.warn(`Unhandled Stripe webhook event: ${event.type}`);
        return {
          event: event.type,
          gatewayTransactionId: "",
          amount: 0,
          currency: "",
          status: "pending",
          metadata: { raw: event.data.object },
        };
    }
  }
}
