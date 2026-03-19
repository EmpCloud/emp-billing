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

// ============================================================================
// PAYPAL PAYMENT GATEWAY
// Uses PayPal REST API v2 (Orders API) with OAuth2 client credentials flow.
// Supports sandbox and live modes via config.
// ============================================================================

interface PayPalGatewayConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;       // PayPal webhook ID for signature verification
  sandbox?: boolean;       // defaults to true
}

interface PayPalAccessToken {
  token: string;
  expiresAt: number;       // Unix timestamp (ms)
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string; method: string }>;
  purchase_units?: Array<{
    reference_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
    custom_id?: string;
  }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id?: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
}

interface PayPalRefundResponse {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
}

export class PayPalGateway implements IPaymentGateway {
  readonly name = "paypal";
  readonly displayName = "PayPal";

  private clientId: string;
  private clientSecret: string;
  private webhookId: string;
  private baseUrl: string;
  private cachedToken: PayPalAccessToken | null = null;

  constructor(config: PayPalGatewayConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.webhookId = config.webhookId;
    const sandbox = config.sandbox !== false; // default to sandbox
    this.baseUrl = sandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
    logger.info(`PayPal payment gateway initialized (${sandbox ? "sandbox" : "live"})`);
  }

  // ── OAuth2 Access Token ──────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("PayPal OAuth2 token request failed", { status: response.status, body: errorBody });
      throw new Error(`PayPal OAuth2 token request failed: ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };

    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.cachedToken.token;
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────

  private async paypalRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`PayPal API error: ${method} ${path}`, { status: response.status, body: errorBody });
      throw new Error(`PayPal API error (${response.status}): ${errorBody}`);
    }

    // Some endpoints (204) return no body
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // ── Utility: convert smallest-unit integer to PayPal decimal string ──────

  private toDecimal(amount: number, currency: string): string {
    // PayPal expects amounts as decimal strings (e.g. "10.50").
    // Zero-decimal currencies (JPY, KRW, etc.) should not be divided.
    const zeroDecimalCurrencies = new Set([
      "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
      "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
    ]);

    if (zeroDecimalCurrencies.has(currency.toUpperCase())) {
      return amount.toString();
    }

    return (amount / 100).toFixed(2);
  }

  private fromDecimal(value: string, currency: string): number {
    const zeroDecimalCurrencies = new Set([
      "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
      "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
    ]);

    if (zeroDecimalCurrencies.has(currency.toUpperCase())) {
      return parseInt(value, 10);
    }

    return Math.round(parseFloat(value) * 100);
  }

  // ── Interface Implementation ─────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = await this.paypalRequest<PayPalOrderResponse>("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.invoiceId,
          custom_id: input.invoiceId,
          description: input.description || `Invoice ${input.invoiceNumber}`,
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: this.toDecimal(input.amount, input.currency),
          },
          invoice_id: input.invoiceNumber,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "EMP Billing",
            return_url: input.metadata?.successUrl || "",
            cancel_url: input.metadata?.cancelUrl || "",
            user_action: "PAY_NOW",
            landing_page: "LOGIN",
          },
        },
      },
    });

    const approveLink = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");

    logger.info(`PayPal order created: ${order.id} for invoice ${input.invoiceNumber}`);

    return {
      gatewayOrderId: order.id,
      checkoutUrl: approveLink?.href,
      clientSecret: undefined,
      metadata: {
        orderId: order.id,
        status: order.status,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    // After buyer approves, capture the order to complete the payment
    const capture = await this.paypalRequest<PayPalCaptureResponse>(
      "POST",
      `/v2/checkout/orders/${input.gatewayOrderId}/capture`
    );

    const captureUnit = capture.purchase_units[0];
    const captureDetail = captureUnit?.payments?.captures?.[0];

    const verified = capture.status === "COMPLETED" && captureDetail?.status === "COMPLETED";
    const transactionId = captureDetail?.id ?? input.gatewayPaymentId;
    const amount = captureDetail
      ? this.fromDecimal(captureDetail.amount.value, captureDetail.amount.currency_code)
      : 0;
    const currency = captureDetail?.amount?.currency_code?.toUpperCase() ?? "";

    logger.info(
      `PayPal payment verification for order ${input.gatewayOrderId}: ` +
        `verified=${verified}, capture=${transactionId}`
    );

    return {
      verified,
      gatewayTransactionId: transactionId,
      amount,
      currency,
      status: verified ? "success" : "pending",
      metadata: {
        orderStatus: capture.status,
        captureStatus: captureDetail?.status,
      },
    };
  }

  async chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult> {
    // PayPal uses Billing Agreements / vault tokens for recurring charges.
    // The paymentMethodId here is a PayPal vault payment token.
    try {
      const order = await this.paypalRequest<PayPalOrderResponse>("POST", "/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.invoiceId,
            custom_id: input.invoiceId,
            description: input.description || `Payment for invoice ${input.invoiceNumber}`,
            amount: {
              currency_code: input.currency.toUpperCase(),
              value: this.toDecimal(input.amount, input.currency),
            },
            invoice_id: input.invoiceNumber,
          },
        ],
        payment_source: {
          token: {
            id: input.paymentMethodId,
            type: "PAYMENT_METHOD_TOKEN",
          },
        },
      });

      // For vaulted payment methods, PayPal can auto-capture
      const captureDetail = order.purchase_units?.[0]?.payments?.captures?.[0];
      const success = order.status === "COMPLETED" && !!captureDetail;
      const transactionId = captureDetail?.id ?? order.id;

      logger.info(
        `PayPal chargeCustomer for invoice ${input.invoiceNumber}: ` +
          `status=${order.status}, order=${order.id}`
      );

      return {
        success,
        gatewayTransactionId: transactionId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        error: success ? undefined : `PayPal order status: ${order.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "PayPal charge failed";
      logger.error("PayPal chargeCustomer failed", { error: message, invoiceId: input.invoiceId });
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
    // gatewayTransactionId is the PayPal capture ID
    try {
      // Fetch capture details to get the currency for the refund amount
      const capture = await this.paypalRequest<{
        id: string;
        amount: { currency_code: string; value: string };
      }>("GET", `/v2/payments/captures/${input.gatewayTransactionId}`);

      const currency = capture.amount.currency_code;

      const refund = await this.paypalRequest<PayPalRefundResponse>(
        "POST",
        `/v2/payments/captures/${input.gatewayTransactionId}/refund`,
        {
          amount: {
            currency_code: currency,
            value: this.toDecimal(input.amount, currency),
          },
          note_to_payer: input.reason || undefined,
        }
      );

      logger.info(
        `PayPal refund created: ${refund.id}, amount=${input.amount}, ` +
          `status=${refund.status}`
      );

      return {
        gatewayRefundId: refund.id,
        amount: this.fromDecimal(refund.amount.value, refund.amount.currency_code),
        status: refund.status === "COMPLETED" ? "success" : "pending",
      };
    } catch (error) {
      logger.error("PayPal refund failed", error);
      return {
        gatewayRefundId: "",
        amount: input.amount,
        status: "failed",
      };
    }
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    // Verify webhook signature by calling PayPal's verification API
    await this.verifyWebhookSignature(payload);

    const body = payload.body as {
      event_type: string;
      resource: Record<string, unknown>;
    };

    const eventType = body.event_type;
    logger.info(`PayPal webhook received: ${eventType}`);

    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED": {
        const resource = body.resource as {
          id: string;
          purchase_units: Array<{
            amount: { currency_code: string; value: string };
            custom_id?: string;
            invoice_id?: string;
          }>;
        };
        const unit = resource.purchase_units?.[0];
        const currency = unit?.amount?.currency_code ?? "";
        return {
          event: "payment.pending",
          gatewayTransactionId: "",
          gatewayOrderId: resource.id,
          amount: unit ? this.fromDecimal(unit.amount.value, currency) : 0,
          currency: currency.toUpperCase(),
          status: "pending",
          metadata: {
            invoiceId: unit?.custom_id,
            invoiceNumber: unit?.invoice_id,
          },
        };
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        const resource = body.resource as {
          id: string;
          amount: { currency_code: string; value: string };
          supplementary_data?: {
            related_ids?: { order_id?: string };
          };
          custom_id?: string;
          invoice_id?: string;
        };
        const currency = resource.amount.currency_code;
        return {
          event: "payment.completed",
          gatewayTransactionId: resource.id,
          gatewayOrderId: resource.supplementary_data?.related_ids?.order_id,
          amount: this.fromDecimal(resource.amount.value, currency),
          currency: currency.toUpperCase(),
          status: "success",
          metadata: {
            invoiceId: resource.custom_id,
            invoiceNumber: resource.invoice_id,
          },
        };
      }

      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED": {
        const resource = body.resource as {
          id: string;
          amount: { currency_code: string; value: string };
          supplementary_data?: {
            related_ids?: { order_id?: string };
          };
          custom_id?: string;
        };
        const currency = resource.amount.currency_code;
        return {
          event: "payment.failed",
          gatewayTransactionId: resource.id,
          gatewayOrderId: resource.supplementary_data?.related_ids?.order_id,
          amount: this.fromDecimal(resource.amount.value, currency),
          currency: currency.toUpperCase(),
          status: "failed",
          metadata: {
            invoiceId: resource.custom_id,
          },
        };
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        const resource = body.resource as {
          id: string;
          amount: { currency_code: string; value: string };
          custom_id?: string;
        };
        const currency = resource.amount.currency_code;
        return {
          event: "payment.refunded",
          gatewayTransactionId: resource.id,
          amount: this.fromDecimal(resource.amount.value, currency),
          currency: currency.toUpperCase(),
          status: "refunded",
          metadata: {
            invoiceId: resource.custom_id,
          },
        };
      }

      default:
        logger.warn(`Unhandled PayPal webhook event: ${eventType}`);
        return {
          event: eventType,
          gatewayTransactionId: "",
          amount: 0,
          currency: "",
          status: "pending",
          metadata: { raw: body.resource },
        };
    }
  }

  // ── Webhook Signature Verification ───────────────────────────────────────

  private async verifyWebhookSignature(payload: WebhookPayload): Promise<void> {
    const verificationBody = {
      auth_algo: payload.headers["paypal-auth-algo"],
      cert_url: payload.headers["paypal-cert-url"],
      transmission_id: payload.headers["paypal-transmission-id"],
      transmission_sig: payload.headers["paypal-transmission-sig"],
      transmission_time: payload.headers["paypal-transmission-time"],
      webhook_id: this.webhookId,
      webhook_event: payload.body,
    };

    const result = await this.paypalRequest<{ verification_status: string }>(
      "POST",
      "/v1/notifications/verify-webhook-signature",
      verificationBody
    );

    if (result.verification_status !== "SUCCESS") {
      logger.error("PayPal webhook signature verification failed", {
        status: result.verification_status,
      });
      throw new Error("PayPal webhook signature verification failed");
    }
  }
}
