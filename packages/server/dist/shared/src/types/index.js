"use strict";
// ============================================================================
// EMP-BILLING SHARED TYPES
// Single source of truth for server and client.
// All monetary values are in smallest currency unit (paise/cents).
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DunningAttemptStatus = exports.ScheduledReportFrequency = exports.ScheduledReportType = exports.NotificationType = exports.WebhookEvent = exports.DisputeStatus = exports.CreditNoteStatus = exports.UserRole = exports.SubscriptionEventType = exports.SubscriptionStatus = exports.BillingInterval = exports.CouponAppliesTo = exports.CouponType = exports.PricingModel = exports.DiscountType = exports.TaxType = exports.RecurringStatus = exports.RecurringFrequency = exports.ExpenseStatus = exports.PaymentMethod = exports.QuoteStatus = exports.InvoiceStatus = void 0;
// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "draft";
    InvoiceStatus["SENT"] = "sent";
    InvoiceStatus["VIEWED"] = "viewed";
    InvoiceStatus["PARTIALLY_PAID"] = "partially_paid";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["VOID"] = "void";
    InvoiceStatus["WRITTEN_OFF"] = "written_off";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["DRAFT"] = "draft";
    QuoteStatus["SENT"] = "sent";
    QuoteStatus["VIEWED"] = "viewed";
    QuoteStatus["ACCEPTED"] = "accepted";
    QuoteStatus["DECLINED"] = "declined";
    QuoteStatus["EXPIRED"] = "expired";
    QuoteStatus["CONVERTED"] = "converted";
})(QuoteStatus || (exports.QuoteStatus = QuoteStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "cash";
    PaymentMethod["BANK_TRANSFER"] = "bank_transfer";
    PaymentMethod["CHEQUE"] = "cheque";
    PaymentMethod["UPI"] = "upi";
    PaymentMethod["CARD"] = "card";
    PaymentMethod["GATEWAY_STRIPE"] = "gateway_stripe";
    PaymentMethod["GATEWAY_RAZORPAY"] = "gateway_razorpay";
    PaymentMethod["GATEWAY_PAYPAL"] = "gateway_paypal";
    PaymentMethod["OTHER"] = "other";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["PENDING"] = "pending";
    ExpenseStatus["APPROVED"] = "approved";
    ExpenseStatus["REJECTED"] = "rejected";
    ExpenseStatus["BILLED"] = "billed";
    ExpenseStatus["PAID"] = "paid";
})(ExpenseStatus || (exports.ExpenseStatus = ExpenseStatus = {}));
var RecurringFrequency;
(function (RecurringFrequency) {
    RecurringFrequency["DAILY"] = "daily";
    RecurringFrequency["WEEKLY"] = "weekly";
    RecurringFrequency["MONTHLY"] = "monthly";
    RecurringFrequency["QUARTERLY"] = "quarterly";
    RecurringFrequency["HALF_YEARLY"] = "half_yearly";
    RecurringFrequency["YEARLY"] = "yearly";
    RecurringFrequency["CUSTOM"] = "custom";
})(RecurringFrequency || (exports.RecurringFrequency = RecurringFrequency = {}));
var RecurringStatus;
(function (RecurringStatus) {
    RecurringStatus["ACTIVE"] = "active";
    RecurringStatus["PAUSED"] = "paused";
    RecurringStatus["COMPLETED"] = "completed";
    RecurringStatus["CANCELLED"] = "cancelled";
})(RecurringStatus || (exports.RecurringStatus = RecurringStatus = {}));
var TaxType;
(function (TaxType) {
    TaxType["GST"] = "gst";
    TaxType["IGST"] = "igst";
    TaxType["VAT"] = "vat";
    TaxType["SALES_TAX"] = "sales_tax";
    TaxType["CUSTOM"] = "custom";
})(TaxType || (exports.TaxType = TaxType = {}));
var DiscountType;
(function (DiscountType) {
    DiscountType["PERCENTAGE"] = "percentage";
    DiscountType["FIXED"] = "fixed";
})(DiscountType || (exports.DiscountType = DiscountType = {}));
var PricingModel;
(function (PricingModel) {
    PricingModel["FLAT"] = "flat";
    PricingModel["TIERED"] = "tiered";
    PricingModel["VOLUME"] = "volume";
    PricingModel["PER_SEAT"] = "per_seat";
    PricingModel["METERED"] = "metered";
})(PricingModel || (exports.PricingModel = PricingModel = {}));
var CouponType;
(function (CouponType) {
    CouponType["PERCENTAGE"] = "percentage";
    CouponType["FIXED_AMOUNT"] = "fixed_amount";
})(CouponType || (exports.CouponType = CouponType = {}));
var CouponAppliesTo;
(function (CouponAppliesTo) {
    CouponAppliesTo["INVOICE"] = "invoice";
    CouponAppliesTo["SUBSCRIPTION"] = "subscription";
    CouponAppliesTo["PRODUCT"] = "product";
})(CouponAppliesTo || (exports.CouponAppliesTo = CouponAppliesTo = {}));
var BillingInterval;
(function (BillingInterval) {
    BillingInterval["MONTHLY"] = "monthly";
    BillingInterval["QUARTERLY"] = "quarterly";
    BillingInterval["SEMI_ANNUAL"] = "semi_annual";
    BillingInterval["ANNUAL"] = "annual";
    BillingInterval["CUSTOM"] = "custom";
})(BillingInterval || (exports.BillingInterval = BillingInterval = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIALING"] = "trialing";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["PAUSED"] = "paused";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["CANCELLED"] = "cancelled";
    SubscriptionStatus["EXPIRED"] = "expired";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var SubscriptionEventType;
(function (SubscriptionEventType) {
    SubscriptionEventType["CREATED"] = "created";
    SubscriptionEventType["ACTIVATED"] = "activated";
    SubscriptionEventType["TRIAL_STARTED"] = "trial_started";
    SubscriptionEventType["TRIAL_ENDED"] = "trial_ended";
    SubscriptionEventType["RENEWED"] = "renewed";
    SubscriptionEventType["UPGRADED"] = "upgraded";
    SubscriptionEventType["DOWNGRADED"] = "downgraded";
    SubscriptionEventType["PAUSED"] = "paused";
    SubscriptionEventType["RESUMED"] = "resumed";
    SubscriptionEventType["CANCELLED"] = "cancelled";
    SubscriptionEventType["EXPIRED"] = "expired";
    SubscriptionEventType["PAYMENT_FAILED"] = "payment_failed";
})(SubscriptionEventType || (exports.SubscriptionEventType = SubscriptionEventType = {}));
var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "owner";
    UserRole["ADMIN"] = "admin";
    UserRole["ACCOUNTANT"] = "accountant";
    UserRole["SALES"] = "sales";
    UserRole["VIEWER"] = "viewer";
})(UserRole || (exports.UserRole = UserRole = {}));
var CreditNoteStatus;
(function (CreditNoteStatus) {
    CreditNoteStatus["DRAFT"] = "draft";
    CreditNoteStatus["OPEN"] = "open";
    CreditNoteStatus["APPLIED"] = "applied";
    CreditNoteStatus["REFUNDED"] = "refunded";
    CreditNoteStatus["VOID"] = "void";
})(CreditNoteStatus || (exports.CreditNoteStatus = CreditNoteStatus = {}));
var DisputeStatus;
(function (DisputeStatus) {
    DisputeStatus["OPEN"] = "open";
    DisputeStatus["UNDER_REVIEW"] = "under_review";
    DisputeStatus["RESOLVED"] = "resolved";
    DisputeStatus["CLOSED"] = "closed";
})(DisputeStatus || (exports.DisputeStatus = DisputeStatus = {}));
var WebhookEvent;
(function (WebhookEvent) {
    WebhookEvent["INVOICE_CREATED"] = "invoice.created";
    WebhookEvent["INVOICE_SENT"] = "invoice.sent";
    WebhookEvent["INVOICE_VIEWED"] = "invoice.viewed";
    WebhookEvent["INVOICE_PAID"] = "invoice.paid";
    WebhookEvent["INVOICE_OVERDUE"] = "invoice.overdue";
    WebhookEvent["PAYMENT_RECEIVED"] = "payment.received";
    WebhookEvent["PAYMENT_REFUNDED"] = "payment.refunded";
    WebhookEvent["QUOTE_CREATED"] = "quote.created";
    WebhookEvent["QUOTE_ACCEPTED"] = "quote.accepted";
    WebhookEvent["QUOTE_DECLINED"] = "quote.declined";
    WebhookEvent["CLIENT_CREATED"] = "client.created";
    WebhookEvent["EXPENSE_CREATED"] = "expense.created";
    WebhookEvent["SUBSCRIPTION_CREATED"] = "subscription.created";
    WebhookEvent["SUBSCRIPTION_ACTIVATED"] = "subscription.activated";
    WebhookEvent["SUBSCRIPTION_TRIAL_ENDING"] = "subscription.trial_ending";
    WebhookEvent["SUBSCRIPTION_RENEWED"] = "subscription.renewed";
    WebhookEvent["SUBSCRIPTION_UPGRADED"] = "subscription.upgraded";
    WebhookEvent["SUBSCRIPTION_DOWNGRADED"] = "subscription.downgraded";
    WebhookEvent["SUBSCRIPTION_PAUSED"] = "subscription.paused";
    WebhookEvent["SUBSCRIPTION_RESUMED"] = "subscription.resumed";
    WebhookEvent["SUBSCRIPTION_CANCELLED"] = "subscription.cancelled";
    WebhookEvent["SUBSCRIPTION_EXPIRED"] = "subscription.expired";
    WebhookEvent["PAYMENT_FAILED"] = "payment.failed";
    WebhookEvent["COUPON_REDEEMED"] = "coupon.redeemed";
})(WebhookEvent || (exports.WebhookEvent = WebhookEvent = {}));
// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------
var NotificationType;
(function (NotificationType) {
    NotificationType["INVOICE_CREATED"] = "invoice_created";
    NotificationType["INVOICE_SENT"] = "invoice_sent";
    NotificationType["INVOICE_PAID"] = "invoice_paid";
    NotificationType["INVOICE_OVERDUE"] = "invoice_overdue";
    NotificationType["PAYMENT_RECEIVED"] = "payment_received";
    NotificationType["QUOTE_ACCEPTED"] = "quote_accepted";
    NotificationType["QUOTE_EXPIRED"] = "quote_expired";
    NotificationType["EXPENSE_APPROVED"] = "expense_approved";
    NotificationType["SUBSCRIPTION_CREATED"] = "subscription_created";
    NotificationType["SUBSCRIPTION_RENEWED"] = "subscription_renewed";
    NotificationType["SUBSCRIPTION_CANCELLED"] = "subscription_cancelled";
    NotificationType["PAYMENT_FAILED"] = "payment_failed";
    NotificationType["TRIAL_ENDING"] = "trial_ending";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
// ---------------------------------------------------------------------------
// Scheduled Report
// ---------------------------------------------------------------------------
var ScheduledReportType;
(function (ScheduledReportType) {
    ScheduledReportType["REVENUE"] = "revenue";
    ScheduledReportType["RECEIVABLES"] = "receivables";
    ScheduledReportType["EXPENSES"] = "expenses";
    ScheduledReportType["TAX"] = "tax";
    ScheduledReportType["PROFIT_LOSS"] = "profit_loss";
})(ScheduledReportType || (exports.ScheduledReportType = ScheduledReportType = {}));
var ScheduledReportFrequency;
(function (ScheduledReportFrequency) {
    ScheduledReportFrequency["DAILY"] = "daily";
    ScheduledReportFrequency["WEEKLY"] = "weekly";
    ScheduledReportFrequency["MONTHLY"] = "monthly";
})(ScheduledReportFrequency || (exports.ScheduledReportFrequency = ScheduledReportFrequency = {}));
// ---------------------------------------------------------------------------
// Dunning
// ---------------------------------------------------------------------------
var DunningAttemptStatus;
(function (DunningAttemptStatus) {
    DunningAttemptStatus["PENDING"] = "pending";
    DunningAttemptStatus["SUCCESS"] = "success";
    DunningAttemptStatus["FAILED"] = "failed";
    DunningAttemptStatus["SKIPPED"] = "skipped";
})(DunningAttemptStatus || (exports.DunningAttemptStatus = DunningAttemptStatus = {}));
//# sourceMappingURL=index.js.map