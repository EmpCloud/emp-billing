// ============================================================================
// PAYMENT GATEWAY INTERFACE
// Plugin-based architecture — implement this interface to add a new gateway.
// ============================================================================

export interface CreateOrderInput {
  amount: number;          // smallest unit (paise/cents)
  currency: string;        // ISO 4217 (INR, USD, etc.)
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string;
  clientName: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateOrderResult {
  gatewayOrderId: string;  // gateway's order/session ID
  checkoutUrl?: string;    // redirect URL for hosted checkout
  clientSecret?: string;   // for client-side confirmation (Stripe)
  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;  // for signature verification (Razorpay)
}

export interface VerifyPaymentResult {
  verified: boolean;
  gatewayTransactionId: string;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending";
  metadata?: Record<string, unknown>;
}

export interface RefundInput {
  gatewayTransactionId: string;
  amount: number;       // smallest unit
  reason?: string;
}

export interface RefundResult {
  gatewayRefundId: string;
  amount: number;
  status: "success" | "pending" | "failed";
}

export interface WebhookPayload {
  headers: Record<string, string>;
  body: unknown;
  rawBody: Buffer;
}

export interface WebhookResult {
  event: string;               // normalized event name
  gatewayTransactionId: string;
  gatewayOrderId?: string;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending" | "refunded";
  metadata?: Record<string, unknown>;
}

export interface ChargeCustomerInput {
  paymentMethodId: string;  // saved payment method token
  amount: number;           // smallest unit
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ChargeCustomerResult {
  success: boolean;
  gatewayTransactionId: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface IPaymentGateway {
  readonly name: string;           // "stripe" | "razorpay" | "paypal"
  readonly displayName: string;    // "Stripe" | "Razorpay" | "PayPal"

  /** Create an order/session on the gateway */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /** Verify a payment after redirect/callback */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  /** Charge a saved payment method directly (used for dunning retries / recurring) */
  chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult>;

  /** Issue a refund */
  refund(input: RefundInput): Promise<RefundResult>;

  /** Process an incoming webhook and return a normalized result */
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
}
