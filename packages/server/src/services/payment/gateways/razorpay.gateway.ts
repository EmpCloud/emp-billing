import Razorpay from "razorpay";
import crypto from "crypto";
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

interface RazorpayGatewayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string;
  method?: string;
  email?: string;
}

interface RazorpayRefundEntity {
  id: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
}

export class RazorpayGateway implements IPaymentGateway {
  readonly name = "razorpay";
  readonly displayName = "Razorpay";

  private razorpay: Razorpay;
  private keySecret: string;
  private webhookSecret: string;

  constructor(config: RazorpayGatewayConfig) {
    this.razorpay = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    logger.info("Razorpay payment gateway initialized");
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = (await this.razorpay.orders.create({
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      receipt: input.invoiceNumber,
      notes: {
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        ...(input.metadata || {}),
      },
    })) as unknown as RazorpayOrder;

    logger.info(`Razorpay order created: ${order.id} for invoice ${input.invoiceNumber}`);

    return {
      gatewayOrderId: order.id,
      // No checkoutUrl — Razorpay uses client-side SDK for checkout UI
      metadata: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const expectedSignature = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
      .digest("hex");

    const verified = expectedSignature === input.gatewaySignature;

    logger.info(
      `Razorpay payment verification for order ${input.gatewayOrderId}: ` +
        `verified=${verified}, paymentId=${input.gatewayPaymentId}`
    );

    if (!verified) {
      return {
        verified: false,
        gatewayTransactionId: input.gatewayPaymentId,
        amount: 0,
        currency: "",
        status: "failed",
        metadata: {
          reason: "Signature verification failed",
        },
      };
    }

    // Fetch payment details from Razorpay to get amount and currency
    const payment = (await this.razorpay.payments.fetch(
      input.gatewayPaymentId
    )) as unknown as RazorpayPaymentEntity;

    return {
      verified: true,
      gatewayTransactionId: input.gatewayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: "success",
      metadata: {
        method: payment.method,
        email: payment.email,
        orderId: input.gatewayOrderId,
      },
    };
  }

  async chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult> {
    try {
      // Razorpay recurring charges use the Subscriptions API or the
      // Payment Links / Emandate flow. For saved tokens we create a
      // recurring payment via the payments.createRecurringPayment endpoint.
      const paymentData = {
        email: input.metadata?.clientEmail || "customer@example.com",
        contact: input.metadata?.clientPhone || "",
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        order_id: undefined as string | undefined,
        token: input.paymentMethodId,
        recurring: "1",
        description: input.description || `Payment for invoice ${input.invoiceNumber}`,
        notes: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          ...(input.metadata || {}),
        },
      };

      // First create an order, then charge against it with the saved token
      const order = (await this.razorpay.orders.create({
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        receipt: input.invoiceNumber,
        notes: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          ...(input.metadata || {}),
        },
      })) as unknown as RazorpayOrder;

      paymentData.order_id = order.id;

      const payment = (await (this.razorpay.payments as Record<string, Function>)
        .createRecurringPayment(paymentData)) as unknown as RazorpayPaymentEntity;

      const success = payment.status === "captured";

      logger.info(
        `Razorpay chargeCustomer for invoice ${input.invoiceNumber}: ` +
          `status=${payment.status}, paymentId=${payment.id}`
      );

      return {
        success,
        gatewayTransactionId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        error: success ? undefined : `Payment status: ${payment.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Razorpay charge failed";
      logger.error("Razorpay chargeCustomer failed", { error: message, invoiceId: input.invoiceId });
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
      const refund = (await (this.razorpay.payments as Record<string, Function>).refund(
        input.gatewayTransactionId,
        {
          amount: input.amount,
          notes: {
            reason: input.reason || "Refund requested",
          },
        }
      )) as unknown as RazorpayRefundEntity;

      logger.info(
        `Razorpay refund created: ${refund.id}, amount=${input.amount}, ` +
          `status=${refund.status}`
      );

      const statusMap: Record<string, "success" | "pending" | "failed"> = {
        processed: "success",
        pending: "pending",
        failed: "failed",
      };

      return {
        gatewayRefundId: refund.id,
        amount: refund.amount,
        status: statusMap[refund.status] || "pending",
      };
    } catch (error) {
      logger.error("Razorpay refund failed", error);
      return {
        gatewayRefundId: "",
        amount: input.amount,
        status: "failed",
      };
    }
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload.rawBody)
      .digest("hex");

    const receivedSignature = payload.headers["x-razorpay-signature"];

    if (expectedSignature !== receivedSignature) {
      logger.warn("Razorpay webhook signature verification failed");
      throw new Error("Invalid webhook signature");
    }

    const body = payload.body as RazorpayWebhookBody;
    const event = body.event;

    logger.info(`Razorpay webhook received: ${event}`);

    switch (event) {
      case "payment.captured": {
        const payment = body.payload.payment!.entity;
        return {
          event: "payment.completed",
          gatewayTransactionId: payment.id,
          gatewayOrderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: "success",
          metadata: {
            method: payment.method,
            email: payment.email,
          },
        };
      }

      case "payment.failed": {
        const payment = body.payload.payment!.entity;
        return {
          event: "payment.failed",
          gatewayTransactionId: payment.id,
          gatewayOrderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          status: "failed",
          metadata: {
            method: payment.method,
            email: payment.email,
          },
        };
      }

      case "refund.created": {
        const refund = body.payload.refund!.entity;
        return {
          event: "payment.refunded",
          gatewayTransactionId: refund.payment_id,
          amount: refund.amount,
          currency: refund.currency,
          status: "refunded",
          metadata: {
            refundId: refund.id,
            refundStatus: refund.status,
          },
        };
      }

      default:
        logger.warn(`Unhandled Razorpay webhook event: ${event}`);
        return {
          event,
          gatewayTransactionId: "",
          amount: 0,
          currency: "",
          status: "pending",
          metadata: { raw: body },
        };
    }
  }
}
