"use strict";
// ============================================================================
// OpenAPI 3.0 Specification for EMP Billing API
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.openApiSpec = void 0;
exports.openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "EMP Billing API",
        description: "Open-source billing and invoicing platform — part of the EmpCloud ecosystem. " +
            "Handles the complete billing lifecycle: quotes, invoices, payments, receipts, and reports.",
        version: "0.1.0",
        contact: {
            name: "EmpCloud Team",
            url: "https://empcloud.com",
            email: "support@empcloud.com",
        },
        license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
        },
    },
    servers: [
        {
            url: "http://localhost:4001",
            description: "Local development server",
        },
        {
            url: "https://api.empcloud.com",
            description: "Production server",
        },
    ],
    // ── Security Schemes ────────────────────────────────────────────────────
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT access token obtained from /api/v1/auth/login",
            },
            PortalAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT token for client portal access obtained from /api/v1/portal/login",
            },
        },
        // ── Shared Schemas ──────────────────────────────────────────────────
        schemas: {
            // -- Common --
            ApiResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    data: {},
                    error: { $ref: "#/components/schemas/ApiError" },
                },
                required: ["success"],
            },
            ApiError: {
                type: "object",
                properties: {
                    code: { type: "string" },
                    message: { type: "string" },
                    details: {
                        type: "object",
                        additionalProperties: {
                            type: "array",
                            items: { type: "string" },
                        },
                    },
                },
                required: ["code", "message"],
            },
            PaginationMeta: {
                type: "object",
                properties: {
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" },
                },
            },
            PaginationParams: {
                type: "object",
                properties: {
                    page: { type: "integer", minimum: 1, default: 1 },
                    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
                },
            },
            // -- Auth --
            LoginRequest: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                },
            },
            RegisterRequest: {
                type: "object",
                required: ["name", "email", "password", "orgName"],
                properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    orgName: { type: "string" },
                },
            },
            AuthTokens: {
                type: "object",
                properties: {
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    expiresIn: { type: "string" },
                },
            },
            ForgotPasswordRequest: {
                type: "object",
                required: ["email"],
                properties: {
                    email: { type: "string", format: "email" },
                },
            },
            ResetPasswordRequest: {
                type: "object",
                required: ["token", "password"],
                properties: {
                    token: { type: "string" },
                    password: { type: "string", minLength: 8 },
                },
            },
            ChangePasswordRequest: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                    currentPassword: { type: "string" },
                    newPassword: { type: "string", minLength: 8 },
                },
            },
            User: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["owner", "admin", "accountant", "sales", "viewer"] },
                    orgId: { type: "string", format: "uuid" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Organization --
            Organization: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    website: { type: "string" },
                    addressLine1: { type: "string" },
                    addressLine2: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    postalCode: { type: "string" },
                    country: { type: "string" },
                    taxId: { type: "string" },
                    baseCurrency: { type: "string" },
                    fiscalYearStart: { type: "integer" },
                    logoUrl: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            UpdateOrganization: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    website: { type: "string" },
                    addressLine1: { type: "string" },
                    addressLine2: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    postalCode: { type: "string" },
                    country: { type: "string" },
                    taxId: { type: "string" },
                    baseCurrency: { type: "string" },
                },
            },
            InviteUserRequest: {
                type: "object",
                required: ["email", "role"],
                properties: {
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["admin", "accountant", "sales", "viewer"] },
                    name: { type: "string" },
                },
            },
            UpdateUserRoleRequest: {
                type: "object",
                required: ["role"],
                properties: {
                    role: { type: "string", enum: ["admin", "accountant", "sales", "viewer"] },
                },
            },
            // -- Client --
            Client: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    company: { type: "string" },
                    billingAddress: { type: "object" },
                    shippingAddress: { type: "object" },
                    taxId: { type: "string" },
                    currency: { type: "string" },
                    paymentTerms: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    totalBilled: { type: "integer", description: "Amount in smallest currency unit" },
                    outstandingBalance: { type: "integer", description: "Amount in smallest currency unit" },
                    customFields: { type: "object" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            CreateClient: {
                type: "object",
                required: ["name", "email"],
                properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    phone: { type: "string" },
                    company: { type: "string" },
                    billingAddress: { type: "object" },
                    shippingAddress: { type: "object" },
                    taxId: { type: "string" },
                    currency: { type: "string" },
                    paymentTerms: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    customFields: { type: "object" },
                },
            },
            ClientContact: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    designation: { type: "string" },
                    isPrimary: { type: "boolean" },
                },
            },
            // -- Product --
            Product: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    description: { type: "string" },
                    sku: { type: "string" },
                    type: { type: "string", enum: ["goods", "services"] },
                    unit: { type: "string" },
                    rate: { type: "integer", description: "Amount in smallest currency unit" },
                    taxRateId: { type: "string" },
                    hsnCode: { type: "string" },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            CreateProduct: {
                type: "object",
                required: ["name", "rate"],
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    sku: { type: "string" },
                    type: { type: "string", enum: ["goods", "services"] },
                    unit: { type: "string" },
                    rate: { type: "integer" },
                    taxRateId: { type: "string" },
                    hsnCode: { type: "string" },
                },
            },
            TaxRate: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    rate: { type: "number" },
                    type: { type: "string" },
                    isCompound: { type: "boolean" },
                    isActive: { type: "boolean" },
                },
            },
            // -- Invoice --
            Invoice: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    invoiceNumber: { type: "string" },
                    referenceNumber: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "written_off"],
                    },
                    issueDate: { type: "string", format: "date" },
                    dueDate: { type: "string", format: "date" },
                    currency: { type: "string" },
                    exchangeRate: { type: "number" },
                    subtotal: { type: "integer", description: "Amount in smallest currency unit" },
                    discountType: { type: "string", enum: ["percentage", "fixed"] },
                    discountValue: { type: "number" },
                    discountAmount: { type: "integer" },
                    taxAmount: { type: "integer" },
                    total: { type: "integer" },
                    amountPaid: { type: "integer" },
                    amountDue: { type: "integer" },
                    notes: { type: "string" },
                    terms: { type: "string" },
                    customFields: { type: "object" },
                    createdBy: { type: "string", format: "uuid" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            InvoiceItem: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    invoiceId: { type: "string", format: "uuid" },
                    productId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    description: { type: "string" },
                    hsnCode: { type: "string" },
                    quantity: { type: "number" },
                    unit: { type: "string" },
                    rate: { type: "integer" },
                    discountType: { type: "string" },
                    discountValue: { type: "number" },
                    discountAmount: { type: "integer" },
                    taxRateId: { type: "string" },
                    taxRate: { type: "number" },
                    taxAmount: { type: "integer" },
                    taxComponents: { type: "object" },
                    amount: { type: "integer" },
                    sortOrder: { type: "integer" },
                },
            },
            CreateInvoice: {
                type: "object",
                required: ["clientId", "issueDate", "dueDate", "items"],
                properties: {
                    clientId: { type: "string", format: "uuid" },
                    issueDate: { type: "string", format: "date" },
                    dueDate: { type: "string", format: "date" },
                    currency: { type: "string" },
                    referenceNumber: { type: "string" },
                    discountType: { type: "string", enum: ["percentage", "fixed"] },
                    discountValue: { type: "number" },
                    notes: { type: "string" },
                    terms: { type: "string" },
                    customFields: { type: "object" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["name", "quantity", "rate"],
                            properties: {
                                productId: { type: "string" },
                                name: { type: "string" },
                                description: { type: "string" },
                                hsnCode: { type: "string" },
                                quantity: { type: "number" },
                                unit: { type: "string" },
                                rate: { type: "integer" },
                                discountType: { type: "string" },
                                discountValue: { type: "number" },
                                taxRateId: { type: "string" },
                            },
                        },
                    },
                },
            },
            // -- Quote --
            Quote: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    quoteNumber: { type: "string" },
                    status: {
                        type: "string",
                        enum: ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"],
                    },
                    issueDate: { type: "string", format: "date" },
                    expiryDate: { type: "string", format: "date" },
                    currency: { type: "string" },
                    subtotal: { type: "integer" },
                    discountAmount: { type: "integer" },
                    taxAmount: { type: "integer" },
                    total: { type: "integer" },
                    notes: { type: "string" },
                    terms: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            CreateQuote: {
                type: "object",
                required: ["clientId", "issueDate", "expiryDate", "items"],
                properties: {
                    clientId: { type: "string", format: "uuid" },
                    issueDate: { type: "string", format: "date" },
                    expiryDate: { type: "string", format: "date" },
                    currency: { type: "string" },
                    notes: { type: "string" },
                    terms: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["name", "quantity", "rate"],
                            properties: {
                                name: { type: "string" },
                                description: { type: "string" },
                                quantity: { type: "number" },
                                rate: { type: "integer" },
                                taxRateId: { type: "string" },
                            },
                        },
                    },
                },
            },
            // -- Payment --
            Payment: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    invoiceId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    amount: { type: "integer", description: "Amount in smallest currency unit" },
                    currency: { type: "string" },
                    method: {
                        type: "string",
                        enum: ["cash", "bank_transfer", "cheque", "upi", "card", "gateway", "other"],
                    },
                    referenceNumber: { type: "string" },
                    date: { type: "string", format: "date" },
                    notes: { type: "string" },
                    gatewayTransactionId: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            CreatePayment: {
                type: "object",
                required: ["invoiceId", "amount", "method", "date"],
                properties: {
                    invoiceId: { type: "string", format: "uuid" },
                    amount: { type: "integer" },
                    method: { type: "string" },
                    date: { type: "string", format: "date" },
                    referenceNumber: { type: "string" },
                    notes: { type: "string" },
                },
            },
            RefundRequest: {
                type: "object",
                required: ["amount"],
                properties: {
                    amount: { type: "integer" },
                    reason: { type: "string" },
                },
            },
            // -- Credit Note --
            CreditNote: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    creditNoteNumber: { type: "string" },
                    status: { type: "string", enum: ["draft", "open", "applied", "void"] },
                    invoiceId: { type: "string", format: "uuid" },
                    total: { type: "integer" },
                    balanceRemaining: { type: "integer" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            CreateCreditNote: {
                type: "object",
                required: ["clientId", "invoiceId", "items"],
                properties: {
                    clientId: { type: "string", format: "uuid" },
                    invoiceId: { type: "string", format: "uuid" },
                    notes: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["name", "quantity", "rate"],
                            properties: {
                                name: { type: "string" },
                                quantity: { type: "number" },
                                rate: { type: "integer" },
                            },
                        },
                    },
                },
            },
            ApplyCreditNote: {
                type: "object",
                required: ["invoiceId", "amount"],
                properties: {
                    invoiceId: { type: "string", format: "uuid" },
                    amount: { type: "integer" },
                },
            },
            // -- Expense --
            Expense: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    categoryId: { type: "string", format: "uuid" },
                    vendorName: { type: "string" },
                    date: { type: "string", format: "date" },
                    amount: { type: "integer", description: "Amount in smallest currency unit" },
                    currency: { type: "string" },
                    taxAmount: { type: "integer" },
                    description: { type: "string" },
                    isBillable: { type: "boolean" },
                    clientId: { type: "string", format: "uuid" },
                    invoiceId: { type: "string", format: "uuid" },
                    status: { type: "string", enum: ["pending", "approved", "rejected", "billed"] },
                    approvedBy: { type: "string", format: "uuid" },
                    tags: { type: "array", items: { type: "string" } },
                    createdBy: { type: "string", format: "uuid" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            CreateExpense: {
                type: "object",
                required: ["categoryId", "date", "amount", "description"],
                properties: {
                    categoryId: { type: "string", format: "uuid" },
                    vendorName: { type: "string" },
                    date: { type: "string", format: "date" },
                    amount: { type: "integer" },
                    currency: { type: "string" },
                    taxAmount: { type: "integer" },
                    description: { type: "string" },
                    isBillable: { type: "boolean" },
                    clientId: { type: "string", format: "uuid" },
                    tags: { type: "array", items: { type: "string" } },
                },
            },
            ExpenseCategory: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    description: { type: "string" },
                    isActive: { type: "boolean" },
                },
            },
            OCRResult: {
                type: "object",
                properties: {
                    merchantName: { type: "string" },
                    date: { type: "string" },
                    total: { type: "integer", description: "Amount in smallest currency unit" },
                    currency: { type: "string" },
                    lineItems: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                description: { type: "string" },
                                amount: { type: "integer" },
                            },
                        },
                    },
                    rawText: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                },
            },
            // -- Vendor --
            Vendor: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    company: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            // -- Recurring Profile --
            RecurringProfile: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly", "custom"] },
                    startDate: { type: "string", format: "date" },
                    endDate: { type: "string", format: "date" },
                    maxOccurrences: { type: "integer" },
                    status: { type: "string", enum: ["active", "paused", "completed", "cancelled"] },
                    nextRunDate: { type: "string", format: "date" },
                    autoSend: { type: "boolean" },
                    autoCharge: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Webhook --
            Webhook: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    url: { type: "string", format: "uri" },
                    events: { type: "array", items: { type: "string" } },
                    secret: { type: "string" },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            CreateWebhook: {
                type: "object",
                required: ["url", "events"],
                properties: {
                    url: { type: "string", format: "uri" },
                    events: { type: "array", items: { type: "string" } },
                    secret: { type: "string" },
                },
            },
            // -- Dispute --
            Dispute: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    invoiceId: { type: "string", format: "uuid" },
                    reason: { type: "string" },
                    status: { type: "string", enum: ["open", "under_review", "resolved", "rejected"] },
                    resolution: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            // -- Subscription --
            Plan: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    code: { type: "string" },
                    amount: { type: "integer" },
                    currency: { type: "string" },
                    interval: { type: "string", enum: ["monthly", "yearly"] },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Subscription: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    clientId: { type: "string", format: "uuid" },
                    planId: { type: "string", format: "uuid" },
                    status: {
                        type: "string",
                        enum: ["active", "paused", "cancelled", "past_due", "trialing"],
                    },
                    currentPeriodStart: { type: "string", format: "date" },
                    currentPeriodEnd: { type: "string", format: "date" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Coupon --
            Coupon: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    code: { type: "string" },
                    discountType: { type: "string", enum: ["percentage", "fixed"] },
                    discountValue: { type: "number" },
                    maxRedemptions: { type: "integer" },
                    timesRedeemed: { type: "integer" },
                    validFrom: { type: "string", format: "date" },
                    validUntil: { type: "string", format: "date" },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Notification --
            Notification: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    userId: { type: "string", format: "uuid" },
                    type: { type: "string" },
                    title: { type: "string" },
                    message: { type: "string" },
                    isRead: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Dunning --
            DunningConfig: {
                type: "object",
                properties: {
                    maxAttempts: { type: "integer" },
                    retryIntervalDays: { type: "array", items: { type: "integer" } },
                    finalAction: { type: "string", enum: ["cancel", "pause", "none"] },
                },
            },
            // -- Metrics --
            MRR: {
                type: "object",
                properties: {
                    mrr: { type: "integer" },
                    growth: { type: "number" },
                    newMrr: { type: "integer" },
                    churnedMrr: { type: "integer" },
                },
            },
            // -- Upload --
            UploadedFile: {
                type: "object",
                properties: {
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    mimeType: { type: "string" },
                    size: { type: "integer" },
                    url: { type: "string" },
                },
            },
            // -- Audit Log --
            AuditLog: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    userId: { type: "string", format: "uuid" },
                    action: { type: "string" },
                    entity: { type: "string" },
                    entityId: { type: "string" },
                    changes: { type: "object" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            // -- Scheduled Report --
            ScheduledReport: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    orgId: { type: "string", format: "uuid" },
                    reportType: { type: "string" },
                    frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
                    recipients: { type: "array", items: { type: "string" } },
                    isActive: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
        },
    },
    // ── Default Security ────────────────────────────────────────────────────
    security: [{ BearerAuth: [] }],
    // ── Tags ────────────────────────────────────────────────────────────────
    tags: [
        { name: "Auth", description: "Authentication and user management" },
        { name: "Organizations", description: "Organization settings, team, and audit logs" },
        { name: "Clients", description: "Client / customer management" },
        { name: "Products", description: "Product and service catalog, tax rates" },
        { name: "Invoices", description: "Invoice CRUD, PDF generation, bulk actions" },
        { name: "Quotes", description: "Quote / estimate management" },
        { name: "Payments", description: "Payment recording, refunds, receipts" },
        { name: "Credit Notes", description: "Credit note management" },
        { name: "Vendors", description: "Vendor management" },
        { name: "Expenses", description: "Expense tracking, categories, OCR receipt scanning" },
        { name: "Recurring", description: "Recurring invoice profiles" },
        { name: "Reports", description: "Revenue, receivables, tax, expense reports" },
        { name: "Disputes", description: "Invoice dispute management" },
        { name: "Portal", description: "Client portal — invoices, quotes, payments, disputes" },
        { name: "Webhooks", description: "Webhook subscription and delivery management" },
        { name: "Settings", description: "Organization settings, branding, numbering, email templates" },
        { name: "Currency", description: "Exchange rates and currency conversion" },
        { name: "Uploads", description: "File uploads — receipts, attachments" },
        { name: "Search", description: "Global search across entities" },
        { name: "Notifications", description: "User notifications" },
        { name: "Scheduled Reports", description: "Automated scheduled report delivery" },
        { name: "Subscriptions", description: "Subscription and plan management" },
        { name: "Usage", description: "Usage-based billing records" },
        { name: "Coupons", description: "Coupon / discount code management" },
        { name: "Dunning", description: "Failed payment retry management" },
        { name: "Metrics", description: "SaaS metrics — MRR, ARR, churn, LTV, cohort analysis" },
        { name: "Gateway Webhooks", description: "Payment gateway webhook handlers (Stripe, Razorpay)" },
    ],
    // ── Paths ───────────────────────────────────────────────────────────────
    paths: {
        // ═══════════════════════════════════════════════════════════════════════
        // AUTH
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/auth/register": {
            post: {
                tags: ["Auth"],
                summary: "Register a new user and organization",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
                },
                responses: {
                    201: { description: "User registered successfully", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] } } } },
                    422: { description: "Validation error" },
                    409: { description: "Email already registered" },
                },
            },
        },
        "/api/v1/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Login with email and password",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
                },
                responses: {
                    200: { description: "Login successful", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] } } } },
                    401: { description: "Invalid credentials" },
                },
            },
        },
        "/api/v1/auth/refresh": {
            post: {
                tags: ["Auth"],
                summary: "Refresh access token using refresh token cookie",
                security: [],
                responses: {
                    200: { description: "Token refreshed", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] } } } },
                    401: { description: "Invalid or expired refresh token" },
                },
            },
        },
        "/api/v1/auth/logout": {
            post: {
                tags: ["Auth"],
                summary: "Logout and invalidate refresh token",
                security: [],
                responses: {
                    200: { description: "Logged out successfully" },
                },
            },
        },
        "/api/v1/auth/forgot-password": {
            post: {
                tags: ["Auth"],
                summary: "Request a password reset email",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordRequest" } } },
                },
                responses: {
                    200: { description: "Reset email sent (if account exists)" },
                },
            },
        },
        "/api/v1/auth/reset-password": {
            post: {
                tags: ["Auth"],
                summary: "Reset password using token from email",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordRequest" } } },
                },
                responses: {
                    200: { description: "Password reset successfully" },
                    400: { description: "Invalid or expired token" },
                },
            },
        },
        "/api/v1/auth/change-password": {
            post: {
                tags: ["Auth"],
                summary: "Change password (authenticated)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } },
                },
                responses: {
                    200: { description: "Password changed successfully" },
                    400: { description: "Current password incorrect" },
                },
            },
        },
        "/api/v1/auth/me": {
            get: {
                tags: ["Auth"],
                summary: "Get current authenticated user",
                responses: {
                    200: { description: "Current user", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/User" } } }] } } } },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // ORGANIZATIONS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/organizations": {
            get: {
                tags: ["Organizations"],
                summary: "Get current organization",
                responses: {
                    200: { description: "Organization details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Organization" } } }] } } } },
                },
            },
            put: {
                tags: ["Organizations"],
                summary: "Update organization settings (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateOrganization" } } },
                },
                responses: {
                    200: { description: "Organization updated" },
                },
            },
        },
        "/api/v1/organizations/audit-logs": {
            get: {
                tags: ["Organizations"],
                summary: "List audit logs (Admin)",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Audit logs list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
        },
        "/api/v1/organizations/members": {
            get: {
                tags: ["Organizations"],
                summary: "List team members",
                responses: {
                    200: { description: "Team members list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/User" } } } }] } } } },
                },
            },
            post: {
                tags: ["Organizations"],
                summary: "Invite a team member (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/InviteUserRequest" } } },
                },
                responses: {
                    201: { description: "Invitation sent" },
                },
            },
        },
        "/api/v1/organizations/members/{userId}/role": {
            put: {
                tags: ["Organizations"],
                summary: "Update a member's role (Admin)",
                parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRoleRequest" } } },
                },
                responses: {
                    200: { description: "Role updated" },
                },
            },
        },
        "/api/v1/organizations/members/{userId}": {
            delete: {
                tags: ["Organizations"],
                summary: "Remove a team member (Admin)",
                parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Member removed" },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // CLIENTS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/clients": {
            get: {
                tags: ["Clients"],
                summary: "List clients",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "search", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "Paginated client list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Client" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Clients"],
                summary: "Create a client (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClient" } } },
                },
                responses: {
                    201: { description: "Client created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" } } }] } } } },
                },
            },
        },
        "/api/v1/clients/export/csv": {
            get: {
                tags: ["Clients"],
                summary: "Export clients to CSV (Sales+)",
                responses: {
                    200: { description: "CSV file download", content: { "text/csv": { schema: { type: "string" } } } },
                },
            },
        },
        "/api/v1/clients/import/csv": {
            post: {
                tags: ["Clients"],
                summary: "Import clients from CSV (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
                },
                responses: {
                    200: { description: "Import result with success and error counts" },
                },
            },
        },
        "/api/v1/clients/{id}": {
            get: {
                tags: ["Clients"],
                summary: "Get a client by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Client details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" } } }] } } } },
                    404: { description: "Client not found" },
                },
            },
            put: {
                tags: ["Clients"],
                summary: "Update a client (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClient" } } },
                },
                responses: {
                    200: { description: "Client updated" },
                },
            },
            delete: {
                tags: ["Clients"],
                summary: "Delete a client (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Client deleted" },
                },
            },
        },
        "/api/v1/clients/{id}/contacts": {
            get: {
                tags: ["Clients"],
                summary: "List contacts for a client",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Contact list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ClientContact" } } } }] } } } },
                },
            },
            post: {
                tags: ["Clients"],
                summary: "Add a contact to a client (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ClientContact" } } },
                },
                responses: {
                    201: { description: "Contact added" },
                },
            },
        },
        "/api/v1/clients/{id}/statement": {
            get: {
                tags: ["Clients"],
                summary: "Get client statement",
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: {
                    200: { description: "Client statement with transactions" },
                },
            },
        },
        "/api/v1/clients/{id}/balance": {
            get: {
                tags: ["Clients"],
                summary: "Get client balance",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Client balance details" },
                },
            },
        },
        "/api/v1/clients/{id}/payment-method": {
            put: {
                tags: ["Clients"],
                summary: "Update client payment method (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { gatewayId: { type: "string" }, token: { type: "string" } } } } },
                },
                responses: { 200: { description: "Payment method updated" } },
            },
            delete: {
                tags: ["Clients"],
                summary: "Remove client payment method (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Payment method removed" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // PRODUCTS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/products": {
            get: {
                tags: ["Products"],
                summary: "List products",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "type", in: "query", schema: { type: "string", enum: ["goods", "services"] } },
                ],
                responses: {
                    200: { description: "Paginated product list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Product" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Products"],
                summary: "Create a product (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProduct" } } },
                },
                responses: {
                    201: { description: "Product created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Product" } } }] } } } },
                },
            },
        },
        "/api/v1/products/export/csv": {
            get: {
                tags: ["Products"],
                summary: "Export products to CSV",
                responses: { 200: { description: "CSV file download", content: { "text/csv": { schema: { type: "string" } } } } },
            },
        },
        "/api/v1/products/import/csv": {
            post: {
                tags: ["Products"],
                summary: "Import products from CSV (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
                },
                responses: { 200: { description: "Import result" } },
            },
        },
        "/api/v1/products/{id}": {
            get: {
                tags: ["Products"],
                summary: "Get a product by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Product details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Product" } } }] } } } },
                    404: { description: "Product not found" },
                },
            },
            put: {
                tags: ["Products"],
                summary: "Update a product (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProduct" } } },
                },
                responses: { 200: { description: "Product updated" } },
            },
            delete: {
                tags: ["Products"],
                summary: "Delete a product (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Product deleted" } },
            },
        },
        "/api/v1/products/tax-rates": {
            get: {
                tags: ["Products"],
                summary: "List tax rates",
                responses: {
                    200: { description: "Tax rate list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/TaxRate" } } } }] } } } },
                },
            },
            post: {
                tags: ["Products"],
                summary: "Create a tax rate (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["name", "rate"], properties: { name: { type: "string" }, rate: { type: "number" }, type: { type: "string" }, isCompound: { type: "boolean" } } } } },
                },
                responses: { 201: { description: "Tax rate created" } },
            },
        },
        "/api/v1/products/tax-rates/{id}": {
            put: {
                tags: ["Products"],
                summary: "Update a tax rate (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, rate: { type: "number" }, isCompound: { type: "boolean" } } } } },
                },
                responses: { 200: { description: "Tax rate updated" } },
            },
            delete: {
                tags: ["Products"],
                summary: "Delete a tax rate (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Tax rate deleted" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // INVOICES
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/invoices": {
            get: {
                tags: ["Invoices"],
                summary: "List invoices",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "status", in: "query", schema: { type: "string" } },
                    { name: "clientId", in: "query", schema: { type: "string" } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: {
                    200: { description: "Paginated invoice list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Invoice" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Invoices"],
                summary: "Create an invoice (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoice" } } },
                },
                responses: {
                    201: { description: "Invoice created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
                },
            },
        },
        "/api/v1/invoices/bulk-pdf": {
            post: {
                tags: ["Invoices"],
                summary: "Bulk download invoices as PDF",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string", format: "uuid" } } } } } },
                },
                responses: {
                    200: { description: "ZIP file containing invoice PDFs", content: { "application/zip": { schema: { type: "string", format: "binary" } } } },
                },
            },
        },
        "/api/v1/invoices/{id}": {
            get: {
                tags: ["Invoices"],
                summary: "Get an invoice by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Invoice with items", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { allOf: [{ $ref: "#/components/schemas/Invoice" }, { properties: { items: { type: "array", items: { $ref: "#/components/schemas/InvoiceItem" } } } }] } } }] } } } },
                    404: { description: "Invoice not found" },
                },
            },
            put: {
                tags: ["Invoices"],
                summary: "Update an invoice (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoice" } } },
                },
                responses: { 200: { description: "Invoice updated" } },
            },
            delete: {
                tags: ["Invoices"],
                summary: "Delete an invoice (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Invoice deleted" } },
            },
        },
        "/api/v1/invoices/{id}/send": {
            post: {
                tags: ["Invoices"],
                summary: "Send an invoice to client via email (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Invoice sent" } },
            },
        },
        "/api/v1/invoices/{id}/duplicate": {
            post: {
                tags: ["Invoices"],
                summary: "Duplicate an invoice (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    201: { description: "Duplicated invoice", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
                },
            },
        },
        "/api/v1/invoices/{id}/void": {
            post: {
                tags: ["Invoices"],
                summary: "Void an invoice (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Invoice voided" } },
            },
        },
        "/api/v1/invoices/{id}/write-off": {
            post: {
                tags: ["Invoices"],
                summary: "Write off an invoice (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Invoice written off" } },
            },
        },
        "/api/v1/invoices/{id}/pdf": {
            get: {
                tags: ["Invoices"],
                summary: "Download invoice as PDF",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
                },
            },
        },
        "/api/v1/invoices/{id}/payments": {
            get: {
                tags: ["Invoices"],
                summary: "List payments for an invoice",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Payment list for invoice", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Payment" } } } }] } } } },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // QUOTES
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/quotes": {
            get: {
                tags: ["Quotes"],
                summary: "List quotes",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "status", in: "query", schema: { type: "string" } },
                    { name: "clientId", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "Paginated quote list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Quote" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Quotes"],
                summary: "Create a quote (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateQuote" } } },
                },
                responses: { 201: { description: "Quote created" } },
            },
        },
        "/api/v1/quotes/{id}": {
            get: {
                tags: ["Quotes"],
                summary: "Get a quote by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Quote details" },
                    404: { description: "Quote not found" },
                },
            },
            put: {
                tags: ["Quotes"],
                summary: "Update a quote (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateQuote" } } },
                },
                responses: { 200: { description: "Quote updated" } },
            },
            delete: {
                tags: ["Quotes"],
                summary: "Delete a quote (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote deleted" } },
            },
        },
        "/api/v1/quotes/{id}/send": {
            post: {
                tags: ["Quotes"],
                summary: "Send a quote to client (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote sent" } },
            },
        },
        "/api/v1/quotes/{id}/convert": {
            post: {
                tags: ["Quotes"],
                summary: "Convert a quote to an invoice (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    201: { description: "Invoice created from quote", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
                },
            },
        },
        "/api/v1/quotes/{id}/pdf": {
            get: {
                tags: ["Quotes"],
                summary: "Download quote as PDF",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
                },
            },
        },
        "/api/v1/quotes/{id}/accept": {
            post: {
                tags: ["Quotes"],
                summary: "Accept a quote",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote accepted" } },
            },
        },
        "/api/v1/quotes/{id}/decline": {
            post: {
                tags: ["Quotes"],
                summary: "Decline a quote",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote declined" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // PAYMENTS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/payments": {
            get: {
                tags: ["Payments"],
                summary: "List payments",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "clientId", in: "query", schema: { type: "string" } },
                    { name: "method", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "Paginated payment list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Payment" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Payments"],
                summary: "Record a payment (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreatePayment" } } },
                },
                responses: { 201: { description: "Payment recorded" } },
            },
        },
        "/api/v1/payments/{id}": {
            get: {
                tags: ["Payments"],
                summary: "Get a payment by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Payment details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Payment" } } }] } } } },
                },
            },
            delete: {
                tags: ["Payments"],
                summary: "Delete a payment (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Payment deleted" } },
            },
        },
        "/api/v1/payments/{id}/refund": {
            post: {
                tags: ["Payments"],
                summary: "Refund a payment (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/RefundRequest" } } },
                },
                responses: { 200: { description: "Payment refunded" } },
            },
        },
        "/api/v1/payments/{id}/receipt": {
            get: {
                tags: ["Payments"],
                summary: "Download payment receipt PDF",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Receipt PDF", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // CREDIT NOTES
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/credit-notes": {
            get: {
                tags: ["Credit Notes"],
                summary: "List credit notes",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Paginated credit note list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/CreditNote" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Credit Notes"],
                summary: "Create a credit note (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCreditNote" } } },
                },
                responses: { 201: { description: "Credit note created" } },
            },
        },
        "/api/v1/credit-notes/{id}": {
            get: {
                tags: ["Credit Notes"],
                summary: "Get a credit note by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Credit note details" }, 404: { description: "Not found" } },
            },
            delete: {
                tags: ["Credit Notes"],
                summary: "Delete a credit note (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Credit note deleted" } },
            },
        },
        "/api/v1/credit-notes/{id}/apply": {
            post: {
                tags: ["Credit Notes"],
                summary: "Apply a credit note to an invoice (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ApplyCreditNote" } } },
                },
                responses: { 200: { description: "Credit note applied" } },
            },
        },
        "/api/v1/credit-notes/{id}/void": {
            post: {
                tags: ["Credit Notes"],
                summary: "Void a credit note (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Credit note voided" } },
            },
        },
        "/api/v1/credit-notes/{id}/pdf": {
            get: {
                tags: ["Credit Notes"],
                summary: "Download credit note as PDF",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // VENDORS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/vendors": {
            get: {
                tags: ["Vendors"],
                summary: "List vendors",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Paginated vendor list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Vendor" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Vendors"],
                summary: "Create a vendor (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" } } } } },
                },
                responses: { 201: { description: "Vendor created" } },
            },
        },
        "/api/v1/vendors/{id}": {
            get: {
                tags: ["Vendors"],
                summary: "Get a vendor by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Vendor details" }, 404: { description: "Not found" } },
            },
            put: {
                tags: ["Vendors"],
                summary: "Update a vendor (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" } } } } },
                },
                responses: { 200: { description: "Vendor updated" } },
            },
            delete: {
                tags: ["Vendors"],
                summary: "Delete a vendor (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Vendor deleted" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // EXPENSES
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/expenses/categories": {
            get: {
                tags: ["Expenses"],
                summary: "List expense categories",
                responses: {
                    200: { description: "Category list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ExpenseCategory" } } } }] } } } },
                },
            },
            post: {
                tags: ["Expenses"],
                summary: "Create an expense category (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } } } } },
                },
                responses: { 201: { description: "Category created" } },
            },
        },
        "/api/v1/expenses": {
            get: {
                tags: ["Expenses"],
                summary: "List expenses",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "categoryId", in: "query", schema: { type: "string" } },
                    { name: "clientId", in: "query", schema: { type: "string" } },
                    { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected", "billed"] } },
                    { name: "isBillable", in: "query", schema: { type: "boolean" } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: {
                    200: { description: "Paginated expense list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Expense" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Expenses"],
                summary: "Create an expense (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExpense" } } },
                },
                responses: { 201: { description: "Expense created" } },
            },
        },
        "/api/v1/expenses/{id}": {
            get: {
                tags: ["Expenses"],
                summary: "Get an expense by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: { description: "Expense details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Expense" } } }] } } } },
                    404: { description: "Expense not found" },
                },
            },
            put: {
                tags: ["Expenses"],
                summary: "Update an expense (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExpense" } } },
                },
                responses: { 200: { description: "Expense updated" } },
            },
            delete: {
                tags: ["Expenses"],
                summary: "Delete an expense (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Expense deleted" } },
            },
        },
        "/api/v1/expenses/{id}/approve": {
            post: {
                tags: ["Expenses"],
                summary: "Approve an expense (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Expense approved" } },
            },
        },
        "/api/v1/expenses/{id}/reject": {
            post: {
                tags: ["Expenses"],
                summary: "Reject an expense (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Expense rejected" } },
            },
        },
        "/api/v1/expenses/{id}/bill": {
            post: {
                tags: ["Expenses"],
                summary: "Bill an expense to client, creating an invoice (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: {
                    200: {
                        description: "Expense billed — returns expense and created invoice",
                        content: {
                            "application/json": {
                                schema: {
                                    allOf: [
                                        { $ref: "#/components/schemas/ApiResponse" },
                                        {
                                            properties: {
                                                data: {
                                                    type: "object",
                                                    properties: {
                                                        expense: { $ref: "#/components/schemas/Expense" },
                                                        invoice: { $ref: "#/components/schemas/Invoice" },
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // RECURRING
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/recurring": {
            get: {
                tags: ["Recurring"],
                summary: "List recurring profiles",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Paginated recurring profile list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/RecurringProfile" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Recurring"],
                summary: "Create a recurring profile (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["clientId", "frequency", "startDate", "items"], properties: { clientId: { type: "string" }, frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly", "custom"] }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, maxOccurrences: { type: "integer" }, autoSend: { type: "boolean" }, autoCharge: { type: "boolean" }, items: { type: "array", items: { type: "object" } } } } } },
                },
                responses: { 201: { description: "Recurring profile created" } },
            },
        },
        "/api/v1/recurring/{id}": {
            get: {
                tags: ["Recurring"],
                summary: "Get a recurring profile",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Recurring profile details" }, 404: { description: "Not found" } },
            },
            put: {
                tags: ["Recurring"],
                summary: "Update a recurring profile (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object" } } },
                },
                responses: { 200: { description: "Profile updated" } },
            },
            delete: {
                tags: ["Recurring"],
                summary: "Delete a recurring profile (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Profile deleted" } },
            },
        },
        "/api/v1/recurring/{id}/pause": {
            post: {
                tags: ["Recurring"],
                summary: "Pause a recurring profile (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Profile paused" } },
            },
        },
        "/api/v1/recurring/{id}/resume": {
            post: {
                tags: ["Recurring"],
                summary: "Resume a recurring profile (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Profile resumed" } },
            },
        },
        "/api/v1/recurring/{id}/executions": {
            get: {
                tags: ["Recurring"],
                summary: "List execution history for a recurring profile",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Execution history" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // REPORTS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/reports/dashboard": {
            get: {
                tags: ["Reports"],
                summary: "Get dashboard statistics",
                responses: { 200: { description: "Dashboard stats: revenue, outstanding, overdue, recent activity" } },
            },
        },
        "/api/v1/reports/revenue": {
            get: {
                tags: ["Reports"],
                summary: "Revenue report",
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Revenue report data" } },
            },
        },
        "/api/v1/reports/receivables": {
            get: {
                tags: ["Reports"],
                summary: "Receivables report",
                responses: { 200: { description: "Receivables data" } },
            },
        },
        "/api/v1/reports/aging": {
            get: {
                tags: ["Reports"],
                summary: "Receivables aging report (current, 1-30, 31-60, 61-90, 90+)",
                responses: { 200: { description: "Aging data" } },
            },
        },
        "/api/v1/reports/expenses": {
            get: {
                tags: ["Reports"],
                summary: "Expense report",
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Expense report data" } },
            },
        },
        "/api/v1/reports/profit-loss": {
            get: {
                tags: ["Reports"],
                summary: "Profit & loss report",
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "P&L data" } },
            },
        },
        "/api/v1/reports/tax": {
            get: {
                tags: ["Reports"],
                summary: "Tax report (GST, VAT, sales tax summary)",
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Tax report data" } },
            },
        },
        "/api/v1/reports/clients/top": {
            get: {
                tags: ["Reports"],
                summary: "Top clients by revenue",
                responses: { 200: { description: "Top clients list" } },
            },
        },
        "/api/v1/reports/revenue/export": {
            get: {
                tags: ["Reports"],
                summary: "Export revenue report as CSV",
                responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
            },
        },
        "/api/v1/reports/receivables/export": {
            get: {
                tags: ["Reports"],
                summary: "Export receivables report as CSV",
                responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
            },
        },
        "/api/v1/reports/expenses/export": {
            get: {
                tags: ["Reports"],
                summary: "Export expense report as CSV",
                responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
            },
        },
        "/api/v1/reports/tax/export": {
            get: {
                tags: ["Reports"],
                summary: "Export tax report as CSV",
                responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // DISPUTES
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/disputes": {
            get: {
                tags: ["Disputes"],
                summary: "List disputes (admin view)",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "status", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "Dispute list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Dispute" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
        },
        "/api/v1/disputes/{id}": {
            get: {
                tags: ["Disputes"],
                summary: "Get a dispute by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Dispute details" }, 404: { description: "Not found" } },
            },
            put: {
                tags: ["Disputes"],
                summary: "Update a dispute (resolve/reject)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["under_review", "resolved", "rejected"] }, resolution: { type: "string" } } } } },
                },
                responses: { 200: { description: "Dispute updated" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // PORTAL
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/portal/login": {
            post: {
                tags: ["Portal"],
                summary: "Client portal login",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } } } },
                },
                responses: { 200: { description: "Portal login successful" }, 401: { description: "Invalid credentials" } },
            },
        },
        "/api/v1/portal/dashboard": {
            get: {
                tags: ["Portal"],
                summary: "Client portal dashboard",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Portal dashboard data" } },
            },
        },
        "/api/v1/portal/invoices": {
            get: {
                tags: ["Portal"],
                summary: "List client invoices (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's invoice list" } },
            },
        },
        "/api/v1/portal/invoices/{id}": {
            get: {
                tags: ["Portal"],
                summary: "Get a single invoice (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Invoice details" } },
            },
        },
        "/api/v1/portal/invoices/{id}/pdf": {
            get: {
                tags: ["Portal"],
                summary: "Download invoice PDF (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } } },
            },
        },
        "/api/v1/portal/quotes": {
            get: {
                tags: ["Portal"],
                summary: "List client quotes (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's quote list" } },
            },
        },
        "/api/v1/portal/quotes/{id}/accept": {
            post: {
                tags: ["Portal"],
                summary: "Accept a quote (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote accepted" } },
            },
        },
        "/api/v1/portal/quotes/{id}/decline": {
            post: {
                tags: ["Portal"],
                summary: "Decline a quote (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Quote declined" } },
            },
        },
        "/api/v1/portal/credit-notes": {
            get: {
                tags: ["Portal"],
                summary: "List credit notes (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's credit notes" } },
            },
        },
        "/api/v1/portal/payments": {
            get: {
                tags: ["Portal"],
                summary: "List payments (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's payment list" } },
            },
        },
        "/api/v1/portal/statement": {
            get: {
                tags: ["Portal"],
                summary: "Get client statement (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Client statement" } },
            },
        },
        "/api/v1/portal/disputes": {
            get: {
                tags: ["Portal"],
                summary: "List disputes (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's disputes" } },
            },
            post: {
                tags: ["Portal"],
                summary: "Create a dispute (portal)",
                security: [{ PortalAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["invoiceId", "reason"], properties: { invoiceId: { type: "string" }, reason: { type: "string" } } } } },
                },
                responses: { 201: { description: "Dispute created" } },
            },
        },
        "/api/v1/portal/disputes/{id}": {
            get: {
                tags: ["Portal"],
                summary: "Get a dispute (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Dispute details" } },
            },
        },
        "/api/v1/portal/subscriptions": {
            get: {
                tags: ["Portal"],
                summary: "List subscriptions (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Client's subscriptions" } },
            },
        },
        "/api/v1/portal/subscriptions/{id}": {
            get: {
                tags: ["Portal"],
                summary: "Get a subscription (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription details" } },
            },
        },
        "/api/v1/portal/subscriptions/{id}/change-plan": {
            post: {
                tags: ["Portal"],
                summary: "Change subscription plan (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["planId"], properties: { planId: { type: "string" } } } } },
                },
                responses: { 200: { description: "Plan changed" } },
            },
        },
        "/api/v1/portal/subscriptions/{id}/cancel": {
            post: {
                tags: ["Portal"],
                summary: "Cancel a subscription (portal)",
                security: [{ PortalAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription cancelled" } },
            },
        },
        "/api/v1/portal/plans": {
            get: {
                tags: ["Portal"],
                summary: "List available plans (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Available plans" } },
            },
        },
        "/api/v1/portal/payment-method": {
            get: {
                tags: ["Portal"],
                summary: "Get saved payment method (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Payment method details" } },
            },
            put: {
                tags: ["Portal"],
                summary: "Update payment method (portal)",
                security: [{ PortalAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { gatewayId: { type: "string" }, token: { type: "string" } } } } },
                },
                responses: { 200: { description: "Payment method updated" } },
            },
            delete: {
                tags: ["Portal"],
                summary: "Remove payment method (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Payment method removed" } },
            },
        },
        "/api/v1/portal/payment-gateways": {
            get: {
                tags: ["Portal"],
                summary: "List available payment gateways (portal)",
                security: [{ PortalAuth: [] }],
                responses: { 200: { description: "Gateway list" } },
            },
        },
        "/api/v1/portal/pay": {
            post: {
                tags: ["Portal"],
                summary: "Create a payment order (portal)",
                security: [{ PortalAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["invoiceId", "gatewayId"], properties: { invoiceId: { type: "string" }, gatewayId: { type: "string" }, amount: { type: "integer" } } } } },
                },
                responses: { 200: { description: "Payment order created with gateway-specific data" } },
            },
        },
        "/api/v1/portal/verify-payment": {
            post: {
                tags: ["Portal"],
                summary: "Verify a payment after gateway redirect (portal)",
                security: [{ PortalAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { orderId: { type: "string" }, gatewayId: { type: "string" }, paymentData: { type: "object" } } } } },
                },
                responses: { 200: { description: "Payment verified" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // WEBHOOKS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/webhooks": {
            get: {
                tags: ["Webhooks"],
                summary: "List webhook subscriptions",
                responses: {
                    200: { description: "Webhook list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } } } }] } } } },
                },
            },
            post: {
                tags: ["Webhooks"],
                summary: "Create a webhook (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWebhook" } } },
                },
                responses: { 201: { description: "Webhook created" } },
            },
        },
        "/api/v1/webhooks/{id}": {
            put: {
                tags: ["Webhooks"],
                summary: "Update a webhook (Admin)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWebhook" } } },
                },
                responses: { 200: { description: "Webhook updated" } },
            },
            delete: {
                tags: ["Webhooks"],
                summary: "Delete a webhook (Admin)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Webhook deleted" } },
            },
        },
        "/api/v1/webhooks/{id}/test": {
            post: {
                tags: ["Webhooks"],
                summary: "Send a test event to a webhook (Admin)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Test event sent" } },
            },
        },
        "/api/v1/webhooks/{id}/deliveries": {
            get: {
                tags: ["Webhooks"],
                summary: "List delivery logs for a webhook",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Delivery log list" } },
            },
        },
        "/api/v1/webhooks/{id}/deliveries/{deliveryId}/retry": {
            post: {
                tags: ["Webhooks"],
                summary: "Retry a failed webhook delivery (Admin)",
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    { name: "deliveryId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                ],
                responses: { 200: { description: "Retry queued" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // SETTINGS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/settings": {
            get: {
                tags: ["Settings"],
                summary: "Get organization settings",
                responses: { 200: { description: "Settings object" } },
            },
            put: {
                tags: ["Settings"],
                summary: "Update organization settings (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateOrganization" } } },
                },
                responses: { 200: { description: "Settings updated" } },
            },
        },
        "/api/v1/settings/branding": {
            put: {
                tags: ["Settings"],
                summary: "Update branding (logo, colors) (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { logoUrl: { type: "string" }, primaryColor: { type: "string" }, accentColor: { type: "string" } } } } },
                },
                responses: { 200: { description: "Branding updated" } },
            },
        },
        "/api/v1/settings/numbering": {
            get: {
                tags: ["Settings"],
                summary: "Get invoice/quote numbering configuration",
                responses: { 200: { description: "Numbering config" } },
            },
            put: {
                tags: ["Settings"],
                summary: "Update numbering configuration (Admin)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { invoicePrefix: { type: "string" }, quotePrefix: { type: "string" }, creditNotePrefix: { type: "string" }, nextInvoiceNumber: { type: "integer" } } } } },
                },
                responses: { 200: { description: "Numbering updated" } },
            },
        },
        "/api/v1/settings/email-templates": {
            get: {
                tags: ["Settings"],
                summary: "List email templates",
                responses: { 200: { description: "Email template list" } },
            },
        },
        "/api/v1/settings/email-templates/{name}": {
            put: {
                tags: ["Settings"],
                summary: "Update an email template (Admin)",
                parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } } } } },
                },
                responses: { 200: { description: "Template updated" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // CURRENCY
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/currency/rates": {
            get: {
                tags: ["Currency"],
                summary: "Get current exchange rates",
                responses: { 200: { description: "Exchange rate map" } },
            },
        },
        "/api/v1/currency/convert": {
            post: {
                tags: ["Currency"],
                summary: "Convert an amount between currencies",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["amount", "from", "to"], properties: { amount: { type: "integer" }, from: { type: "string" }, to: { type: "string" } } } } },
                },
                responses: { 200: { description: "Converted amount" } },
            },
        },
        "/api/v1/currency/currencies": {
            get: {
                tags: ["Currency"],
                summary: "List supported currencies",
                responses: { 200: { description: "Currency list" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // UPLOADS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/uploads": {
            post: {
                tags: ["Uploads"],
                summary: "Upload a general file",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
                },
                responses: {
                    200: { description: "File uploaded", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/UploadedFile" } } }] } } } },
                    400: { description: "No file uploaded" },
                },
            },
        },
        "/api/v1/uploads/receipts": {
            post: {
                tags: ["Uploads"],
                summary: "Upload a receipt image (for expense OCR scanning)",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
                },
                responses: {
                    200: { description: "Receipt uploaded", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/UploadedFile" } } }] } } } },
                },
            },
        },
        "/api/v1/uploads/attachments": {
            post: {
                tags: ["Uploads"],
                summary: "Upload an invoice attachment",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
                },
                responses: {
                    200: { description: "Attachment uploaded", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/UploadedFile" } } }] } } } },
                },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // SEARCH
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/search": {
            get: {
                tags: ["Search"],
                summary: "Global search across invoices, clients, quotes, payments",
                parameters: [
                    { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Search query" },
                    { name: "type", in: "query", schema: { type: "string", enum: ["invoice", "client", "quote", "payment", "expense"] } },
                ],
                responses: { 200: { description: "Search results grouped by entity type" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // NOTIFICATIONS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/notifications": {
            get: {
                tags: ["Notifications"],
                summary: "List notifications for current user",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Notification list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Notification" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
        },
        "/api/v1/notifications/unread-count": {
            get: {
                tags: ["Notifications"],
                summary: "Get unread notification count",
                responses: { 200: { description: "Unread count", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "object", properties: { count: { type: "integer" } } } } }] } } } } },
            },
        },
        "/api/v1/notifications/{id}/read": {
            put: {
                tags: ["Notifications"],
                summary: "Mark a notification as read",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Notification marked as read" } },
            },
        },
        "/api/v1/notifications/mark-all-read": {
            post: {
                tags: ["Notifications"],
                summary: "Mark all notifications as read",
                responses: { 200: { description: "All notifications marked as read" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // SCHEDULED REPORTS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/scheduled-reports": {
            get: {
                tags: ["Scheduled Reports"],
                summary: "List scheduled reports",
                responses: {
                    200: { description: "Scheduled report list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ScheduledReport" } } } }] } } } },
                },
            },
            post: {
                tags: ["Scheduled Reports"],
                summary: "Create a scheduled report (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["reportType", "frequency", "recipients"], properties: { reportType: { type: "string" }, frequency: { type: "string", enum: ["daily", "weekly", "monthly"] }, recipients: { type: "array", items: { type: "string", format: "email" } } } } } },
                },
                responses: { 201: { description: "Scheduled report created" } },
            },
        },
        "/api/v1/scheduled-reports/{id}": {
            put: {
                tags: ["Scheduled Reports"],
                summary: "Update a scheduled report (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { reportType: { type: "string" }, frequency: { type: "string" }, recipients: { type: "array", items: { type: "string" } }, isActive: { type: "boolean" } } } } },
                },
                responses: { 200: { description: "Report updated" } },
            },
            delete: {
                tags: ["Scheduled Reports"],
                summary: "Delete a scheduled report (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Report deleted" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // SUBSCRIPTIONS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/subscriptions/plans": {
            get: {
                tags: ["Subscriptions"],
                summary: "List subscription plans",
                responses: {
                    200: { description: "Plan list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Plan" } } } }] } } } },
                },
            },
            post: {
                tags: ["Subscriptions"],
                summary: "Create a plan (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["name", "code", "amount", "interval"], properties: { name: { type: "string" }, code: { type: "string" }, amount: { type: "integer" }, currency: { type: "string" }, interval: { type: "string", enum: ["monthly", "yearly"] } } } } },
                },
                responses: { 201: { description: "Plan created" } },
            },
        },
        "/api/v1/subscriptions/plans/{id}": {
            get: {
                tags: ["Subscriptions"],
                summary: "Get a plan by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Plan details" } },
            },
            put: {
                tags: ["Subscriptions"],
                summary: "Update a plan (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "integer" }, isActive: { type: "boolean" } } } } },
                },
                responses: { 200: { description: "Plan updated" } },
            },
            delete: {
                tags: ["Subscriptions"],
                summary: "Delete a plan (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Plan deleted" } },
            },
        },
        "/api/v1/subscriptions": {
            get: {
                tags: ["Subscriptions"],
                summary: "List subscriptions",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "status", in: "query", schema: { type: "string" } },
                    { name: "clientId", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    200: { description: "Subscription list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Subscription" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Subscriptions"],
                summary: "Create a subscription (Sales+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["clientId", "planId"], properties: { clientId: { type: "string" }, planId: { type: "string" }, startDate: { type: "string", format: "date" } } } } },
                },
                responses: { 201: { description: "Subscription created" } },
            },
        },
        "/api/v1/subscriptions/{id}": {
            get: {
                tags: ["Subscriptions"],
                summary: "Get a subscription",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription details" } },
            },
        },
        "/api/v1/subscriptions/{id}/change-plan": {
            put: {
                tags: ["Subscriptions"],
                summary: "Change subscription plan (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["planId"], properties: { planId: { type: "string" }, prorate: { type: "boolean" } } } } },
                },
                responses: { 200: { description: "Plan changed" } },
            },
        },
        "/api/v1/subscriptions/{id}/cancel": {
            post: {
                tags: ["Subscriptions"],
                summary: "Cancel a subscription (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { cancelAtPeriodEnd: { type: "boolean" }, reason: { type: "string" } } } } },
                },
                responses: { 200: { description: "Subscription cancelled" } },
            },
        },
        "/api/v1/subscriptions/{id}/pause": {
            post: {
                tags: ["Subscriptions"],
                summary: "Pause a subscription (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription paused" } },
            },
        },
        "/api/v1/subscriptions/{id}/resume": {
            post: {
                tags: ["Subscriptions"],
                summary: "Resume a subscription (Sales+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription resumed" } },
            },
        },
        "/api/v1/subscriptions/{id}/events": {
            get: {
                tags: ["Subscriptions"],
                summary: "List events for a subscription",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Subscription event history" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // USAGE
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/usage": {
            get: {
                tags: ["Usage"],
                summary: "List usage records",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "subscriptionId", in: "query", schema: { type: "string" } },
                ],
                responses: { 200: { description: "Usage records list" } },
            },
            post: {
                tags: ["Usage"],
                summary: "Record a usage event (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["subscriptionId", "metric", "quantity"], properties: { subscriptionId: { type: "string" }, metric: { type: "string" }, quantity: { type: "number" }, timestamp: { type: "string", format: "date-time" } } } } },
                },
                responses: { 201: { description: "Usage recorded" } },
            },
        },
        "/api/v1/usage/summary": {
            get: {
                tags: ["Usage"],
                summary: "Get usage summary",
                parameters: [
                    { name: "subscriptionId", in: "query", schema: { type: "string" } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Usage summary" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // COUPONS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/coupons/validate": {
            post: {
                tags: ["Coupons"],
                summary: "Validate a coupon code",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["code"], properties: { code: { type: "string" }, amount: { type: "integer" } } } } },
                },
                responses: { 200: { description: "Validation result with discount info" } },
            },
        },
        "/api/v1/coupons/apply": {
            post: {
                tags: ["Coupons"],
                summary: "Apply a coupon to an invoice (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["code", "invoiceId"], properties: { code: { type: "string" }, invoiceId: { type: "string" } } } } },
                },
                responses: { 200: { description: "Coupon applied" } },
            },
        },
        "/api/v1/coupons/apply-to-subscription": {
            post: {
                tags: ["Coupons"],
                summary: "Apply a coupon to a subscription (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["code", "subscriptionId"], properties: { code: { type: "string" }, subscriptionId: { type: "string" } } } } },
                },
                responses: { 200: { description: "Coupon applied to subscription" } },
            },
        },
        "/api/v1/coupons/subscription/{id}": {
            delete: {
                tags: ["Coupons"],
                summary: "Remove coupon from a subscription (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Coupon removed" } },
            },
        },
        "/api/v1/coupons": {
            get: {
                tags: ["Coupons"],
                summary: "List coupons",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                ],
                responses: {
                    200: { description: "Coupon list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Coupon" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
                },
            },
            post: {
                tags: ["Coupons"],
                summary: "Create a coupon (Accountant+)",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["code", "discountType", "discountValue"], properties: { code: { type: "string" }, discountType: { type: "string", enum: ["percentage", "fixed"] }, discountValue: { type: "number" }, maxRedemptions: { type: "integer" }, validFrom: { type: "string", format: "date" }, validUntil: { type: "string", format: "date" } } } } },
                },
                responses: { 201: { description: "Coupon created" } },
            },
        },
        "/api/v1/coupons/{id}": {
            get: {
                tags: ["Coupons"],
                summary: "Get a coupon by ID",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Coupon details" } },
            },
            put: {
                tags: ["Coupons"],
                summary: "Update a coupon (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" }, discountType: { type: "string" }, discountValue: { type: "number" }, maxRedemptions: { type: "integer" }, isActive: { type: "boolean" } } } } },
                },
                responses: { 200: { description: "Coupon updated" } },
            },
            delete: {
                tags: ["Coupons"],
                summary: "Delete a coupon (Accountant+)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Coupon deleted" } },
            },
        },
        "/api/v1/coupons/{id}/redemptions": {
            get: {
                tags: ["Coupons"],
                summary: "List redemption history for a coupon",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Redemption list" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // DUNNING
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/dunning/config": {
            get: {
                tags: ["Dunning"],
                summary: "Get dunning configuration",
                responses: { 200: { description: "Dunning config", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/DunningConfig" } } }] } } } } },
            },
            put: {
                tags: ["Dunning"],
                summary: "Update dunning configuration",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/DunningConfig" } } },
                },
                responses: { 200: { description: "Config updated" } },
            },
        },
        "/api/v1/dunning/attempts": {
            get: {
                tags: ["Dunning"],
                summary: "List dunning attempts",
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "status", in: "query", schema: { type: "string" } },
                    { name: "invoiceId", in: "query", schema: { type: "string" } },
                ],
                responses: { 200: { description: "Dunning attempts list" } },
            },
        },
        "/api/v1/dunning/summary": {
            get: {
                tags: ["Dunning"],
                summary: "Get dunning summary statistics",
                responses: { 200: { description: "Dunning summary" } },
            },
        },
        "/api/v1/dunning/attempts/{id}/retry": {
            post: {
                tags: ["Dunning"],
                summary: "Manually retry a dunning attempt",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
                responses: { 200: { description: "Retry processed" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // METRICS
        // ═══════════════════════════════════════════════════════════════════════
        "/api/v1/metrics/mrr": {
            get: {
                tags: ["Metrics"],
                summary: "Get Monthly Recurring Revenue (MRR)",
                responses: { 200: { description: "MRR data", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/MRR" } } }] } } } } },
            },
        },
        "/api/v1/metrics/arr": {
            get: {
                tags: ["Metrics"],
                summary: "Get Annual Recurring Revenue (ARR)",
                responses: { 200: { description: "ARR data" } },
            },
        },
        "/api/v1/metrics/churn": {
            get: {
                tags: ["Metrics"],
                summary: "Get churn metrics",
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { 200: { description: "Churn metrics" } },
            },
        },
        "/api/v1/metrics/ltv": {
            get: {
                tags: ["Metrics"],
                summary: "Get customer Lifetime Value (LTV)",
                responses: { 200: { description: "LTV data" } },
            },
        },
        "/api/v1/metrics/revenue-breakdown": {
            get: {
                tags: ["Metrics"],
                summary: "Get monthly revenue breakdown",
                parameters: [
                    { name: "months", in: "query", schema: { type: "integer", default: 12 } },
                ],
                responses: { 200: { description: "Revenue breakdown by month" } },
            },
        },
        "/api/v1/metrics/subscription-stats": {
            get: {
                tags: ["Metrics"],
                summary: "Get subscription statistics",
                responses: { 200: { description: "Subscription statistics" } },
            },
        },
        "/api/v1/metrics/cohort": {
            get: {
                tags: ["Metrics"],
                summary: "Get cohort retention analysis",
                parameters: [
                    { name: "months", in: "query", schema: { type: "integer", default: 12 } },
                ],
                responses: { 200: { description: "Cohort analysis data" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // GATEWAY WEBHOOKS
        // ═══════════════════════════════════════════════════════════════════════
        "/webhooks/gateway/stripe": {
            post: {
                tags: ["Gateway Webhooks"],
                summary: "Stripe webhook handler",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object" } } },
                },
                responses: { 200: { description: "Webhook processed" } },
            },
        },
        "/webhooks/gateway/razorpay": {
            post: {
                tags: ["Gateway Webhooks"],
                summary: "Razorpay webhook handler",
                security: [],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object" } } },
                },
                responses: { 200: { description: "Webhook processed" } },
            },
        },
        // ═══════════════════════════════════════════════════════════════════════
        // HEALTH
        // ═══════════════════════════════════════════════════════════════════════
        "/health": {
            get: {
                tags: ["Health"],
                summary: "Health check",
                security: [],
                responses: {
                    200: {
                        description: "Service is healthy",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "ok" },
                                        service: { type: "string", example: "emp-billing" },
                                        version: { type: "string", example: "0.1.0" },
                                        env: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};
//# sourceMappingURL=openapi.js.map