import { z } from "zod";
import {
  InvoiceStatus, QuoteStatus, PaymentMethod, ExpenseStatus,
  RecurringFrequency, RecurringStatus, TaxType, DiscountType, UserRole, CreditNoteStatus,
  DisputeStatus, ScheduledReportType, ScheduledReportFrequency,
  PricingModel, CouponType, CouponAppliesTo,
  BillingInterval, SubscriptionStatus,
} from "../types/index";

// ============================================================================
// PRIMITIVES
// ============================================================================

export const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================================
// AUTH
// ============================================================================

export const RegisterSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  orgName: z.string().min(1, "Organization name is required").max(100),
  country: z.string().min(2).default("IN"),
  currency: z.string().length(3).default("INR"),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

// ============================================================================
// ORGANIZATION
// ============================================================================

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  legalName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: AddressSchema,
  taxId: z.string().optional(),
  pan: z.string().optional(),
  defaultCurrency: z.string().length(3).default("INR"),
  country: z.string().min(2),
  fiscalYearStart: z.number().int().min(1).max(12).default(4),
  invoicePrefix: z.string().min(1).max(20).default("INV"),
  quotePrefix: z.string().min(1).max(20).default("QTE"),
  defaultPaymentTerms: z.number().int().min(0).default(30),
  defaultNotes: z.string().optional(),
  defaultTerms: z.string().optional(),
  timezone: z.string().min(1).max(50).default("UTC"),
});

export const UpdateOrgSchema = CreateOrgSchema.partial();

// ============================================================================
// CLIENT
// ============================================================================

export const ClientContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(100),
  displayName: z.string().min(1).max(100),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  taxId: z.string().optional(),
  billingAddress: AddressSchema.optional(),
  shippingAddress: AddressSchema.optional(),
  contacts: z.array(ClientContactSchema).default([]),
  currency: z.string().length(3).default("INR"),
  paymentTerms: z.number().int().min(0).default(30),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  portalEnabled: z.boolean().default(false),
  portalEmail: z.string().email().optional(),
  customFields: z.record(z.string()).optional(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

export const ClientFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  isActive: z.coerce.boolean().optional(),
});

// ============================================================================
// PRODUCT
// ============================================================================

