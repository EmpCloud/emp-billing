import { EventEmitter } from "events";

// ============================================================================
// TYPED EVENT SYSTEM
// ============================================================================

// ── Event payload types ─────────────────────────────────────────────────────

export interface InvoiceEventPayload {
  orgId: string;
  invoiceId: string;
  invoice: Record<string, unknown>;
}

export interface InvoiceSentPayload extends InvoiceEventPayload {
  clientEmail: string;
}

export interface PaymentReceivedPayload {
  orgId: string;
  paymentId: string;
  payment: Record<string, unknown>;
  invoiceId?: string;
  invoice?: Record<string, unknown>;
  client?: Record<string, unknown>;
}

export interface QuoteEventPayload {
  orgId: string;
  quoteId: string;
  quote: Record<string, unknown>;
}

export interface ClientEventPayload {
  orgId: string;
  clientId: string;
  client: Record<string, unknown>;
}

export interface ExpenseEventPayload {
  orgId: string;
  expenseId: string;
  expense: Record<string, unknown>;
}

export interface SubscriptionEventPayload {
  orgId: string;
  subscriptionId: string;
  subscription: Record<string, unknown>;
  planId?: string;
  clientId?: string;
}

export interface SubscriptionPlanChangePayload extends SubscriptionEventPayload {
  oldPlanId: string;
  newPlanId: string;
}

export interface PaymentFailedPayload {
  orgId: string;
  invoiceId: string;
  subscriptionId?: string;
  error: string;
  attemptNumber: number;
}

export interface CouponRedeemedPayload {
  orgId: string;
  couponId: string;
  clientId: string;
  invoiceId?: string;
  subscriptionId?: string;
  discountAmount: number;
}

// ── Event map ───────────────────────────────────────────────────────────────

export interface BillingEventMap {
  "invoice.created": InvoiceEventPayload;
  "invoice.sent": InvoiceSentPayload;
  "invoice.paid": InvoiceEventPayload;
  "invoice.overdue": InvoiceEventPayload;
  "payment.received": PaymentReceivedPayload;
  "quote.created": QuoteEventPayload;
  "quote.accepted": QuoteEventPayload;
  "quote.declined": QuoteEventPayload;
  "client.created": ClientEventPayload;
  "expense.created": ExpenseEventPayload;
  "subscription.created": SubscriptionEventPayload;
  "subscription.activated": SubscriptionEventPayload;
  "subscription.trial_ending": SubscriptionEventPayload;
  "subscription.renewed": SubscriptionEventPayload;
  "subscription.upgraded": SubscriptionPlanChangePayload;
  "subscription.downgraded": SubscriptionPlanChangePayload;
  "subscription.paused": SubscriptionEventPayload;
  "subscription.resumed": SubscriptionEventPayload;
  "subscription.cancelled": SubscriptionEventPayload;
  "subscription.expired": SubscriptionEventPayload;
  "payment.failed": PaymentFailedPayload;
  "subscription.payment_failed": PaymentFailedPayload;
  "coupon.redeemed": CouponRedeemedPayload;
}

export type BillingEvent = keyof BillingEventMap;

// ── Emitter ─────────────────────────────────────────────────────────────────

const emitter = new EventEmitter();

export function emit<E extends BillingEvent>(
  event: E,
  payload: BillingEventMap[E],
): void {
  emitter.emit(event, payload);
}

export function on<E extends BillingEvent>(
  event: E,
  handler: (payload: BillingEventMap[E]) => void,
): void {
  emitter.on(event, handler as (...args: unknown[]) => void);
}

export { emitter };
