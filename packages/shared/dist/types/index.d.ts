export declare enum InvoiceStatus {
    DRAFT = "draft",
    SENT = "sent",
    VIEWED = "viewed",
    PARTIALLY_PAID = "partially_paid",
    PAID = "paid",
    OVERDUE = "overdue",
    VOID = "void",
    WRITTEN_OFF = "written_off"
}
export declare enum QuoteStatus {
    DRAFT = "draft",
    SENT = "sent",
    VIEWED = "viewed",
    ACCEPTED = "accepted",
    DECLINED = "declined",
    EXPIRED = "expired",
    CONVERTED = "converted"
}
export declare enum PaymentMethod {
    CASH = "cash",
    BANK_TRANSFER = "bank_transfer",
    CHEQUE = "cheque",
    UPI = "upi",
    CARD = "card",
    GATEWAY_STRIPE = "gateway_stripe",
    GATEWAY_RAZORPAY = "gateway_razorpay",
    GATEWAY_PAYPAL = "gateway_paypal",
    OTHER = "other"
}
export declare enum ExpenseStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    BILLED = "billed",
    PAID = "paid"
}
export declare enum RecurringFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    HALF_YEARLY = "half_yearly",
    YEARLY = "yearly",
    CUSTOM = "custom"
}
export declare enum RecurringStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare enum TaxType {
    GST = "gst",
    IGST = "igst",
    VAT = "vat",
    SALES_TAX = "sales_tax",
    CUSTOM = "custom"
}
export declare enum DiscountType {
    PERCENTAGE = "percentage",
    FIXED = "fixed"
}
export declare enum PricingModel {
    FLAT = "flat",
    TIERED = "tiered",
    VOLUME = "volume",
    PER_SEAT = "per_seat",
    METERED = "metered"
}
export declare enum CouponType {
    PERCENTAGE = "percentage",
    FIXED_AMOUNT = "fixed_amount"
}
export declare enum CouponAppliesTo {
    INVOICE = "invoice",
    SUBSCRIPTION = "subscription",
    PRODUCT = "product"
}
export declare enum BillingInterval {
    MONTHLY = "monthly",
    QUARTERLY = "quarterly",
    SEMI_ANNUAL = "semi_annual",
    ANNUAL = "annual",
    CUSTOM = "custom"
}
export declare enum SubscriptionStatus {
    TRIALING = "trialing",
    ACTIVE = "active",
    PAUSED = "paused",
    PAST_DUE = "past_due",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare enum SubscriptionEventType {
    CREATED = "created",
    ACTIVATED = "activated",
    TRIAL_STARTED = "trial_started",
    TRIAL_ENDED = "trial_ended",
    RENEWED = "renewed",
    UPGRADED = "upgraded",
    DOWNGRADED = "downgraded",
    PAUSED = "paused",
    RESUMED = "resumed",
    CANCELLED = "cancelled",
    EXPIRED = "expired",
    PAYMENT_FAILED = "payment_failed"
}
export declare enum UserRole {
    OWNER = "owner",
    ADMIN = "admin",
    ACCOUNTANT = "accountant",
    SALES = "sales",
    VIEWER = "viewer"
}
export declare enum CreditNoteStatus {
    DRAFT = "draft",
    OPEN = "open",
    APPLIED = "applied",
    REFUNDED = "refunded",
    VOID = "void"
}
export declare enum DisputeStatus {
    OPEN = "open",
    UNDER_REVIEW = "under_review",
    RESOLVED = "resolved",
    CLOSED = "closed"
}
export declare enum WebhookEvent {
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
    COUPON_REDEEMED = "coupon.redeemed"
}
export interface Organization {
    id: string;
    name: string;
    legalName: string;
    email: string;
    phone?: string;
    website?: string;
    logo?: string;
    address: Address;
    taxId?: string;
    pan?: string;
    defaultCurrency: string;
    country: string;
    state?: string;
    fiscalYearStart: number;
    invoicePrefix: string;
    invoiceNextNumber: number;
    quotePrefix: string;
    quoteNextNumber: number;
    defaultPaymentTerms: number;
    defaultNotes?: string;
    defaultTerms?: string;
    brandColors?: {
        primary: string;
        accent: string;
    };
    timezone: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
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
    createdAt: Date;
    updatedAt: Date;
}
export interface ClientContact {
    id: string;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    isPrimary: boolean;
}
export interface PricingTier {
    upTo: number | null;
    unitPrice: number;
    flatFee?: number;
}
export interface Product {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    sku?: string;
    type: "goods" | "service";
    unit?: string;
    rate: number;
    pricingModel: PricingModel;
    pricingTiers?: PricingTier[];
    taxRateId?: string;
    hsnCode?: string;
    trackInventory: boolean;
    stockOnHand?: number;
    reorderLevel?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface UsageRecord {
    id: string;
    orgId: string;
    subscriptionId?: string;
    productId: string;
    clientId: string;
    quantity: number;
    description?: string;
    recordedAt: Date;
    periodStart: Date;
    periodEnd: Date;
    createdAt: Date;
}
export interface Coupon {
    id: string;
    orgId: string;
    code: string;
    name: string;
    type: CouponType;
    value: number;
    currency?: string;
    appliesTo: CouponAppliesTo;
    productId?: string;
    maxRedemptions?: number;
    maxRedemptionsPerClient?: number;
    timesRedeemed: number;
    minAmount: number;
    validFrom: Date;
    validUntil?: Date;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CouponRedemption {
    id: string;
    couponId: string;
    orgId: string;
    clientId: string;
    invoiceId?: string;
    subscriptionId?: string;
    discountAmount: number;
    redeemedAt: Date;
}
export interface TaxRate {
    id: string;
    orgId: string;
    name: string;
    type: TaxType;
    rate: number;
    isCompound: boolean;
    components?: TaxComponent[];
    isDefault: boolean;
    isActive: boolean;
}
export interface TaxComponent {
    name: string;
    rate: number;
}
export interface Invoice {
    id: string;
    orgId: string;
    clientId: string;
    invoiceNumber: string;
    referenceNumber?: string;
    status: InvoiceStatus;
    issueDate: Date;
    dueDate: Date;
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
    sentAt?: Date;
    viewedAt?: Date;
    paidAt?: Date;
    recurringProfileId?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
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
    taxComponents?: {
        name: string;
        rate: number;
        amount: number;
    }[];
    amount: number;
    sortOrder: number;
}
export interface Quote {
    id: string;
    orgId: string;
    clientId: string;
    quoteNumber: string;
    status: QuoteStatus;
    issueDate: Date;
    expiryDate: Date;
    currency: string;
    items: InvoiceItem[];
    subtotal: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    notes?: string;
    terms?: string;
    acceptedAt?: Date;
    convertedInvoiceId?: string;
    version: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Payment {
    id: string;
    orgId: string;
    clientId: string;
    invoiceId?: string;
    paymentNumber: string;
    date: Date;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    gatewayTransactionId?: string;
    notes?: string;
    isRefund: boolean;
    refundedAmount: number;
    receiptUrl?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreditNote {
    id: string;
    orgId: string;
    clientId: string;
    creditNoteNumber: string;
    status: CreditNoteStatus;
    date: Date;
    items: InvoiceItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
    balance: number;
    reason?: string;
    appliedToInvoices?: {
        invoiceId: string;
        amount: number;
    }[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Dispute {
    id: string;
    orgId: string;
    clientId: string;
    invoiceId?: string;
    reason: string;
    status: DisputeStatus;
    resolution?: string;
    adminNotes?: string;
    attachments?: {
        name: string;
        url: string;
    }[];
    resolvedBy?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface Vendor {
    id: string;
    orgId: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    taxId?: string;
    notes?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Expense {
    id: string;
    orgId: string;
    categoryId: string;
    vendorName?: string;
    date: Date;
    amount: number;
    currency: string;
    taxAmount: number;
    description: string;
    receiptUrl?: string;
    isBillable: boolean;
    clientId?: string;
    invoiceId?: string;
    status: ExpenseStatus;
    approvedBy?: string;
    tags: string[];
    distance?: number;
    mileageRate?: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface ExpenseCategory {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    isActive: boolean;
}
export interface RecurringProfile {
    id: string;
    orgId: string;
    clientId: string;
    type: "invoice" | "expense";
    frequency: RecurringFrequency;
    customDays?: number;
    startDate: Date;
    endDate?: Date;
    maxOccurrences?: number;
    occurrenceCount: number;
    nextExecutionDate: Date;
    status: RecurringStatus;
    autoSend: boolean;
    autoCharge: boolean;
    templateData: Partial<Invoice> | Partial<Expense>;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Webhook {
    id: string;
    orgId: string;
    url: string;
    events: WebhookEvent[];
    secret: string;
    isActive: boolean;
    lastDeliveredAt?: Date;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface WebhookDelivery {
    id: string;
    webhookId: string;
    orgId: string;
    event: string;
    requestBody: string;
    responseStatus: number | null;
    responseBody: string | null;
    success: boolean;
    error: string | null;
    durationMs: number | null;
    deliveredAt: Date;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, string[]>;
    };
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    orgId: string;
    orgName: string;
    firstName: string;
    lastName: string;
}
export interface DashboardStats {
    totalRevenue: number;
    totalOutstanding: number;
    totalOverdue: number;
    invoicesSent: number;
    invoicesPaid: number;
    totalExpenses: number;
    netIncome: number;
    recentInvoices: Invoice[];
    recentPayments: Payment[];
    receivablesAging: {
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
    };
    revenueByMonth: {
        month: string;
        revenue: number;
        expenses: number;
    }[];
}
export declare enum NotificationType {
    INVOICE_CREATED = "invoice_created",
    INVOICE_SENT = "invoice_sent",
    INVOICE_PAID = "invoice_paid",
    INVOICE_OVERDUE = "invoice_overdue",
    PAYMENT_RECEIVED = "payment_received",
    QUOTE_ACCEPTED = "quote_accepted",
    QUOTE_EXPIRED = "quote_expired",
    EXPENSE_APPROVED = "expense_approved",
    SUBSCRIPTION_CREATED = "subscription_created",
    SUBSCRIPTION_RENEWED = "subscription_renewed",
    SUBSCRIPTION_CANCELLED = "subscription_cancelled",
    PAYMENT_FAILED = "payment_failed",
    TRIAL_ENDING = "trial_ending"
}
export interface Notification {
    id: string;
    orgId: string;
    userId: string | null;
    type: NotificationType;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum ScheduledReportType {
    REVENUE = "revenue",
    RECEIVABLES = "receivables",
    EXPENSES = "expenses",
    TAX = "tax",
    PROFIT_LOSS = "profit_loss"
}
export declare enum ScheduledReportFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly"
}
export interface ScheduledReport {
    id: string;
    orgId: string;
    reportType: ScheduledReportType;
    frequency: ScheduledReportFrequency;
    recipientEmail: string;
    isActive: boolean;
    lastSentAt?: Date;
    nextSendAt: Date;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
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
    createdAt: Date;
    updatedAt: Date;
}
export interface Subscription {
    id: string;
    orgId: string;
    clientId: string;
    planId: string;
    status: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialStart?: Date;
    trialEnd?: Date;
    cancelledAt?: Date;
    cancelReason?: string;
    pauseStart?: Date;
    resumeDate?: Date;
    nextBillingDate: Date;
    quantity: number;
    metadata?: Record<string, unknown>;
    couponId?: string;
    couponDiscountAmount?: number;
    autoRenew: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SubscriptionEvent {
    id: string;
    subscriptionId: string;
    orgId: string;
    eventType: SubscriptionEventType;
    oldPlanId?: string;
    newPlanId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
export declare enum DunningAttemptStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    SKIPPED = "skipped"
}
export interface DunningConfig {
    id: string;
    orgId: string;
    maxRetries: number;
    retrySchedule: number[];
    gracePeriodDays: number;
    cancelAfterAllRetries: boolean;
    sendReminderEmails: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface DunningAttempt {
    id: string;
    orgId: string;
    invoiceId: string;
    subscriptionId?: string;
    attemptNumber: number;
    status: DunningAttemptStatus;
    paymentError?: string;
    nextRetryAt?: Date;
    createdAt: Date;
}
export interface MRRMetrics {
    mrr: number;
    mrrGrowth: number;
}
export interface ARRMetrics {
    arr: number;
}
export interface ChurnMetrics {
    customerChurn: number;
    revenueChurn: number;
    netRevenueRetention: number;
}
export interface LTVMetrics {
    ltv: number;
    averageSubscriptionDurationMonths: number;
}
export interface RevenueBreakdownMonth {
    month: string;
    newMRR: number;
    expansionMRR: number;
    contractionMRR: number;
    churnMRR: number;
    netNewMRR: number;
}
export interface SubscriptionStats {
    totalActive: number;
    totalTrialing: number;
    totalPaused: number;
    totalPastDue: number;
    totalCancelled: number;
    conversionRate: number;
    averageRevenuePerSubscription: number;
}
export interface CohortRow {
    cohortMonth: string;
    totalSubscriptions: number;
    retentionByMonth: number[];
}
export interface GlobalSearchResult {
    id: string;
    type: "client" | "invoice" | "quote" | "expense" | "product" | "vendor";
    title: string;
    subtitle: string;
}
export interface GlobalSearchResults {
    clients: GlobalSearchResult[];
    invoices: GlobalSearchResult[];
    quotes: GlobalSearchResult[];
    expenses: GlobalSearchResult[];
    products: GlobalSearchResult[];
    vendors: GlobalSearchResult[];
}