export const PricingTierSchema = z.object({
  upTo: z.number().int().positive().nullable(),
  unitPrice: z.number().int().min(0, "Unit price must be non-negative"),
  flatFee: z.number().int().min(0).optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(100),
  description: z.string().optional(),
  sku: z.string().optional(),
  type: z.enum(["goods", "service"]),
  unit: z.string().optional(),
  rate: z.number().int().min(0, "Rate must be a non-negative integer (smallest unit)"),
  pricingModel: z.nativeEnum(PricingModel).default(PricingModel.FLAT),
  pricingTiers: z.array(PricingTierSchema).optional(),
  taxRateId: z.string().uuid().optional(),
  hsnCode: z.string().optional(),
  trackInventory: z.boolean().default(false),
  stockOnHand: z.number().int().optional(),
  reorderLevel: z.number().int().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const CreateUsageRecordSchema = z.object({
  productId: z.string().uuid("Valid product ID required"),
  clientId: z.string().uuid("Valid client ID required"),
  subscriptionId: z.string().uuid().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  description: z.string().max(255).optional(),
  recordedAt: z.coerce.date().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const UsageFilterSchema = PaginationSchema.extend({
  productId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
});

export const UsageSummarySchema = z.object({
  productId: z.string().uuid("Valid product ID required"),
  clientId: z.string().uuid("Valid client ID required"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

// ============================================================================
// TAX RATE
// ============================================================================

export const TaxComponentSchema = z.object({
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
});

export const CreateTaxRateSchema = z.object({
  name: z.string().min(1, "Tax rate name is required").max(100),
  type: z.nativeEnum(TaxType),
  rate: z.number().min(0).max(100),
  isCompound: z.boolean().default(false),
  components: z.array(TaxComponentSchema).optional(),
  isDefault: z.boolean().default(false),
});

export const UpdateTaxRateSchema = CreateTaxRateSchema.partial();

// ============================================================================
// INVOICE
// ============================================================================

export const InvoiceItemSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  hsnCode: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().optional(),
  rate: z.number().int().min(0),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().min(0).optional(),
  taxRateId: z.string().uuid().optional(),
  sortOrder: z.number().int().default(0),
});

export const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  referenceNumber: z.string().optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.string().length(3).default("INR"),
  exchangeRate: z.number().positive().default(1),
  items: z.array(InvoiceItemSchema).min(1, "At least one item is required"),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  autoSend: z.boolean().optional().default(false),
  autoApplyCredits: z.boolean().optional().default(false),
  tdsRate: z.number().min(0).max(100).optional(),
  tdsSection: z.string().max(20).optional(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

export const InvoiceFilterSchema = PaginationSchema.extend({
  status: z.nativeEnum(InvoiceStatus).optional(),
  clientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
});

export const BulkInvoiceActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["send", "markSent", "delete", "downloadPdf"]),
});

export const RecordPaymentSchema = z.object({
  amount: z.number().int().positive("Amount must be positive"),
  date: z.coerce.date(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// QUOTE
// ============================================================================

export const CreateQuoteSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  currency: z.string().length(3).default("INR"),
  items: z.array(InvoiceItemSchema).min(1, "At least one item is required"),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const UpdateQuoteSchema = CreateQuoteSchema.partial();

export const QuoteFilterSchema = PaginationSchema.extend({
  status: z.nativeEnum(QuoteStatus).optional(),
  clientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().optional(),
});

// ============================================================================
// PAYMENT
// ============================================================================

export const CreatePaymentSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  invoiceId: z.string().uuid().optional(),
  date: z.coerce.date(),
  amount: z.number().int().positive("Amount must be positive"),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const PaymentFilterSchema = PaginationSchema.extend({
  clientId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const RefundSchema = z.object({
  amount: z.number().int().positive("Refund amount must be positive"),
  reason: z.string().optional(),
});

// ============================================================================
// CREDIT NOTE
// ============================================================================

export const CreateCreditNoteSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  date: z.coerce.date(),
  items: z.array(InvoiceItemSchema).min(1),
  reason: z.string().optional(),
});

export const ApplyCreditNoteSchema = z.object({
  invoiceId: z.string().uuid("Valid invoice ID required"),
  amount: z.number().int().positive("Amount must be positive"),
});

// ============================================================================
// VENDOR
// ============================================================================

export const CreateVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required").max(100),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().max(100).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export const VendorFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ============================================================================
// EXPENSE
// ============================================================================

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().optional(),
});

export const CreateExpenseSchema = z.object({
  categoryId: z.string().uuid("Valid category ID required"),
  vendorName: z.string().optional(),
  date: z.coerce.date(),
  amount: z.number().int().positive("Amount must be positive"),
  currency: z.string().length(3).default("INR"),
  taxAmount: z.number().int().min(0).default(0),
  description: z.string().min(1, "Description is required"),
  isBillable: z.boolean().default(false),
  clientId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  distance: z.number().min(0).optional(),
  mileageRate: z.number().int().min(0).optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const ExpenseFilterSchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  isBillable: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ============================================================================
// RECURRING
// ============================================================================

export const CreateRecurringProfileSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  type: z.enum(["invoice", "expense"]),
  frequency: z.nativeEnum(RecurringFrequency),
  customDays: z.number().int().positive().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  maxOccurrences: z.number().int().positive().optional(),
  autoSend: z.boolean().default(false),
  autoCharge: z.boolean().default(false),
  templateData: z.record(z.unknown()),
});

export const UpdateRecurringProfileSchema = CreateRecurringProfileSchema.partial();

// ============================================================================
// WEBHOOK
// ============================================================================

export const CreateWebhookSchema = z.object({
  url: z.string().url("Valid URL required"),
  events: z.array(z.string()).min(1, "At least one event required"),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

// ============================================================================
// SETTINGS
// ============================================================================

export const UpdateSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(20).optional(),
  quotePrefix: z.string().min(1).max(20).optional(),
  defaultPaymentTerms: z.number().int().min(0).optional(),
  defaultNotes: z.string().optional(),
  defaultTerms: z.string().optional(),
  defaultCurrency: z.string().length(3).optional(),
  brandColors: z
    .object({ primary: z.string(), accent: z.string() })
    .optional(),
  logo: z.string().optional(),
});

// ============================================================================
// TEAM / USERS
// ============================================================================

export const InviteUserSchema = z.object({
  email: z.string().email("Valid email required"),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.nativeEnum(UserRole),
});

export const UpdateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

// ============================================================================
// REPORT FILTERS
// ============================================================================

export const ReportFilterSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clientId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
});

// ============================================================================
// DISPUTE
// ============================================================================

export const CreateDisputeSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  reason: z.string().min(1, "Reason is required"),
});

