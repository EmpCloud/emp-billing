"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteUserSchema = exports.UpdateSettingsSchema = exports.UpdateWebhookSchema = exports.CreateWebhookSchema = exports.UpdateRecurringProfileSchema = exports.CreateRecurringProfileSchema = exports.ExpenseFilterSchema = exports.UpdateExpenseSchema = exports.CreateExpenseSchema = exports.CreateExpenseCategorySchema = exports.VendorFilterSchema = exports.UpdateVendorSchema = exports.CreateVendorSchema = exports.ApplyCreditNoteSchema = exports.CreateCreditNoteSchema = exports.RefundSchema = exports.PaymentFilterSchema = exports.CreatePaymentSchema = exports.QuoteFilterSchema = exports.UpdateQuoteSchema = exports.CreateQuoteSchema = exports.RecordPaymentSchema = exports.BulkInvoiceActionSchema = exports.InvoiceFilterSchema = exports.UpdateInvoiceSchema = exports.CreateInvoiceSchema = exports.InvoiceItemSchema = exports.UpdateTaxRateSchema = exports.CreateTaxRateSchema = exports.TaxComponentSchema = exports.UsageSummarySchema = exports.UsageFilterSchema = exports.CreateUsageRecordSchema = exports.UpdateProductSchema = exports.CreateProductSchema = exports.PricingTierSchema = exports.ClientFilterSchema = exports.UpdateClientSchema = exports.CreateClientSchema = exports.ClientContactSchema = exports.UpdateOrgSchema = exports.CreateOrgSchema = exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.RefreshTokenSchema = exports.LoginSchema = exports.RegisterSchema = exports.PaginationSchema = exports.AddressSchema = void 0;
exports.SubscriptionFilterSchema = exports.CancelSubscriptionSchema = exports.ChangeSubscriptionPlanSchema = exports.CreateSubscriptionSchema = exports.UpdatePlanSchema = exports.CreatePlanSchema = exports.CouponFilterSchema = exports.ValidateCouponSchema = exports.ApplyCouponSchema = exports.UpdateCouponSchema = exports.CreateCouponSchema = exports.UpdateScheduledReportSchema = exports.CreateScheduledReportSchema = exports.DisputeFilterSchema = exports.UpdateDisputeSchema = exports.CreateDisputeSchema = exports.ReportFilterSchema = exports.UpdateUserRoleSchema = void 0;
const zod_1 = require("zod");
const index_1 = require("../types/index");
// ============================================================================
// PRIMITIVES
// ============================================================================
const alphaWithSpaces = /^[A-Za-z\s\-'.]+$/;
const phonePattern = /^\+?[\d\s\-().]+$/;
exports.AddressSchema = zod_1.z.object({
    line1: zod_1.z.string().min(1, "Address line 1 is required"),
    line2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(1, "City is required").regex(alphaWithSpaces, "City must contain only letters"),
    state: zod_1.z.string().min(1, "State is required").regex(alphaWithSpaces, "State must contain only letters"),
    postalCode: zod_1.z.string().min(1, "Postal code is required"),
    country: zod_1.z.string().min(2, "Country is required").regex(alphaWithSpaces, "Country must contain only letters"),
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
});
// ============================================================================
// AUTH
// ============================================================================
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email("Valid email required"),
    password: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number"),
    firstName: zod_1.z.string().min(1, "First name is required").max(50),
    lastName: zod_1.z.string().min(1, "Last name is required").max(50),
    orgName: zod_1.z.string().min(1, "Organization name is required").max(100),
    country: zod_1.z.string().min(2).default("IN"),
    currency: zod_1.z.string().length(3).default("INR"),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z
        .string()
        .min(8)
        .regex(/[A-Z]/)
        .regex(/[0-9]/),
});
exports.ChangePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z
        .string()
        .min(8)
        .regex(/[A-Z]/)
        .regex(/[0-9]/),
});
// ============================================================================
// ORGANIZATION
// ============================================================================
exports.CreateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    legalName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    address: exports.AddressSchema,
    taxId: zod_1.z.string().optional(),
    pan: zod_1.z.string().optional(),
    defaultCurrency: zod_1.z.string().length(3).default("INR"),
    country: zod_1.z.string().min(2),
    fiscalYearStart: zod_1.z.number().int().min(1).max(12).default(4),
    invoicePrefix: zod_1.z.string().min(1).max(20).default("INV"),
    quotePrefix: zod_1.z.string().min(1).max(20).default("QTE"),
    defaultPaymentTerms: zod_1.z.number().int().min(0).default(30),
    defaultNotes: zod_1.z.string().optional(),
    defaultTerms: zod_1.z.string().optional(),
    timezone: zod_1.z.string().min(1).max(50).default("UTC"),
});
exports.UpdateOrgSchema = exports.CreateOrgSchema.partial();
// ============================================================================
// CLIENT
// ============================================================================
exports.ClientContactSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().regex(phonePattern, "Phone must contain only numbers, spaces, and +/-(). characters").optional().or(zod_1.z.literal("")),
    designation: zod_1.z.string().optional(),
    isPrimary: zod_1.z.boolean().default(false),
});
exports.CreateClientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Client name is required").max(100).refine((v) => !/^\d+$/.test(v.trim()), "Client name cannot be purely numeric"),
    displayName: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email("Valid email required"),
    phone: zod_1.z.string().regex(phonePattern, "Phone must contain only numbers, spaces, and +/-(). characters").optional().or(zod_1.z.literal("")),
    website: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    taxId: zod_1.z.string().optional(),
    billingAddress: exports.AddressSchema.optional(),
    shippingAddress: exports.AddressSchema.optional(),
    contacts: zod_1.z.array(exports.ClientContactSchema).default([]),
    currency: zod_1.z.string().length(3).default("INR"),
    paymentTerms: zod_1.z.number().int().min(0).default(30),
    notes: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    portalEnabled: zod_1.z.boolean().default(false),
    portalEmail: zod_1.z.string().email().optional(),
    customFields: zod_1.z.record(zod_1.z.string()).optional(),
});
exports.UpdateClientSchema = exports.CreateClientSchema.partial();
exports.ClientFilterSchema = exports.PaginationSchema.extend({
    search: zod_1.z.string().optional(),
    tags: zod_1.z.string().optional(), // comma-separated
    isActive: zod_1.z.coerce.boolean().optional(),
});
// ============================================================================
// PRODUCT
// ============================================================================
exports.PricingTierSchema = zod_1.z.object({
    upTo: zod_1.z.number().int().positive().nullable(),
    unitPrice: zod_1.z.number().int().min(0, "Unit price must be non-negative"),
    flatFee: zod_1.z.number().int().min(0).optional(),
});
exports.CreateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Product name is required").max(100),
    description: zod_1.z.string().optional(),
    sku: zod_1.z.string().optional(),
    type: zod_1.z.enum(["goods", "service"]),
    unit: zod_1.z.string().optional(),
    rate: zod_1.z.number().int().min(0, "Rate must be a non-negative integer (smallest unit)"),
    pricingModel: zod_1.z.nativeEnum(index_1.PricingModel).default(index_1.PricingModel.FLAT),
    pricingTiers: zod_1.z.array(exports.PricingTierSchema).optional(),
    taxRateId: zod_1.z.string().uuid().optional(),
    hsnCode: zod_1.z.string().optional(),
    trackInventory: zod_1.z.boolean().default(false),
    stockOnHand: zod_1.z.number().int().optional(),
    reorderLevel: zod_1.z.number().int().optional(),
});
exports.UpdateProductSchema = exports.CreateProductSchema.partial();
exports.CreateUsageRecordSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid("Valid product ID required"),
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    subscriptionId: zod_1.z.string().uuid().optional(),
    quantity: zod_1.z.number().positive("Quantity must be positive"),
    description: zod_1.z.string().max(255).optional(),
    recordedAt: zod_1.z.coerce.date().optional(),
    periodStart: zod_1.z.coerce.date(),
    periodEnd: zod_1.z.coerce.date(),
});
exports.UsageFilterSchema = exports.PaginationSchema.extend({
    productId: zod_1.z.string().uuid().optional(),
    clientId: zod_1.z.string().uuid().optional(),
    periodStart: zod_1.z.coerce.date().optional(),
    periodEnd: zod_1.z.coerce.date().optional(),
});
exports.UsageSummarySchema = zod_1.z.object({
    productId: zod_1.z.string().uuid("Valid product ID required"),
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    periodStart: zod_1.z.coerce.date(),
    periodEnd: zod_1.z.coerce.date(),
});
// ============================================================================
// TAX RATE
// ============================================================================
exports.TaxComponentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    rate: zod_1.z.number().min(0).max(100),
});
exports.CreateTaxRateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Tax rate name is required").max(100),
    type: zod_1.z.nativeEnum(index_1.TaxType),
    rate: zod_1.z.number().min(0).max(100),
    isCompound: zod_1.z.boolean().default(false),
    components: zod_1.z.array(exports.TaxComponentSchema).optional(),
    isDefault: zod_1.z.boolean().default(false),
});
exports.UpdateTaxRateSchema = exports.CreateTaxRateSchema.partial();
// ============================================================================
// INVOICE
// ============================================================================
exports.InvoiceItemSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1, "Item name is required").refine((v) => !/^\d+$/.test(v.trim()), "Item name cannot be purely numeric"),
    description: zod_1.z.string().optional(),
    hsnCode: zod_1.z.string().optional(),
    quantity: zod_1.z.number().positive("Quantity must be positive"),
    unit: zod_1.z.string().optional(),
    rate: zod_1.z.number().int().min(0),
    discountType: zod_1.z.nativeEnum(index_1.DiscountType).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    taxRateId: zod_1.z.string().uuid().optional(),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.CreateInvoiceSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    referenceNumber: zod_1.z.string().optional(),
    issueDate: zod_1.z.coerce.date(),
    dueDate: zod_1.z.coerce.date(),
    currency: zod_1.z.string().length(3).default("INR"),
    exchangeRate: zod_1.z.number().positive().default(1),
    items: zod_1.z.array(exports.InvoiceItemSchema).min(1, "At least one item is required"),
    discountType: zod_1.z.nativeEnum(index_1.DiscountType).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
    terms: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.string()).optional(),
    autoSend: zod_1.z.boolean().optional().default(false),
    autoApplyCredits: zod_1.z.boolean().optional().default(false),
    tdsRate: zod_1.z.number().min(0).max(100).optional(),
    tdsSection: zod_1.z.string().max(20).optional(),
});
exports.UpdateInvoiceSchema = exports.CreateInvoiceSchema.partial();
exports.InvoiceFilterSchema = exports.PaginationSchema.extend({
    status: zod_1.z.nativeEnum(index_1.InvoiceStatus).optional(),
    clientId: zod_1.z.string().uuid().optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
    search: zod_1.z.string().optional(),
    overdue: zod_1.z.coerce.boolean().optional(),
});
exports.BulkInvoiceActionSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    action: zod_1.z.enum(["send", "markSent", "delete", "downloadPdf"]),
});
exports.RecordPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive("Amount must be positive"),
    date: zod_1.z.coerce.date(),
    method: zod_1.z.nativeEnum(index_1.PaymentMethod),
    reference: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
