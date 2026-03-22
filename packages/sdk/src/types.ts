// ============================================================================
// SDK Types
// Standalone type definitions so the SDK has zero runtime dependencies.
// These mirror the relevant types from @emp-billing/shared.
// ============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  VIEWED = "viewed",
  PARTIALLY_PAID = "partially_paid",
  PAID = "paid",
  OVERDUE = "overdue",
  VOID = "void",
  WRITTEN_OFF = "written_off",
}

export enum SubscriptionStatus {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAUSED = "paused",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum BillingInterval {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUAL = "semi_annual",
  ANNUAL = "annual",
  CUSTOM = "custom",
}

export enum PaymentMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  CHEQUE = "cheque",
  UPI = "upi",
  CARD = "card",
  GATEWAY_STRIPE = "gateway_stripe",
  GATEWAY_RAZORPAY = "gateway_razorpay",
  GATEWAY_PAYPAL = "gateway_paypal",
  OTHER = "other",
}

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
}

export enum PricingModel {
  FLAT = "flat",
  TIERED = "tiered",
  VOLUME = "volume",
  PER_SEAT = "per_seat",
  METERED = "metered",
}

export enum WebhookEvent {
  INVOICE_CREATED = "invoice.created",
  INVOICE_SENT = "invoice.sent",
  INVOICE_VIEWED = "invoice.viewed",
  INVOICE_PAID = "invoice.paid",
  INVOICE_OVERDUE = "invoice.overdue",
  PAYMENT_RECEIVED = "payment.received",
  PAYMENT_REFUNDED = "payment.refunded",
  QUOTE_CREATED = "quote.created",
  QUOTE_ACCEPTED = "quote.accepted",
  QUOTE_DECLINED = "quote.declined",
  CLIENT_CREATED = "client.created",
  EXPENSE_CREATED = "expense.created",
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_ACTIVATED = "subscription.activated",
  SUBSCRIPTION_TRIAL_ENDING = "subscription.trial_ending",
  SUBSCRIPTION_RENEWED = "subscription.renewed",
  SUBSCRIPTION_UPGRADED = "subscription.upgraded",
  SUBSCRIPTION_DOWNGRADED = "subscription.downgraded",
  SUBSCRIPTION_PAUSED = "subscription.paused",
  SUBSCRIPTION_RESUMED = "subscription.resumed",
  SUBSCRIPTION_CANCELLED = "subscription.cancelled",
  SUBSCRIPTION_EXPIRED = "subscription.expired",
  PAYMENT_FAILED = "payment.failed",
  SUBSCRIPTION_PAYMENT_FAILED = "subscription.payment_failed",
  COUPON_REDEEMED = "coupon.redeemed",
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface ClientContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

export interface Client {
  id: string;
  orgId: string;
  name: string;
  displayName: string;
  email: string;
  phone?: string;
  website?: string;
  taxId?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  contacts: ClientContact[];
  currency: string;
  paymentTerms: number;
  notes?: string;
  tags: string[];
  outstandingBalance: number;
  totalBilled: number;
  totalPaid: number;
  portalEnabled: boolean;
  portalEmail?: string;
  customFields?: Record<string, string>;
  paymentGateway?: string;
  paymentMethodId?: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientData {
  name: string;
  displayName?: string;
  email: string;
  phone?: string;
  website?: string;
  taxId?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  contacts?: Omit<ClientContact, "id">[];
  currency?: string;
  paymentTerms?: number;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, string>;
}

export interface AutoProvisionData {
  /** Unique external identifier from your system. */
  externalId: string;
  name: string;
  email: string;
  phone?: string;
  billingAddress?: Address;
  currency?: string;
  paymentTerms?: number;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface AutoProvisionResult {
  client: Client;
  /** True if the client was newly created, false if an existing match was found. */
  created: boolean;
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export interface TaxComponentDetail {
  name: string;
  rate: number;
  amount: number;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  name: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount: number;
  taxRateId?: string;
  taxRate: number;
  taxAmount: number;
  taxComponents?: TaxComponentDetail[];
  amount: number;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  clientId: string;
  invoiceNumber: string;
  referenceNumber?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  items: InvoiceItem[];
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  tdsRate?: number;
  tdsAmount: number;
  tdsSection?: string;
  notes?: string;
  terms?: string;
  attachments?: string[];
  customFields?: Record<string, string>;
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
  recurringProfileId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceItemData {
  productId?: string;
  name: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discountType?: DiscountType;
  discountValue?: number;
  taxRateId?: string;
}

export interface CreateInvoiceData {
  clientId: string;
  referenceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  items: CreateInvoiceItemData[];
  discountType?: DiscountType;
  discountValue?: number;
  notes?: string;
  terms?: string;
  customFields?: Record<string, string>;
}

export interface ListInvoicesParams extends ListParams {
  status?: InvoiceStatus;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  billingInterval: BillingInterval;
  billingIntervalDays?: number;
  trialPeriodDays: number;
  price: number;
  setupFee: number;
  currency: string;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanData {
  name: string;
  description?: string;
  billingInterval: BillingInterval;
  billingIntervalDays?: number;
  trialPeriodDays?: number;
  price: number;
  setupFee?: number;
  currency?: string;
  features?: string[];
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  orgId: string;
  clientId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialStart?: string;
  trialEnd?: string;
  cancelledAt?: string;
  cancelReason?: string;
  pauseStart?: string;
  resumeDate?: string;
  nextBillingDate: string;
  quantity: number;
  metadata?: Record<string, unknown>;
  couponId?: string;
  couponDiscountAmount?: number;
  autoRenew: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionData {
  clientId: string;
  planId: string;
  quantity?: number;
  couponCode?: string;
  metadata?: Record<string, unknown>;
  autoRenew?: boolean;
  /** ISO date string. If omitted, starts immediately. */
  startDate?: string;
}

export interface ListSubscriptionsParams extends ListParams {
  status?: SubscriptionStatus;
  clientId?: string;
  planId?: string;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface UsageRecord {
  id: string;
  orgId: string;
  subscriptionId?: string;
  productId: string;
  clientId: string;
  quantity: number;
  description?: string;
  recordedAt: string;
  periodStart: string;
  periodEnd: string;
  billed: boolean;
  invoiceId?: string;
  createdAt: string;
}

export interface ReportUsageData {
  subscriptionId?: string;
  productId: string;
  clientId: string;
  quantity: number;
  description?: string;
  /** ISO date string. Defaults to now. */
  recordedAt?: string;
  periodStart: string;
  periodEnd: string;
}

export interface GenerateUsageInvoiceData {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  subscriptionId?: string;
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export interface Payment {
  id: string;
  orgId: string;
  clientId: string;
  invoiceId?: string;
  paymentNumber: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  gatewayTransactionId?: string;
  notes?: string;
  isRefund: boolean;
  refundedAmount: number;
  receiptUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  lastDeliveredAt?: string;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookData {
  url: string;
  events: WebhookEvent[];
}

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface EmpBillingOptions {
  /** API key (starts with "empb_"). */
  apiKey: string;
  /** Base URL of the EMP Billing API. Defaults to "https://api.empcloud.com/billing/v1". */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30 seconds). */
  timeout?: number;
  /** Maximum number of automatic retries on 429/5xx errors. Defaults to 3. */
  maxRetries?: number;
}