export const UpdateDisputeSchema = z.object({
  status: z.nativeEnum(DisputeStatus).optional(),
  resolution: z.string().optional(),
  adminNotes: z.string().optional(),
});

export const DisputeFilterSchema = PaginationSchema.extend({
  status: z.nativeEnum(DisputeStatus).optional(),
  clientId: z.string().uuid().optional(),
});

// ============================================================================
// SCHEDULED REPORT
// ============================================================================

export const CreateScheduledReportSchema = z.object({
  reportType: z.nativeEnum(ScheduledReportType),
  frequency: z.nativeEnum(ScheduledReportFrequency),
  recipientEmail: z.string().email("Valid recipient email required"),
  isActive: z.boolean().default(true),
});

export const UpdateScheduledReportSchema = CreateScheduledReportSchema.partial();

// ============================================================================
// COUPON
// ============================================================================

export const CreateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50),
  name: z.string().min(1, "Coupon name is required").max(100),
  type: z.nativeEnum(CouponType),
  value: z.number().int().positive("Value must be positive"),
  currency: z.string().length(3).optional(),
  appliesTo: z.nativeEnum(CouponAppliesTo).default(CouponAppliesTo.INVOICE),
  productId: z.string().uuid().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  maxRedemptionsPerClient: z.number().int().positive().optional(),
  minAmount: z.number().int().min(0).default(0),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
});

export const UpdateCouponSchema = CreateCouponSchema.partial();

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  invoiceId: z.string().uuid("Valid invoice ID required"),
  clientId: z.string().uuid("Valid client ID required"),
});

export const ValidateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  amount: z.number().int().min(0).optional(),
  clientId: z.string().uuid().optional(),
});

export const CouponFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  appliesTo: z.nativeEnum(CouponAppliesTo).optional(),
});

// ============================================================================
// PLAN
// ============================================================================

export const CreatePlanSchema = z.object({
  name: z.string().min(1, "Plan name is required").max(100),
  description: z.string().optional(),
  billingInterval: z.nativeEnum(BillingInterval),
  billingIntervalDays: z.number().int().positive().optional(),
  trialPeriodDays: z.number().int().min(0).default(0),
  price: z.number().int().min(0, "Price must be a non-negative integer (smallest unit)"),
  setupFee: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("INR"),
  features: z.array(z.string()).default([]),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdatePlanSchema = CreatePlanSchema.partial();

// ============================================================================
// SUBSCRIPTION
// ============================================================================

export const CreateSubscriptionSchema = z.object({
  clientId: z.string().uuid("Valid client ID required"),
  planId: z.string().uuid("Valid plan ID required"),
  quantity: z.number().int().positive().default(1),
  autoRenew: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const ChangeSubscriptionPlanSchema = z.object({
  newPlanId: z.string().uuid("Valid plan ID required"),
  prorate: z.boolean().default(false),
});

export const CancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
  cancelImmediately: z.boolean().default(false),
});

export const SubscriptionFilterSchema = PaginationSchema.extend({
  status: z.nativeEnum(SubscriptionStatus).optional(),
  clientId: z.string().uuid().optional(),
});