// ============================================================================
// QUOTE
// ============================================================================
exports.CreateQuoteSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    issueDate: zod_1.z.coerce.date(),
    expiryDate: zod_1.z.coerce.date(),
    currency: zod_1.z.string().length(3).default("INR"),
    items: zod_1.z.array(exports.InvoiceItemSchema).min(1, "At least one item is required"),
    discountType: zod_1.z.nativeEnum(index_1.DiscountType).optional(),
    discountValue: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
    terms: zod_1.z.string().optional(),
});
exports.UpdateQuoteSchema = exports.CreateQuoteSchema.partial();
exports.QuoteFilterSchema = exports.PaginationSchema.extend({
    status: zod_1.z.nativeEnum(index_1.QuoteStatus).optional(),
    clientId: zod_1.z.string().uuid().optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
    search: zod_1.z.string().optional(),
});
// ============================================================================
// PAYMENT
// ============================================================================
exports.CreatePaymentSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    invoiceId: zod_1.z.string().uuid().optional(),
    date: zod_1.z.coerce.date(),
    amount: zod_1.z.number().int().positive("Amount must be positive"),
    method: zod_1.z.nativeEnum(index_1.PaymentMethod),
    reference: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.PaymentFilterSchema = exports.PaginationSchema.extend({
    clientId: zod_1.z.string().uuid().optional(),
    invoiceId: zod_1.z.string().uuid().optional(),
    method: zod_1.z.nativeEnum(index_1.PaymentMethod).optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
});
exports.RefundSchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive("Refund amount must be positive"),
    reason: zod_1.z.string().optional(),
});
// ============================================================================
// CREDIT NOTE
// ============================================================================
exports.CreateCreditNoteSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    date: zod_1.z.coerce.date(),
    items: zod_1.z.array(exports.InvoiceItemSchema).min(1),
    reason: zod_1.z.string().optional(),
});
exports.ApplyCreditNoteSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid("Valid invoice ID required"),
    amount: zod_1.z.number().int().positive("Amount must be positive"),
});
// ============================================================================
// VENDOR
// ============================================================================
exports.CreateVendorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Vendor name is required").max(100),
    email: zod_1.z.string().email("Valid email required").optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().max(100).optional(),
    addressLine1: zod_1.z.string().optional(),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateVendorSchema = exports.CreateVendorSchema.partial();
exports.VendorFilterSchema = exports.PaginationSchema.extend({
    search: zod_1.z.string().optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
});
// ============================================================================
// EXPENSE
// ============================================================================
exports.CreateExpenseCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Category name is required").max(100),
    description: zod_1.z.string().optional(),
});
exports.CreateExpenseSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid("Valid category ID required"),
    vendorName: zod_1.z.string().optional(),
    date: zod_1.z.coerce.date(),
    amount: zod_1.z.number().int().positive("Amount must be positive"),
    currency: zod_1.z.string().length(3).default("INR"),
    taxAmount: zod_1.z.number().int().min(0).default(0),
    description: zod_1.z.string().min(1, "Description is required"),
    isBillable: zod_1.z.boolean().default(false),
    clientId: zod_1.z.string().uuid().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    distance: zod_1.z.number().min(0).optional(),
    mileageRate: zod_1.z.number().int().min(0).optional(),
});
exports.UpdateExpenseSchema = exports.CreateExpenseSchema.partial();
exports.ExpenseFilterSchema = exports.PaginationSchema.extend({
    categoryId: zod_1.z.string().uuid().optional(),
    clientId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.nativeEnum(index_1.ExpenseStatus).optional(),
    isBillable: zod_1.z.coerce.boolean().optional(),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
});
// ============================================================================
// RECURRING
// ============================================================================
exports.CreateRecurringProfileSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    type: zod_1.z.enum(["invoice", "expense"]),
    frequency: zod_1.z.nativeEnum(index_1.RecurringFrequency),
    customDays: zod_1.z.number().int().positive().optional(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date().optional(),
    maxOccurrences: zod_1.z.number().int().positive().optional(),
    autoSend: zod_1.z.boolean().default(false),
    autoCharge: zod_1.z.boolean().default(false),
    templateData: zod_1.z.record(zod_1.z.unknown()),
});
exports.UpdateRecurringProfileSchema = exports.CreateRecurringProfileSchema.partial();
// ============================================================================
// WEBHOOK
// ============================================================================
exports.CreateWebhookSchema = zod_1.z.object({
    url: zod_1.z.string().url("Valid URL required"),
    events: zod_1.z.array(zod_1.z.string()).min(1, "At least one event required"),
});
exports.UpdateWebhookSchema = exports.CreateWebhookSchema.partial();
// ============================================================================
// SETTINGS
// ============================================================================
exports.UpdateSettingsSchema = zod_1.z.object({
    invoicePrefix: zod_1.z.string().min(1).max(20).optional(),
    quotePrefix: zod_1.z.string().min(1).max(20).optional(),
    defaultPaymentTerms: zod_1.z.number().int().min(0).optional(),
    defaultNotes: zod_1.z.string().optional(),
    defaultTerms: zod_1.z.string().optional(),
    defaultCurrency: zod_1.z.string().length(3).optional(),
    brandColors: zod_1.z
        .object({ primary: zod_1.z.string(), accent: zod_1.z.string() })
        .optional(),
    logo: zod_1.z.string().optional(),
});
// ============================================================================
// TEAM / USERS
// ============================================================================
exports.InviteUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Valid email required"),
    firstName: zod_1.z.string().min(1).max(50),
    lastName: zod_1.z.string().min(1).max(50),
    role: zod_1.z.nativeEnum(index_1.UserRole),
});
exports.UpdateUserRoleSchema = zod_1.z.object({
    role: zod_1.z.nativeEnum(index_1.UserRole),
});
// ============================================================================
// REPORT FILTERS
// ============================================================================
exports.ReportFilterSchema = zod_1.z.object({
    from: zod_1.z.coerce.date(),
    to: zod_1.z.coerce.date(),
    clientId: zod_1.z.string().uuid().optional(),
    currency: zod_1.z.string().length(3).optional(),
});
// ============================================================================
// DISPUTE
// ============================================================================
exports.CreateDisputeSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid().optional(),
    reason: zod_1.z.string().min(1, "Reason is required"),
});
exports.UpdateDisputeSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(index_1.DisputeStatus).optional(),
    resolution: zod_1.z.string().optional(),
    adminNotes: zod_1.z.string().optional(),
});
exports.DisputeFilterSchema = exports.PaginationSchema.extend({
    status: zod_1.z.nativeEnum(index_1.DisputeStatus).optional(),
    clientId: zod_1.z.string().uuid().optional(),
});
// ============================================================================
// SCHEDULED REPORT
// ============================================================================
exports.CreateScheduledReportSchema = zod_1.z.object({
    reportType: zod_1.z.nativeEnum(index_1.ScheduledReportType),
    frequency: zod_1.z.nativeEnum(index_1.ScheduledReportFrequency),
    recipientEmail: zod_1.z.string().email("Valid recipient email required"),
    isActive: zod_1.z.boolean().default(true),
});
exports.UpdateScheduledReportSchema = exports.CreateScheduledReportSchema.partial();
// ============================================================================
// COUPON
// ============================================================================
exports.CreateCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Coupon code is required").max(50),
    name: zod_1.z.string().min(1, "Coupon name is required").max(100),
    type: zod_1.z.nativeEnum(index_1.CouponType),
    value: zod_1.z.number().int().positive("Value must be positive"),
    currency: zod_1.z.string().length(3).optional(),
    appliesTo: zod_1.z.nativeEnum(index_1.CouponAppliesTo).default(index_1.CouponAppliesTo.INVOICE),
    productId: zod_1.z.string().uuid().optional(),
    maxRedemptions: zod_1.z.number().int().positive().optional(),
    maxRedemptionsPerClient: zod_1.z.number().int().positive().optional(),
    minAmount: zod_1.z.number().int().min(0).default(0),
    validFrom: zod_1.z.coerce.date(),
    validUntil: zod_1.z.coerce.date().optional(),
});
exports.UpdateCouponSchema = exports.CreateCouponSchema.partial().extend({
    maxRedemptions: zod_1.z.number().int().positive().nullable().optional(),
    maxRedemptionsPerClient: zod_1.z.number().int().positive().nullable().optional(),
});
exports.ApplyCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Coupon code is required"),
    invoiceId: zod_1.z.string().uuid("Valid invoice ID required"),
    clientId: zod_1.z.string().uuid("Valid client ID required"),
});
exports.ValidateCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, "Coupon code is required"),
    amount: zod_1.z.number().int().min(0).optional(),
    clientId: zod_1.z.string().uuid().optional(),
});
exports.CouponFilterSchema = exports.PaginationSchema.extend({
    search: zod_1.z.string().optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    appliesTo: zod_1.z.nativeEnum(index_1.CouponAppliesTo).optional(),
});
// ============================================================================
// PLAN
// ============================================================================
exports.CreatePlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Plan name is required").max(100),
    description: zod_1.z.string().optional(),
    billingInterval: zod_1.z.nativeEnum(index_1.BillingInterval),
    billingIntervalDays: zod_1.z.number().int().positive().optional(),
    trialPeriodDays: zod_1.z.number().int().min(0).default(0),
    price: zod_1.z.number().int().min(0, "Price must be a non-negative integer (smallest unit)"),
    setupFee: zod_1.z.number().int().min(0).default(0),
    currency: zod_1.z.string().length(3).default("INR"),
    features: zod_1.z.array(zod_1.z.string()).default([]),
    sortOrder: zod_1.z.number().int().min(0).default(0),
});
exports.UpdatePlanSchema = exports.CreatePlanSchema.partial();
// ============================================================================
// SUBSCRIPTION
// ============================================================================
exports.CreateSubscriptionSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid("Valid client ID required"),
    planId: zod_1.z.string().uuid("Valid plan ID required"),
    quantity: zod_1.z.number().int().positive().default(1),
    autoRenew: zod_1.z.boolean().default(true),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.ChangeSubscriptionPlanSchema = zod_1.z.object({
    newPlanId: zod_1.z.string().uuid("Valid plan ID required"),
    prorate: zod_1.z.boolean().default(false),
});
exports.CancelSubscriptionSchema = zod_1.z.object({
    reason: zod_1.z.string().optional(),
    cancelImmediately: zod_1.z.boolean().default(false),
});
exports.SubscriptionFilterSchema = exports.PaginationSchema.extend({
    status: zod_1.z.nativeEnum(index_1.SubscriptionStatus).optional(),
    clientId: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=index.js.map