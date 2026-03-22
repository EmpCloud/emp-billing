// ============================================================================
// OpenAPI 3.0 Specification for EMP Billing API
// ============================================================================

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "EMP Billing API",
    description:
      "# EMP Billing API\n\n" +
      "Open-source billing and invoicing platform — part of the **EmpCloud** ecosystem.\n\n" +
      "Handles the complete billing lifecycle: **quotes → invoices → payments → receipts → reports**.\n\n" +
      "## Getting Started\n\n" +
      "1. **Register** — `POST /api/v1/auth/register` with your name, email, password, and org name.\n" +
      "2. **Login** — `POST /api/v1/auth/login` to receive a JWT `accessToken`.\n" +
      "3. **Authorize** — Click the **Authorize** button above and paste `Bearer <accessToken>`.\n" +
      "4. **Create a client** — `POST /api/v1/clients` with the client's name and email.\n" +
      "5. **Create an invoice** — `POST /api/v1/invoices` referencing the client ID and line items.\n" +
      "6. **Record a payment** — `POST /api/v1/payments` against the invoice.\n\n" +
      "## Authentication\n\n" +
      "The API supports two authentication methods:\n\n" +
      "- **JWT Bearer Token** — Obtain via `/api/v1/auth/login`. Pass as `Authorization: Bearer <token>`.\n" +
      "- **API Key** — Generate in Settings > API Keys. Pass as `X-API-Key: <key>` header.\n\n" +
      "Portal endpoints use a separate JWT obtained via `/api/v1/portal/login`.\n\n" +
      "## Money Format\n\n" +
      "All monetary values are stored as **integers in the smallest currency unit** " +
      "(e.g., paise for INR, cents for USD). Divide by 100 for display. " +
      "For example, `150000` = ₹1,500.00 or $1,500.00.\n\n" +
      "## Rate Limiting\n\n" +
      "API requests are rate-limited to **100 requests per minute** per API key or JWT. " +
      "Exceeding this limit returns `429 Too Many Requests`.\n\n" +
      "## Webhook Events\n\n" +
      "Subscribe to events via `POST /api/v1/webhooks`. Available events include:\n" +
      "`invoice.created`, `invoice.sent`, `invoice.paid`, `payment.received`, " +
      "`quote.accepted`, `client.created`, `subscription.created`, `subscription.cancelled`, and more.",
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
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token obtained from /api/v1/auth/login",
      },
      ApiKeyAuth: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "X-API-Key",
        description: "API key generated from Settings > API Keys. Use for server-to-server integrations.",
      },
      PortalAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token for client portal access obtained from /api/v1/portal/login",
      },
    },

    // ── Shared Response Objects ──────────────────────────────────────────
    responses: {
      BadRequest: {
        description: "Bad request — invalid input or missing required fields",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: { email: ["Invalid email format"], password: ["Must be at least 8 characters"] } } } } },
      },
      Unauthorized: {
        description: "Unauthorized — missing or invalid authentication token",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } } } },
      },
      Forbidden: {
        description: "Forbidden — insufficient permissions for this action",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "FORBIDDEN", message: "You do not have permission to perform this action" } } } },
      },
      NotFound: {
        description: "Not found — the requested resource does not exist",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "NOT_FOUND", message: "Resource not found" } } } },
      },
      ValidationError: {
        description: "Unprocessable entity — request body failed schema validation",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "VALIDATION_ERROR", message: "Validation failed", details: { clientId: ["Required"], items: ["Must contain at least 1 item"] } } } } },
      },
      RateLimited: {
        description: "Too many requests — rate limit exceeded",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please retry after 60 seconds." } } } },
      },
    },

    // ── Shared Schemas ──────────────────────────────────────────────────
    schemas: {
      // -- Common --
      ApiResponse: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          data: {},
          error: { $ref: "#/components/schemas/ApiError" },
        },
        required: ["success"],
      },
      ErrorResponse: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const, example: false },
          error: { $ref: "#/components/schemas/ApiError" },
        },
        required: ["success", "error"],
      },
      ApiError: {
        type: "object" as const,
        properties: {
          code: { type: "string" as const, example: "VALIDATION_ERROR" },
          message: { type: "string" as const, example: "Validation failed" },
          details: {
            type: "object" as const,
            additionalProperties: {
              type: "array" as const,
              items: { type: "string" as const },
            },
          },
        },
        required: ["code", "message"],
      },
      PaginationMeta: {
        type: "object" as const,
        properties: {
          page: { type: "integer" as const, example: 1 },
          limit: { type: "integer" as const, example: 20 },
          total: { type: "integer" as const, example: 150 },
          totalPages: { type: "integer" as const, example: 8 },
        },
      },
      PaginationParams: {
        type: "object" as const,
        properties: {
          page: { type: "integer" as const, minimum: 1, default: 1 },
          limit: { type: "integer" as const, minimum: 1, maximum: 100, default: 20 },
        },
      },

      // -- Auth --
      LoginRequest: {
        type: "object" as const,
        required: ["email", "password"],
        properties: {
          email: { type: "string" as const, format: "email", example: "admin@acme.com" },
          password: { type: "string" as const, minLength: 8, example: "secureP@ss123" },
        },
      },
      RegisterRequest: {
        type: "object" as const,
        required: ["name", "email", "password", "orgName"],
        properties: {
          name: { type: "string" as const, example: "John Doe" },
          email: { type: "string" as const, format: "email", example: "john@acme.com" },
          password: { type: "string" as const, minLength: 8, example: "secureP@ss123" },
          orgName: { type: "string" as const, example: "Acme Corp" },
        },
      },
      AuthTokens: {
        type: "object" as const,
        properties: {
          accessToken: { type: "string" as const, example: "eyJhbGciOiJIUzI1NiIs..." },
          refreshToken: { type: "string" as const, example: "dGhpcyBpcyBhIHJlZnJlc2g..." },
          expiresIn: { type: "string" as const, example: "15m" },
        },
      },
      ForgotPasswordRequest: {
        type: "object" as const,
        required: ["email"],
        properties: {
          email: { type: "string" as const, format: "email", example: "john@acme.com" },
        },
      },
      ResetPasswordRequest: {
        type: "object" as const,
        required: ["token", "password"],
        properties: {
          token: { type: "string" as const },
          password: { type: "string" as const, minLength: 8 },
        },
      },
      ChangePasswordRequest: {
        type: "object" as const,
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string" as const },
          newPassword: { type: "string" as const, minLength: 8 },
        },
      },
      User: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          name: { type: "string" as const, example: "John Doe" },
          email: { type: "string" as const, format: "email", example: "john@acme.com" },
          role: { type: "string" as const, enum: ["owner", "admin", "accountant", "sales", "viewer"] },
          orgId: { type: "string" as const, format: "uuid" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Organization --
      Organization: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Acme Corp" },
          email: { type: "string" as const, example: "billing@acme.com" },
          phone: { type: "string" as const, example: "+91 9876543210" },
          website: { type: "string" as const, example: "https://acme.com" },
          addressLine1: { type: "string" as const },
          addressLine2: { type: "string" as const },
          city: { type: "string" as const },
          state: { type: "string" as const },
          postalCode: { type: "string" as const },
          country: { type: "string" as const },
          taxId: { type: "string" as const, description: "GSTIN, VAT number, or EIN" },
          baseCurrency: { type: "string" as const, example: "INR" },
          fiscalYearStart: { type: "integer" as const, example: 4, description: "Month number (1=Jan, 4=Apr)" },
          logoUrl: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      UpdateOrganization: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          email: { type: "string" as const },
          phone: { type: "string" as const },
          website: { type: "string" as const },
          addressLine1: { type: "string" as const },
          addressLine2: { type: "string" as const },
          city: { type: "string" as const },
          state: { type: "string" as const },
          postalCode: { type: "string" as const },
          country: { type: "string" as const },
          taxId: { type: "string" as const },
          baseCurrency: { type: "string" as const },
        },
      },
      InviteUserRequest: {
        type: "object" as const,
        required: ["email", "role"],
        properties: {
          email: { type: "string" as const, format: "email" },
          role: { type: "string" as const, enum: ["admin", "accountant", "sales", "viewer"] },
          name: { type: "string" as const },
        },
      },
      UpdateUserRoleRequest: {
        type: "object" as const,
        required: ["role"],
        properties: {
          role: { type: "string" as const, enum: ["admin", "accountant", "sales", "viewer"] },
        },
      },

      // -- Client --
      Client: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Widget Labs Pvt Ltd" },
          email: { type: "string" as const, example: "accounts@widgetlabs.in" },
          phone: { type: "string" as const },
          company: { type: "string" as const },
          billingAddress: { type: "object" as const, properties: { line1: { type: "string" as const }, line2: { type: "string" as const }, city: { type: "string" as const }, state: { type: "string" as const }, postalCode: { type: "string" as const }, country: { type: "string" as const } } },
          shippingAddress: { type: "object" as const },
          taxId: { type: "string" as const, description: "Client's GSTIN, VAT, or tax ID" },
          currency: { type: "string" as const, example: "INR" },
          paymentTerms: { type: "string" as const, example: "net_30" },
          tags: { type: "array" as const, items: { type: "string" as const } },
          totalBilled: { type: "integer" as const, description: "Amount in smallest currency unit (paise/cents)" },
          outstandingBalance: { type: "integer" as const, description: "Amount in smallest currency unit" },
          customFields: { type: "object" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateClient: {
        type: "object" as const,
        required: ["name", "email"],
        properties: {
          name: { type: "string" as const, example: "Widget Labs Pvt Ltd" },
          email: { type: "string" as const, format: "email", example: "accounts@widgetlabs.in" },
          phone: { type: "string" as const },
          company: { type: "string" as const },
          billingAddress: { type: "object" as const },
          shippingAddress: { type: "object" as const },
          taxId: { type: "string" as const },
          currency: { type: "string" as const },
          paymentTerms: { type: "string" as const },
          tags: { type: "array" as const, items: { type: "string" as const } },
          customFields: { type: "object" as const },
        },
      },
      AutoProvisionClient: {
        type: "object" as const,
        required: ["name", "email"],
        description: "Auto-provision a client: creates the client if not found by email, or returns the existing client.",
        properties: {
          name: { type: "string" as const, example: "Widget Labs Pvt Ltd" },
          email: { type: "string" as const, format: "email", example: "accounts@widgetlabs.in" },
          phone: { type: "string" as const },
          company: { type: "string" as const },
          currency: { type: "string" as const },
          taxId: { type: "string" as const },
        },
      },
      ClientContact: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const },
          email: { type: "string" as const },
          phone: { type: "string" as const },
          designation: { type: "string" as const },
          isPrimary: { type: "boolean" as const },
        },
      },

      // -- Product --
      Product: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Web Development - Hourly" },
          description: { type: "string" as const },
          sku: { type: "string" as const, example: "SVC-WEBDEV-HR" },
          type: { type: "string" as const, enum: ["goods", "services"] },
          unit: { type: "string" as const, example: "hours" },
          rate: { type: "integer" as const, description: "Amount in smallest currency unit", example: 500000 },
          taxRateId: { type: "string" as const },
          hsnCode: { type: "string" as const, description: "HSN/SAC code for GST" },
          isActive: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateProduct: {
        type: "object" as const,
        required: ["name", "rate"],
        properties: {
          name: { type: "string" as const },
          description: { type: "string" as const },
          sku: { type: "string" as const },
          type: { type: "string" as const, enum: ["goods", "services"] },
          unit: { type: "string" as const },
          rate: { type: "integer" as const, description: "Amount in smallest currency unit" },
          taxRateId: { type: "string" as const },
          hsnCode: { type: "string" as const },
        },
      },
      TaxRate: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "GST 18%" },
          rate: { type: "number" as const, example: 18 },
          type: { type: "string" as const, description: "Tax type: gst, vat, sales_tax, custom" },
          isCompound: { type: "boolean" as const },
          isActive: { type: "boolean" as const },
        },
      },

      // -- Invoice --
      Invoice: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          invoiceNumber: { type: "string" as const, example: "INV-2026-0042" },
          referenceNumber: { type: "string" as const },
          status: {
            type: "string" as const,
            enum: ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "written_off"],
          },
          issueDate: { type: "string" as const, format: "date", example: "2026-03-23" },
          dueDate: { type: "string" as const, format: "date", example: "2026-04-22" },
          currency: { type: "string" as const, example: "INR" },
          exchangeRate: { type: "number" as const },
          subtotal: { type: "integer" as const, description: "Amount in smallest currency unit", example: 10000000 },
          discountType: { type: "string" as const, enum: ["percentage", "fixed"] },
          discountValue: { type: "number" as const },
          discountAmount: { type: "integer" as const },
          taxAmount: { type: "integer" as const, example: 1800000 },
          total: { type: "integer" as const, example: 11800000 },
          amountPaid: { type: "integer" as const },
          amountDue: { type: "integer" as const, example: 11800000 },
          notes: { type: "string" as const },
          terms: { type: "string" as const },
          customFields: { type: "object" as const },
          createdBy: { type: "string" as const, format: "uuid" },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      InvoiceItem: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          invoiceId: { type: "string" as const, format: "uuid" },
          productId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Web Development" },
          description: { type: "string" as const },
          hsnCode: { type: "string" as const },
          quantity: { type: "number" as const, example: 20 },
          unit: { type: "string" as const, example: "hours" },
          rate: { type: "integer" as const, example: 500000 },
          discountType: { type: "string" as const },
          discountValue: { type: "number" as const },
          discountAmount: { type: "integer" as const },
          taxRateId: { type: "string" as const },
          taxRate: { type: "number" as const },
          taxAmount: { type: "integer" as const },
          taxComponents: { type: "object" as const, description: "Breakdown: { cgst: 900000, sgst: 900000 } for GST" },
          amount: { type: "integer" as const },
          sortOrder: { type: "integer" as const },
        },
      },
      CreateInvoice: {
        type: "object" as const,
        required: ["clientId", "issueDate", "dueDate", "items"],
        properties: {
          clientId: { type: "string" as const, format: "uuid" },
          issueDate: { type: "string" as const, format: "date" },
          dueDate: { type: "string" as const, format: "date" },
          currency: { type: "string" as const },
          referenceNumber: { type: "string" as const },
          discountType: { type: "string" as const, enum: ["percentage", "fixed"] },
          discountValue: { type: "number" as const },
          notes: { type: "string" as const },
          terms: { type: "string" as const },
          customFields: { type: "object" as const },
          items: {
            type: "array" as const,
            minItems: 1,
            items: {
              type: "object" as const,
              required: ["name", "quantity", "rate"],
              properties: {
                productId: { type: "string" as const },
                name: { type: "string" as const },
                description: { type: "string" as const },
                hsnCode: { type: "string" as const },
                quantity: { type: "number" as const },
                unit: { type: "string" as const },
                rate: { type: "integer" as const, description: "Amount in smallest currency unit" },
                discountType: { type: "string" as const },
                discountValue: { type: "number" as const },
                taxRateId: { type: "string" as const },
              },
            },
          },
        },
      },

      // -- Quote --
      Quote: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          quoteNumber: { type: "string" as const, example: "QTE-2026-0015" },
          status: {
            type: "string" as const,
            enum: ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"],
          },
          issueDate: { type: "string" as const, format: "date" },
          expiryDate: { type: "string" as const, format: "date" },
          currency: { type: "string" as const },
          subtotal: { type: "integer" as const },
          discountAmount: { type: "integer" as const },
          taxAmount: { type: "integer" as const },
          total: { type: "integer" as const },
          notes: { type: "string" as const },
          terms: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateQuote: {
        type: "object" as const,
        required: ["clientId", "issueDate", "expiryDate", "items"],
        properties: {
          clientId: { type: "string" as const, format: "uuid" },
          issueDate: { type: "string" as const, format: "date" },
          expiryDate: { type: "string" as const, format: "date" },
          currency: { type: "string" as const },
          notes: { type: "string" as const },
          terms: { type: "string" as const },
          items: {
            type: "array" as const,
            minItems: 1,
            items: {
              type: "object" as const,
              required: ["name", "quantity", "rate"],
              properties: {
                name: { type: "string" as const },
                description: { type: "string" as const },
                quantity: { type: "number" as const },
                rate: { type: "integer" as const },
                taxRateId: { type: "string" as const },
              },
            },
          },
        },
      },

      // -- Payment --
      Payment: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          invoiceId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          amount: { type: "integer" as const, description: "Amount in smallest currency unit", example: 5000000 },
          currency: { type: "string" as const },
          method: {
            type: "string" as const,
            enum: ["cash", "bank_transfer", "cheque", "upi", "card", "gateway", "other"],
          },
          referenceNumber: { type: "string" as const },
          date: { type: "string" as const, format: "date" },
          notes: { type: "string" as const },
          gatewayTransactionId: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreatePayment: {
        type: "object" as const,
        required: ["invoiceId", "amount", "method", "date"],
        properties: {
          invoiceId: { type: "string" as const, format: "uuid" },
          amount: { type: "integer" as const, description: "Amount in smallest currency unit" },
          method: { type: "string" as const, enum: ["cash", "bank_transfer", "cheque", "upi", "card", "gateway", "other"] },
          date: { type: "string" as const, format: "date" },
          referenceNumber: { type: "string" as const },
          notes: { type: "string" as const },
        },
      },
      RefundRequest: {
        type: "object" as const,
        required: ["amount"],
        properties: {
          amount: { type: "integer" as const, description: "Refund amount in smallest currency unit" },
          reason: { type: "string" as const },
        },
      },

      // -- Credit Note --
      CreditNote: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          creditNoteNumber: { type: "string" as const, example: "CN-2026-0003" },
          status: { type: "string" as const, enum: ["draft", "open", "applied", "void"] },
          invoiceId: { type: "string" as const, format: "uuid" },
          total: { type: "integer" as const },
          balanceRemaining: { type: "integer" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateCreditNote: {
        type: "object" as const,
        required: ["clientId", "invoiceId", "items"],
        properties: {
          clientId: { type: "string" as const, format: "uuid" },
          invoiceId: { type: "string" as const, format: "uuid" },
          notes: { type: "string" as const },
          items: {
            type: "array" as const,
            minItems: 1,
            items: {
              type: "object" as const,
              required: ["name", "quantity", "rate"],
              properties: {
                name: { type: "string" as const },
                quantity: { type: "number" as const },
                rate: { type: "integer" as const },
              },
            },
          },
        },
      },
      ApplyCreditNote: {
        type: "object" as const,
        required: ["invoiceId", "amount"],
        properties: {
          invoiceId: { type: "string" as const, format: "uuid" },
          amount: { type: "integer" as const, description: "Amount to apply in smallest currency unit" },
        },
      },

      // -- Expense --
      Expense: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          categoryId: { type: "string" as const, format: "uuid" },
          vendorName: { type: "string" as const },
          date: { type: "string" as const, format: "date" },
          amount: { type: "integer" as const, description: "Amount in smallest currency unit" },
          currency: { type: "string" as const },
          taxAmount: { type: "integer" as const },
          description: { type: "string" as const },
          isBillable: { type: "boolean" as const },
          clientId: { type: "string" as const, format: "uuid" },
          invoiceId: { type: "string" as const, format: "uuid" },
          status: { type: "string" as const, enum: ["pending", "approved", "rejected", "billed"] },
          approvedBy: { type: "string" as const, format: "uuid" },
          tags: { type: "array" as const, items: { type: "string" as const } },
          createdBy: { type: "string" as const, format: "uuid" },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateExpense: {
        type: "object" as const,
        required: ["categoryId", "date", "amount", "description"],
        properties: {
          categoryId: { type: "string" as const, format: "uuid" },
          vendorName: { type: "string" as const },
          date: { type: "string" as const, format: "date" },
          amount: { type: "integer" as const },
          currency: { type: "string" as const },
          taxAmount: { type: "integer" as const },
          description: { type: "string" as const },
          isBillable: { type: "boolean" as const },
          clientId: { type: "string" as const, format: "uuid" },
          tags: { type: "array" as const, items: { type: "string" as const } },
        },
      },
      ExpenseCategory: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const },
          description: { type: "string" as const },
          isActive: { type: "boolean" as const },
        },
      },
      OCRResult: {
        type: "object" as const,
        properties: {
          merchantName: { type: "string" as const },
          date: { type: "string" as const },
          total: { type: "integer" as const, description: "Amount in smallest currency unit" },
          currency: { type: "string" as const },
          lineItems: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                description: { type: "string" as const },
                amount: { type: "integer" as const },
              },
            },
          },
          rawText: { type: "string" as const },
          confidence: { type: "number" as const, minimum: 0, maximum: 1 },
        },
      },

      // -- Vendor --
      Vendor: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const },
          email: { type: "string" as const },
          phone: { type: "string" as const },
          company: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Recurring Profile --
      RecurringProfile: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          frequency: { type: "string" as const, enum: ["daily", "weekly", "monthly", "yearly", "custom"] },
          startDate: { type: "string" as const, format: "date" },
          endDate: { type: "string" as const, format: "date" },
          maxOccurrences: { type: "integer" as const },
          status: { type: "string" as const, enum: ["active", "paused", "completed", "cancelled"] },
          nextRunDate: { type: "string" as const, format: "date" },
          autoSend: { type: "boolean" as const },
          autoCharge: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Webhook --
      Webhook: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          url: { type: "string" as const, format: "uri", example: "https://example.com/webhooks/billing" },
          events: { type: "array" as const, items: { type: "string" as const }, example: ["invoice.created", "payment.received"] },
          secret: { type: "string" as const, description: "HMAC secret for verifying webhook signatures" },
          isActive: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateWebhook: {
        type: "object" as const,
        required: ["url", "events"],
        properties: {
          url: { type: "string" as const, format: "uri", example: "https://example.com/webhooks/billing" },
          events: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Events to subscribe to: invoice.created, invoice.sent, invoice.paid, payment.received, quote.accepted, client.created, subscription.created, subscription.cancelled",
            example: ["invoice.created", "payment.received"],
          },
          secret: { type: "string" as const, description: "Optional HMAC secret. Auto-generated if not provided." },
        },
      },

      // -- Dispute --
      Dispute: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          invoiceId: { type: "string" as const, format: "uuid" },
          reason: { type: "string" as const },
          status: { type: "string" as const, enum: ["open", "under_review", "resolved", "rejected"] },
          resolution: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Subscription --
      Plan: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Pro Plan" },
          code: { type: "string" as const, example: "pro-monthly" },
          amount: { type: "integer" as const, example: 299900, description: "Amount in smallest currency unit" },
          currency: { type: "string" as const, example: "INR" },
          interval: { type: "string" as const, enum: ["monthly", "yearly"] },
          isActive: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Subscription: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          clientId: { type: "string" as const, format: "uuid" },
          planId: { type: "string" as const, format: "uuid" },
          status: {
            type: "string" as const,
            enum: ["active", "paused", "cancelled", "past_due", "trialing"],
          },
          currentPeriodStart: { type: "string" as const, format: "date" },
          currentPeriodEnd: { type: "string" as const, format: "date" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Coupon --
      Coupon: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          code: { type: "string" as const, example: "SAVE20" },
          discountType: { type: "string" as const, enum: ["percentage", "fixed"] },
          discountValue: { type: "number" as const, example: 20 },
          maxRedemptions: { type: "integer" as const },
          timesRedeemed: { type: "integer" as const },
          validFrom: { type: "string" as const, format: "date" },
          validUntil: { type: "string" as const, format: "date" },
          isActive: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Usage --
      UsageRecord: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          subscriptionId: { type: "string" as const, format: "uuid" },
          metric: { type: "string" as const, example: "api_calls" },
          quantity: { type: "number" as const, example: 1500 },
          timestamp: { type: "string" as const, format: "date-time" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      ReportUsage: {
        type: "object" as const,
        required: ["subscriptionId", "metric", "quantity"],
        description: "Simplified usage reporting for SaaS integrations. Reports usage for a subscription metric.",
        properties: {
          subscriptionId: { type: "string" as const, format: "uuid" },
          metric: { type: "string" as const, example: "api_calls", description: "The usage metric name" },
          quantity: { type: "number" as const, example: 1500, description: "Usage quantity for this period" },
          timestamp: { type: "string" as const, format: "date-time", description: "When the usage occurred (defaults to now)" },
        },
      },
      GenerateUsageInvoice: {
        type: "object" as const,
        required: ["subscriptionId"],
        description: "Generate an invoice from accumulated usage records for a subscription.",
        properties: {
          subscriptionId: { type: "string" as const, format: "uuid" },
          periodStart: { type: "string" as const, format: "date", description: "Start of billing period (defaults to current period start)" },
          periodEnd: { type: "string" as const, format: "date", description: "End of billing period (defaults to now)" },
        },
      },

      // -- API Key --
      ApiKey: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          name: { type: "string" as const, example: "Production API Key" },
          prefix: { type: "string" as const, example: "emp_live_", description: "Key prefix (the full key is only shown once at creation)" },
          lastUsedAt: { type: "string" as const, format: "date-time" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateApiKey: {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const, example: "Production API Key", description: "A human-readable label for the key" },
        },
      },

      // -- Custom Domain --
      CustomDomain: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          domain: { type: "string" as const, example: "billing.acme.com" },
          status: { type: "string" as const, enum: ["pending", "verified", "failed"], description: "DNS verification status" },
          verificationToken: { type: "string" as const, description: "TXT record value to add to DNS" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      AddDomain: {
        type: "object" as const,
        required: ["domain"],
        properties: {
          domain: { type: "string" as const, example: "billing.acme.com" },
        },
      },

      // -- Notification --
      Notification: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          type: { type: "string" as const },
          title: { type: "string" as const },
          message: { type: "string" as const },
          isRead: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Dunning --
      DunningConfig: {
        type: "object" as const,
        properties: {
          maxAttempts: { type: "integer" as const, example: 3 },
          retryIntervalDays: { type: "array" as const, items: { type: "integer" as const }, example: [3, 5, 7] },
          finalAction: { type: "string" as const, enum: ["cancel", "pause", "none"] },
        },
      },

      // -- Metrics --
      MRR: {
        type: "object" as const,
        properties: {
          mrr: { type: "integer" as const, description: "Monthly Recurring Revenue in smallest currency unit" },
          growth: { type: "number" as const, description: "Growth percentage vs previous month" },
          newMrr: { type: "integer" as const },
          churnedMrr: { type: "integer" as const },
        },
      },

      // -- Upload --
      UploadedFile: {
        type: "object" as const,
        properties: {
          filename: { type: "string" as const },
          originalName: { type: "string" as const },
          mimeType: { type: "string" as const },
          size: { type: "integer" as const },
          url: { type: "string" as const },
        },
      },

      // -- Audit Log --
      AuditLog: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          userId: { type: "string" as const, format: "uuid" },
          action: { type: "string" as const },
          entity: { type: "string" as const },
          entityId: { type: "string" as const },
          changes: { type: "object" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },

      // -- Scheduled Report --
      ScheduledReport: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "uuid" },
          orgId: { type: "string" as const, format: "uuid" },
          reportType: { type: "string" as const },
          frequency: { type: "string" as const, enum: ["daily", "weekly", "monthly"] },
          recipients: { type: "array" as const, items: { type: "string" as const } },
          isActive: { type: "boolean" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
    },
  },

  // ── Default Security ────────────────────────────────────────────────────
  security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],

  // ── Tags ────────────────────────────────────────────────────────────────
  tags: [
    { name: "Auth", description: "Authentication — register, login, token refresh, password management" },
    { name: "Organizations", description: "Organization settings, team members, and audit logs" },
    { name: "Clients", description: "Client / customer management, contacts, statements, and auto-provisioning" },
    { name: "Products", description: "Product and service catalog, tax rates" },
    { name: "Invoices", description: "Invoice CRUD, PDF generation, send, void, write-off, bulk actions" },
    { name: "Quotes", description: "Quote / estimate management, send, accept, decline, convert to invoice" },
    { name: "Payments", description: "Payment recording, refunds, receipts" },
    { name: "Credit Notes", description: "Credit note management — create, apply to invoices, void" },
    { name: "Vendors", description: "Vendor / supplier management for expense tracking" },
    { name: "Expenses", description: "Expense tracking, categories, approval workflow, OCR receipt scanning" },
    { name: "Recurring", description: "Recurring invoice profiles — auto-generate and auto-send" },
    { name: "Reports", description: "Revenue, receivables, tax (GST/VAT), expense, and P&L reports with CSV export" },
    { name: "Disputes", description: "Invoice dispute management and resolution" },
    { name: "Portal", description: "Client portal — view invoices, pay online, accept quotes, manage subscriptions" },
    { name: "Webhooks", description: "Webhook subscription management — subscribe to events, view delivery logs, retry" },
    { name: "Settings", description: "Organization settings — branding, numbering, email templates" },
    { name: "Currency", description: "Exchange rates, currency conversion, supported currencies" },
    { name: "Uploads", description: "File uploads — receipts, attachments, general files" },
    { name: "Search", description: "Global search across invoices, clients, quotes, payments, expenses" },
    { name: "Notifications", description: "User notifications — list, mark read" },
    { name: "Scheduled Reports", description: "Automated scheduled report delivery via email" },
    { name: "Subscriptions", description: "Subscription and plan management for recurring SaaS billing" },
    { name: "Usage", description: "Usage-based billing — record usage, generate invoices from usage" },
    { name: "Coupons", description: "Coupon / discount code management — validate, apply, redeem" },
    { name: "Dunning", description: "Failed payment retry (dunning) management and configuration" },
    { name: "Metrics", description: "SaaS metrics — MRR, ARR, churn, LTV, cohort retention analysis" },
    { name: "API Keys", description: "API key management for server-to-server integrations" },
    { name: "Custom Domains", description: "Custom domain management for client portal branding" },
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
        description: "Creates a new user account along with an organization. The user becomes the owner of the organization. Returns JWT access and refresh tokens.",
        operationId: "register",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" }, example: { name: "John Doe", email: "john@acme.com", password: "secureP@ss123", orgName: "Acme Corp" } } },
        },
        responses: {
          201: { description: "User registered successfully", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] }, example: { success: true, data: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "dGhpcyBpcyBhIHJlZnJlc2g...", expiresIn: "15m" } } } } },
          409: { description: "Email already registered", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description: "Authenticates a user and returns JWT tokens. The access token expires in 15 minutes; use the refresh token to obtain a new one.",
        operationId: "login",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" }, example: { email: "admin@acme.com", password: "secureP@ss123" } } },
        },
        responses: {
          200: { description: "Login successful", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] }, example: { success: true, data: { accessToken: "eyJhbGciOiJIUzI1NiIs...", refreshToken: "dGhpcyBpcyBhIHJlZnJlc2g...", expiresIn: "15m" } } } } },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          429: { $ref: "#/components/responses/RateLimited" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email": "admin@acme.com", "password": "secureP@ss123"}\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/auth/login", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    email: "admin@acme.com",\n    password: "secureP@ss123"\n  })\n});\nconst { data } = await response.json();\nconsole.log("Access Token:", data.accessToken);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/auth/login",\n    json={"email": "admin@acme.com", "password": "secureP@ss123"}\n)\ndata = response.json()["data"]\nprint("Access Token:", data["accessToken"])',
          },
        ],
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description: "Exchanges a valid refresh token (sent as an HTTP-only cookie) for a new access token.",
        operationId: "refreshToken",
        security: [],
        responses: {
          200: { description: "Token refreshed", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/AuthTokens" } } }] } } } },
          401: { description: "Invalid or expired refresh token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and invalidate refresh token",
        description: "Invalidates the current refresh token and clears the HTTP-only cookie.",
        operationId: "logout",
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
        description: "Sends a password reset link to the provided email address. Always returns 200 to prevent email enumeration.",
        operationId: "forgotPassword",
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
        description: "Resets the user's password using the token from the reset email. The token is single-use and expires after 1 hour.",
        operationId: "resetPassword",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordRequest" } } },
        },
        responses: {
          200: { description: "Password reset successfully" },
          400: { description: "Invalid or expired token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/v1/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change password (authenticated)",
        description: "Changes the password for the currently authenticated user. Requires the current password for verification.",
        operationId: "changePassword",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } },
        },
        responses: {
          200: { description: "Password changed successfully" },
          400: { description: "Current password incorrect", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        description: "Returns the profile of the currently authenticated user, including their role and organization.",
        operationId: "getCurrentUser",
        responses: {
          200: { description: "Current user", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/User" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
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
        description: "Returns the organization details for the currently authenticated user's org.",
        operationId: "getOrganization",
        responses: {
          200: { description: "Organization details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Organization" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Organizations"],
        summary: "Update organization settings",
        description: "Updates the organization profile. Requires Admin role.",
        operationId: "updateOrganization",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateOrganization" } } },
        },
        responses: {
          200: { description: "Organization updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/organizations/audit-logs": {
      get: {
        tags: ["Organizations"],
        summary: "List audit logs",
        description: "Returns a paginated list of audit log entries for the organization. Requires Admin role. Tracks all create, update, and delete actions.",
        operationId: "listAuditLogs",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Audit logs list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/organizations/members": {
      get: {
        tags: ["Organizations"],
        summary: "List team members",
        description: "Returns all team members in the organization with their roles.",
        operationId: "listMembers",
        responses: {
          200: { description: "Team members list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/User" } } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Organizations"],
        summary: "Invite a team member",
        description: "Sends an invitation email to add a new member to the organization. Requires Admin role.",
        operationId: "inviteMember",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/InviteUserRequest" } } },
        },
        responses: {
          201: { description: "Invitation sent" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: { description: "User already a member" },
        },
      },
    },
    "/api/v1/organizations/members/{userId}/role": {
      put: {
        tags: ["Organizations"],
        summary: "Update a member's role",
        description: "Changes the role of an existing team member. Requires Admin role. Cannot change the owner's role.",
        operationId: "updateMemberRole",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRoleRequest" } } },
        },
        responses: {
          200: { description: "Role updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/organizations/members/{userId}": {
      delete: {
        tags: ["Organizations"],
        summary: "Remove a team member",
        description: "Removes a member from the organization. Requires Admin role. Cannot remove the owner.",
        operationId: "removeMember",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Member removed" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
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
        description: "Returns a paginated list of clients. Supports search by name, email, or company.",
        operationId: "listClients",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by name, email, or company" },
        ],
        responses: {
          200: { description: "Paginated client list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Client" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Clients"],
        summary: "Create a client",
        description: "Creates a new client in the organization. Requires Sales role or higher.",
        operationId: "createClient",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClient" } } },
        },
        responses: {
          201: { description: "Client created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/clients/auto-provision": {
      post: {
        tags: ["Clients"],
        summary: "Auto-provision a client",
        description: "Finds an existing client by email or creates a new one if not found. Useful for programmatic integrations where you want to ensure a client exists without checking first. Returns `created: true` if a new client was created.",
        operationId: "autoProvisionClient",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AutoProvisionClient" }, example: { name: "Widget Labs Pvt Ltd", email: "accounts@widgetlabs.in", company: "Widget Labs", currency: "INR" } } },
        },
        responses: {
          200: { description: "Existing client returned (already exists)", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" }, created: { type: "boolean", example: false } } }] } } } },
          201: { description: "New client created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" }, created: { type: "boolean", example: true } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/clients/auto-provision \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "name": "Widget Labs Pvt Ltd",\n    "email": "accounts@widgetlabs.in",\n    "company": "Widget Labs",\n    "currency": "INR"\n  }\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/clients/auto-provision", {\n  method: "POST",\n  headers: {\n    "Authorization": `Bearer ${accessToken}`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    name: "Widget Labs Pvt Ltd",\n    email: "accounts@widgetlabs.in",\n    company: "Widget Labs",\n    currency: "INR"\n  })\n});\nconst { data, created } = await response.json();\nconsole.log(created ? "New client created" : "Existing client found", data.id);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/clients/auto-provision",\n    headers={"Authorization": f"Bearer {access_token}"},\n    json={\n        "name": "Widget Labs Pvt Ltd",\n        "email": "accounts@widgetlabs.in",\n        "company": "Widget Labs",\n        "currency": "INR"\n    }\n)\nresult = response.json()\nprint("Created" if result.get("created") else "Found", result["data"]["id"])',
          },
        ],
      },
    },
    "/api/v1/clients/export/csv": {
      get: {
        tags: ["Clients"],
        summary: "Export clients to CSV",
        description: "Exports all clients as a downloadable CSV file. Requires Sales role or higher.",
        operationId: "exportClientsCsv",
        responses: {
          200: { description: "CSV file download", content: { "text/csv": { schema: { type: "string" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/clients/import/csv": {
      post: {
        tags: ["Clients"],
        summary: "Import clients from CSV",
        description: "Imports clients from a CSV file. Returns counts of successfully imported and failed rows. Requires Accountant role or higher.",
        operationId: "importClientsCsv",
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          200: { description: "Import result with success and error counts" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/clients/{id}": {
      get: {
        tags: ["Clients"],
        summary: "Get a client by ID",
        description: "Returns the full client profile including billing/shipping addresses, custom fields, and financial summary.",
        operationId: "getClient",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Client details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Client" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Clients"],
        summary: "Update a client",
        description: "Updates an existing client's profile. Requires Sales role or higher.",
        operationId: "updateClient",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClient" } } },
        },
        responses: {
          200: { description: "Client updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Clients"],
        summary: "Delete a client",
        description: "Permanently deletes a client. Fails if the client has existing invoices or payments. Requires Sales role or higher.",
        operationId: "deleteClient",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Client deleted" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/clients/{id}/contacts": {
      get: {
        tags: ["Clients"],
        summary: "List contacts for a client",
        description: "Returns all contact persons associated with a client.",
        operationId: "listClientContacts",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Contact list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ClientContact" } } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Clients"],
        summary: "Add a contact to a client",
        description: "Adds a new contact person to an existing client. Requires Sales role or higher.",
        operationId: "addClientContact",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ClientContact" } } },
        },
        responses: {
          201: { description: "Contact added" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/clients/{id}/statement": {
      get: {
        tags: ["Clients"],
        summary: "Get client statement",
        description: "Returns a chronological list of all transactions (invoices, payments, credit notes) for a client in a given date range.",
        operationId: "getClientStatement",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Start date (defaults to 12 months ago)" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "End date (defaults to today)" },
        ],
        responses: {
          200: { description: "Client statement with transactions" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/clients/{id}/balance": {
      get: {
        tags: ["Clients"],
        summary: "Get client balance",
        description: "Returns the client's current outstanding balance, total billed, and total paid amounts.",
        operationId: "getClientBalance",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Client balance details" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/clients/{id}/payment-method": {
      put: {
        tags: ["Clients"],
        summary: "Update client payment method",
        description: "Saves or updates a client's payment method (tokenized via payment gateway). Used for auto-charging recurring invoices. Requires Accountant role or higher.",
        operationId: "updateClientPaymentMethod",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { gatewayId: { type: "string" }, token: { type: "string" } } } } },
        },
        responses: {
          200: { description: "Payment method updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      delete: {
        tags: ["Clients"],
        summary: "Remove client payment method",
        description: "Removes a client's saved payment method. Requires Accountant role or higher.",
        operationId: "removeClientPaymentMethod",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Payment method removed" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        description: "Returns a paginated list of products and services. Filter by type (goods/services) and search by name or SKU.",
        operationId: "listProducts",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "type", in: "query", schema: { type: "string", enum: ["goods", "services"] }, description: "Filter by product type" },
        ],
        responses: {
          200: { description: "Paginated product list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Product" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create a product",
        description: "Creates a new product or service in the catalog. Requires Accountant role or higher.",
        operationId: "createProduct",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProduct" } } },
        },
        responses: {
          201: { description: "Product created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Product" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/products/export/csv": {
      get: {
        tags: ["Products"],
        summary: "Export products to CSV",
        operationId: "exportProductsCsv",
        responses: { 200: { description: "CSV file download", content: { "text/csv": { schema: { type: "string" } } } } },
      },
    },
    "/api/v1/products/import/csv": {
      post: {
        tags: ["Products"],
        summary: "Import products from CSV",
        description: "Imports products from a CSV file. Requires Accountant role or higher.",
        operationId: "importProductsCsv",
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
        operationId: "getProduct",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Product details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Product" } } }] } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Products"],
        summary: "Update a product",
        operationId: "updateProduct",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProduct" } } },
        },
        responses: {
          200: { description: "Product updated" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete a product",
        operationId: "deleteProduct",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Product deleted" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/products/tax-rates": {
      get: {
        tags: ["Products"],
        summary: "List tax rates",
        description: "Returns all configured tax rates (GST, VAT, sales tax, custom).",
        operationId: "listTaxRates",
        responses: {
          200: { description: "Tax rate list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/TaxRate" } } } }] } } } },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create a tax rate",
        operationId: "createTaxRate",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["name", "rate"], properties: { name: { type: "string", example: "GST 18%" }, rate: { type: "number", example: 18 }, type: { type: "string" }, isCompound: { type: "boolean" } } } } },
        },
        responses: { 201: { description: "Tax rate created" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/products/tax-rates/{id}": {
      put: {
        tags: ["Products"],
        summary: "Update a tax rate",
        operationId: "updateTaxRate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, rate: { type: "number" }, isCompound: { type: "boolean" } } } } },
        },
        responses: { 200: { description: "Tax rate updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete a tax rate",
        operationId: "deleteTaxRate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Tax rate deleted" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // INVOICES
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/invoices": {
      get: {
        tags: ["Invoices"],
        summary: "List invoices",
        description: "Returns a paginated list of invoices. Filter by status, client, and date range.",
        operationId: "listInvoices",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "written_off"] } },
          { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Filter by issue date from" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Filter by issue date to" },
        ],
        responses: {
          200: { description: "Paginated invoice list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Invoice" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Invoices"],
        summary: "Create an invoice",
        description: "Creates a new invoice with line items. Tax is auto-calculated based on the tax rates assigned to each item. The invoice is created in `draft` status. Requires Sales role or higher.",
        operationId: "createInvoice",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoice" }, example: { clientId: "550e8400-e29b-41d4-a716-446655440000", issueDate: "2026-03-23", dueDate: "2026-04-22", currency: "INR", items: [{ name: "Web Development", quantity: 20, unit: "hours", rate: 500000, taxRateId: "tax-rate-uuid" }], notes: "Thank you for your business!" } } },
        },
        responses: {
          201: { description: "Invoice created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/invoices \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "clientId": "550e8400-e29b-41d4-a716-446655440000",\n    "issueDate": "2026-03-23",\n    "dueDate": "2026-04-22",\n    "currency": "INR",\n    "items": [\n      {\n        "name": "Web Development",\n        "quantity": 20,\n        "unit": "hours",\n        "rate": 500000,\n        "taxRateId": "tax-rate-uuid"\n      }\n    ],\n    "notes": "Thank you for your business!"\n  }\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/invoices", {\n  method: "POST",\n  headers: {\n    "Authorization": `Bearer ${accessToken}`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    clientId: "550e8400-e29b-41d4-a716-446655440000",\n    issueDate: "2026-03-23",\n    dueDate: "2026-04-22",\n    currency: "INR",\n    items: [\n      { name: "Web Development", quantity: 20, unit: "hours", rate: 500000 }\n    ]\n  })\n});\nconst { data: invoice } = await response.json();\nconsole.log("Invoice created:", invoice.invoiceNumber);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/invoices",\n    headers={"Authorization": f"Bearer {access_token}"},\n    json={\n        "clientId": "550e8400-e29b-41d4-a716-446655440000",\n        "issueDate": "2026-03-23",\n        "dueDate": "2026-04-22",\n        "currency": "INR",\n        "items": [\n            {"name": "Web Development", "quantity": 20, "unit": "hours", "rate": 500000}\n        ]\n    }\n)\ninvoice = response.json()["data"]\nprint(f"Invoice created: {invoice[\'invoiceNumber\']}")',
          },
        ],
      },
    },
    "/api/v1/invoices/bulk-pdf": {
      post: {
        tags: ["Invoices"],
        summary: "Bulk download invoices as PDF",
        description: "Generates PDFs for multiple invoices and returns them as a ZIP archive.",
        operationId: "bulkDownloadInvoicePdf",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string", format: "uuid" }, description: "Invoice IDs to include" } } } } },
        },
        responses: {
          200: { description: "ZIP file containing invoice PDFs", content: { "application/zip": { schema: { type: "string", format: "binary" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/invoices/{id}": {
      get: {
        tags: ["Invoices"],
        summary: "Get an invoice by ID",
        description: "Returns the full invoice including line items, tax breakdown, and payment history.",
        operationId: "getInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Invoice with items", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { allOf: [{ $ref: "#/components/schemas/Invoice" }, { properties: { items: { type: "array", items: { $ref: "#/components/schemas/InvoiceItem" } } } }] } } }] } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Invoices"],
        summary: "Update an invoice",
        description: "Updates an existing invoice. Only draft invoices can be fully edited. Sent invoices can only have notes and terms updated.",
        operationId: "updateInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateInvoice" } } },
        },
        responses: {
          200: { description: "Invoice updated" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Invoices"],
        summary: "Delete an invoice",
        description: "Permanently deletes an invoice. Only draft invoices can be deleted. Use void for sent invoices. Requires Accountant role or higher.",
        operationId: "deleteInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Invoice deleted" },
          400: { description: "Cannot delete non-draft invoice" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/send": {
      post: {
        tags: ["Invoices"],
        summary: "Send an invoice to client via email",
        description: "Sends the invoice to the client's email address. Changes status from `draft` to `sent`. Requires Sales role or higher.",
        operationId: "sendInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Invoice sent" },
          400: { description: "Invoice already sent or void" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/duplicate": {
      post: {
        tags: ["Invoices"],
        summary: "Duplicate an invoice",
        description: "Creates a copy of the invoice with a new number, today's date, and `draft` status. Line items are copied.",
        operationId: "duplicateInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          201: { description: "Duplicated invoice", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/void": {
      post: {
        tags: ["Invoices"],
        summary: "Void an invoice",
        description: "Marks an invoice as void. Voided invoices cannot be edited or paid. Use this instead of delete for sent invoices. Requires Accountant role or higher.",
        operationId: "voidInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Invoice voided" },
          400: { description: "Invoice already void or paid" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/write-off": {
      post: {
        tags: ["Invoices"],
        summary: "Write off an invoice",
        description: "Writes off an unpaid or partially paid invoice as bad debt. The outstanding amount is recorded as a write-off. Requires Accountant role or higher.",
        operationId: "writeOffInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Invoice written off" },
          400: { description: "Invoice already paid or void" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/pdf": {
      get: {
        tags: ["Invoices"],
        summary: "Download invoice as PDF",
        description: "Generates and returns the invoice as a PDF file using the configured template.",
        operationId: "downloadInvoicePdf",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/invoices/{id}/payments": {
      get: {
        tags: ["Invoices"],
        summary: "List payments for an invoice",
        description: "Returns all payments recorded against a specific invoice.",
        operationId: "listInvoicePayments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Payment list for invoice", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Payment" } } } }] } } } },
          404: { $ref: "#/components/responses/NotFound" },
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
        description: "Returns a paginated list of quotes/estimates. Filter by status and client.",
        operationId: "listQuotes",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"] } },
          { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Paginated quote list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Quote" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Quotes"],
        summary: "Create a quote",
        description: "Creates a new quote/estimate with line items and an expiry date.",
        operationId: "createQuote",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateQuote" } } },
        },
        responses: {
          201: { description: "Quote created" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/quotes/{id}": {
      get: {
        tags: ["Quotes"],
        summary: "Get a quote by ID",
        operationId: "getQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Quote details" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Quotes"],
        summary: "Update a quote",
        operationId: "updateQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateQuote" } } },
        },
        responses: { 200: { description: "Quote updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Quotes"],
        summary: "Delete a quote",
        operationId: "deleteQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/quotes/{id}/send": {
      post: {
        tags: ["Quotes"],
        summary: "Send a quote to client",
        description: "Sends the quote to the client's email with a link to view and accept/decline in the portal.",
        operationId: "sendQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote sent" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/quotes/{id}/convert": {
      post: {
        tags: ["Quotes"],
        summary: "Convert a quote to an invoice",
        description: "Converts an accepted quote into a draft invoice. The quote status changes to `converted`.",
        operationId: "convertQuoteToInvoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          201: { description: "Invoice created from quote", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
          400: { description: "Quote not in accepted status" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/quotes/{id}/pdf": {
      get: {
        tags: ["Quotes"],
        summary: "Download quote as PDF",
        operationId: "downloadQuotePdf",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/quotes/{id}/accept": {
      post: {
        tags: ["Quotes"],
        summary: "Accept a quote",
        operationId: "acceptQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote accepted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/quotes/{id}/decline": {
      post: {
        tags: ["Quotes"],
        summary: "Decline a quote",
        operationId: "declineQuote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote declined" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PAYMENTS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/payments": {
      get: {
        tags: ["Payments"],
        summary: "List payments",
        description: "Returns a paginated list of all recorded payments. Filter by client or payment method.",
        operationId: "listPayments",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "method", in: "query", schema: { type: "string", enum: ["cash", "bank_transfer", "cheque", "upi", "card", "gateway", "other"] } },
        ],
        responses: {
          200: { description: "Paginated payment list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Payment" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Payments"],
        summary: "Record a payment",
        description: "Records a payment against an invoice. Supports full or partial payments. The invoice status auto-updates to `partially_paid` or `paid`. Requires Accountant role or higher.",
        operationId: "recordPayment",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreatePayment" } } },
        },
        responses: {
          201: { description: "Payment recorded" },
          400: { description: "Payment exceeds invoice amount due" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/payments/{id}": {
      get: {
        tags: ["Payments"],
        summary: "Get a payment by ID",
        operationId: "getPayment",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Payment details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Payment" } } }] } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Payments"],
        summary: "Delete a payment",
        description: "Deletes a payment record and reverses the invoice payment status accordingly. Requires Accountant role or higher.",
        operationId: "deletePayment",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Payment deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/payments/{id}/refund": {
      post: {
        tags: ["Payments"],
        summary: "Refund a payment",
        description: "Issues a full or partial refund for a payment. A credit note is automatically created for the refund amount. Requires Accountant role or higher.",
        operationId: "refundPayment",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RefundRequest" } } },
        },
        responses: {
          200: { description: "Payment refunded" },
          400: { description: "Refund amount exceeds original payment" },
        },
      },
    },
    "/api/v1/payments/{id}/receipt": {
      get: {
        tags: ["Payments"],
        summary: "Download payment receipt PDF",
        description: "Generates and returns a payment receipt as a PDF file.",
        operationId: "downloadPaymentReceipt",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Receipt PDF", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          404: { $ref: "#/components/responses/NotFound" },
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
        description: "Returns a paginated list of credit notes.",
        operationId: "listCreditNotes",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Paginated credit note list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/CreditNote" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Credit Notes"],
        summary: "Create a credit note",
        description: "Creates a credit note linked to an invoice. The credit note can later be applied to reduce the balance of this or another invoice. Requires Accountant role or higher.",
        operationId: "createCreditNote",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCreditNote" } } },
        },
        responses: {
          201: { description: "Credit note created" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/credit-notes/{id}": {
      get: {
        tags: ["Credit Notes"],
        summary: "Get a credit note by ID",
        operationId: "getCreditNote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Credit note details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Credit Notes"],
        summary: "Delete a credit note",
        operationId: "deleteCreditNote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Credit note deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/credit-notes/{id}/apply": {
      post: {
        tags: ["Credit Notes"],
        summary: "Apply a credit note to an invoice",
        description: "Applies a credit note's balance to reduce the amount due on an invoice. You can apply a partial amount.",
        operationId: "applyCreditNote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ApplyCreditNote" } } },
        },
        responses: {
          200: { description: "Credit note applied" },
          400: { description: "Insufficient credit note balance or invalid invoice" },
        },
      },
    },
    "/api/v1/credit-notes/{id}/void": {
      post: {
        tags: ["Credit Notes"],
        summary: "Void a credit note",
        description: "Voids a credit note. Only unused (unapplied) credit notes can be voided.",
        operationId: "voidCreditNote",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Credit note voided" }, 400: { description: "Credit note already applied" } },
      },
    },
    "/api/v1/credit-notes/{id}/pdf": {
      get: {
        tags: ["Credit Notes"],
        summary: "Download credit note as PDF",
        operationId: "downloadCreditNotePdf",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          404: { $ref: "#/components/responses/NotFound" },
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
        description: "Returns a paginated list of vendors/suppliers.",
        operationId: "listVendors",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Paginated vendor list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Vendor" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Vendors"],
        summary: "Create a vendor",
        operationId: "createVendor",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" } } } } },
        },
        responses: { 201: { description: "Vendor created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/vendors/{id}": {
      get: {
        tags: ["Vendors"],
        summary: "Get a vendor by ID",
        operationId: "getVendor",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Vendor details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Vendors"],
        summary: "Update a vendor",
        operationId: "updateVendor",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" } } } } },
        },
        responses: { 200: { description: "Vendor updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Vendors"],
        summary: "Delete a vendor",
        operationId: "deleteVendor",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Vendor deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // EXPENSES
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/expenses/categories": {
      get: {
        tags: ["Expenses"],
        summary: "List expense categories",
        operationId: "listExpenseCategories",
        responses: {
          200: { description: "Category list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ExpenseCategory" } } } }] } } } },
        },
      },
      post: {
        tags: ["Expenses"],
        summary: "Create an expense category",
        operationId: "createExpenseCategory",
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
        description: "Returns a paginated list of expenses with filtering by category, client, status, billable flag, and date range.",
        operationId: "listExpenses",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "categoryId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
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
        summary: "Create an expense",
        operationId: "createExpense",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExpense" } } },
        },
        responses: { 201: { description: "Expense created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/expenses/{id}": {
      get: {
        tags: ["Expenses"],
        summary: "Get an expense by ID",
        operationId: "getExpense",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Expense details", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Expense" } } }] } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Expenses"],
        summary: "Update an expense",
        operationId: "updateExpense",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateExpense" } } },
        },
        responses: { 200: { description: "Expense updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete an expense",
        operationId: "deleteExpense",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Expense deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/expenses/{id}/approve": {
      post: {
        tags: ["Expenses"],
        summary: "Approve an expense",
        description: "Approves a pending expense. Requires Accountant role or higher.",
        operationId: "approveExpense",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Expense approved" }, 400: { description: "Expense not in pending status" } },
      },
    },
    "/api/v1/expenses/{id}/reject": {
      post: {
        tags: ["Expenses"],
        summary: "Reject an expense",
        operationId: "rejectExpense",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Expense rejected" }, 400: { description: "Expense not in pending status" } },
      },
    },
    "/api/v1/expenses/{id}/bill": {
      post: {
        tags: ["Expenses"],
        summary: "Bill an expense to client",
        description: "Converts a billable expense into an invoice line item and creates a draft invoice. The expense status changes to `billed`.",
        operationId: "billExpense",
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
          400: { description: "Expense is not billable or not approved" },
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
        operationId: "listRecurringProfiles",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Paginated recurring profile list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/RecurringProfile" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Recurring"],
        summary: "Create a recurring profile",
        description: "Creates a recurring invoice profile that automatically generates invoices on a schedule.",
        operationId: "createRecurringProfile",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["clientId", "frequency", "startDate", "items"], properties: { clientId: { type: "string" }, frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly", "custom"] }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, maxOccurrences: { type: "integer" }, autoSend: { type: "boolean" }, autoCharge: { type: "boolean" }, items: { type: "array", items: { type: "object" } } } } } },
        },
        responses: { 201: { description: "Recurring profile created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/recurring/{id}": {
      get: {
        tags: ["Recurring"],
        summary: "Get a recurring profile",
        operationId: "getRecurringProfile",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Recurring profile details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Recurring"],
        summary: "Update a recurring profile",
        operationId: "updateRecurringProfile",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Profile updated" } },
      },
      delete: {
        tags: ["Recurring"],
        summary: "Delete a recurring profile",
        operationId: "deleteRecurringProfile",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Profile deleted" } },
      },
    },
    "/api/v1/recurring/{id}/pause": {
      post: {
        tags: ["Recurring"],
        summary: "Pause a recurring profile",
        description: "Pauses the recurring profile. No new invoices will be generated until resumed.",
        operationId: "pauseRecurringProfile",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Profile paused" } },
      },
    },
    "/api/v1/recurring/{id}/resume": {
      post: {
        tags: ["Recurring"],
        summary: "Resume a recurring profile",
        operationId: "resumeRecurringProfile",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Profile resumed" } },
      },
    },
    "/api/v1/recurring/{id}/executions": {
      get: {
        tags: ["Recurring"],
        summary: "List execution history",
        description: "Returns the history of invoice generation events for a recurring profile.",
        operationId: "listRecurringExecutions",
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
        description: "Returns key metrics for the dashboard: total revenue, outstanding balance, overdue amount, and recent activity. Requires Accountant role or higher.",
        operationId: "getDashboardStats",
        responses: { 200: { description: "Dashboard stats: revenue, outstanding, overdue, recent activity" }, 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/reports/revenue": {
      get: {
        tags: ["Reports"],
        summary: "Revenue report",
        description: "Returns revenue data grouped by month for a date range. Includes total invoiced, total collected, and breakdown by client.",
        operationId: "getRevenueReport",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Start date (defaults to fiscal year start)" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "End date (defaults to today)" },
        ],
        responses: { 200: { description: "Revenue report data" } },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X GET "http://localhost:4001/api/v1/reports/revenue?from=2026-01-01&to=2026-03-31" \\\n  -H "Authorization: Bearer <token>"',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch(\n  "http://localhost:4001/api/v1/reports/revenue?from=2026-01-01&to=2026-03-31",\n  { headers: { "Authorization": `Bearer ${accessToken}` } }\n);\nconst { data } = await response.json();\nconsole.log("Total revenue:", data.totalRevenue);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.get(\n    "http://localhost:4001/api/v1/reports/revenue",\n    headers={"Authorization": f"Bearer {access_token}"},\n    params={"from": "2026-01-01", "to": "2026-03-31"}\n)\ndata = response.json()["data"]\nprint(f"Total revenue: {data[\'totalRevenue\']}")',
          },
        ],
      },
    },
    "/api/v1/reports/receivables": {
      get: {
        tags: ["Reports"],
        summary: "Receivables report",
        description: "Returns current receivables: total outstanding, broken down by client.",
        operationId: "getReceivablesReport",
        responses: { 200: { description: "Receivables data" } },
      },
    },
    "/api/v1/reports/aging": {
      get: {
        tags: ["Reports"],
        summary: "Receivables aging report",
        description: "Returns receivables aging buckets: current (not yet due), 1-30 days overdue, 31-60, 61-90, and 90+ days.",
        operationId: "getAgingReport",
        responses: { 200: { description: "Aging data with buckets" } },
      },
    },
    "/api/v1/reports/expenses": {
      get: {
        tags: ["Reports"],
        summary: "Expense report",
        description: "Returns expense totals grouped by category for a date range.",
        operationId: "getExpenseReport",
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
        description: "Returns profit and loss data: total revenue minus total expenses for a date range.",
        operationId: "getProfitLossReport",
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
        summary: "Tax report",
        description: "Returns a tax summary for the specified period. Supports GST (CGST/SGST/IGST breakdown, GSTR-1 data), VAT, and sales tax. Use `type=gstr1` query parameter for GSTR-1 formatted output.",
        operationId: "getTaxReport",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["summary", "gstr1", "vat"] }, description: "Report format: summary (default), gstr1 (India GST Return), vat (UK/EU)" },
        ],
        responses: { 200: { description: "Tax report data" } },
      },
    },
    "/api/v1/reports/clients/top": {
      get: {
        tags: ["Reports"],
        summary: "Top clients by revenue",
        description: "Returns the top clients ranked by total revenue.",
        operationId: "getTopClients",
        responses: { 200: { description: "Top clients list" } },
      },
    },
    "/api/v1/reports/revenue/export": {
      get: {
        tags: ["Reports"],
        summary: "Export revenue report as CSV",
        operationId: "exportRevenueReport",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
      },
    },
    "/api/v1/reports/receivables/export": {
      get: {
        tags: ["Reports"],
        summary: "Export receivables report as CSV",
        operationId: "exportReceivablesReport",
        responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
      },
    },
    "/api/v1/reports/expenses/export": {
      get: {
        tags: ["Reports"],
        summary: "Export expense report as CSV",
        operationId: "exportExpenseReport",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
      },
    },
    "/api/v1/reports/tax/export": {
      get: {
        tags: ["Reports"],
        summary: "Export tax report as CSV",
        description: "Exports the tax report as a CSV. Use `type=gstr1` for GSTR-1 compliant export.",
        operationId: "exportTaxReport",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["summary", "gstr1", "vat"] } },
        ],
        responses: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // DISPUTES
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/disputes": {
      get: {
        tags: ["Disputes"],
        summary: "List disputes",
        description: "Returns a paginated list of invoice disputes. Admin view showing all disputes across clients.",
        operationId: "listDisputes",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["open", "under_review", "resolved", "rejected"] } },
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
        operationId: "getDispute",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Dispute details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Disputes"],
        summary: "Update a dispute (resolve/reject)",
        description: "Updates the dispute status to `under_review`, `resolved`, or `rejected`. Include a resolution message when resolving.",
        operationId: "updateDispute",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["under_review", "resolved", "rejected"] }, resolution: { type: "string", description: "Resolution message (required when resolving)" } } } } },
        },
        responses: { 200: { description: "Dispute updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PORTAL
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/portal/branding": {
      get: {
        tags: ["Portal"],
        summary: "Get portal branding",
        description: "Returns the public branding configuration (logo, colors, org name) for the client portal. No authentication required.",
        operationId: "getPortalBranding",
        security: [],
        responses: { 200: { description: "Portal branding data including logo URL, colors, and organization name" } },
      },
    },
    "/api/v1/portal/login": {
      post: {
        tags: ["Portal"],
        summary: "Client portal login",
        description: "Authenticates a client for the portal. Returns a portal-specific JWT token.",
        operationId: "portalLogin",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } } } },
        },
        responses: { 200: { description: "Portal login successful" }, 401: { description: "Invalid credentials" } },
      },
    },
    "/api/v1/portal/dashboard": {
      get: {
        tags: ["Portal"],
        summary: "Client portal dashboard",
        description: "Returns dashboard data for the logged-in client: outstanding balance, recent invoices, and payment history.",
        operationId: "getPortalDashboard",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Portal dashboard data" } },
      },
    },
    "/api/v1/portal/invoices": {
      get: {
        tags: ["Portal"],
        summary: "List client invoices (portal)",
        operationId: "getPortalInvoices",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's invoice list" } },
      },
    },
    "/api/v1/portal/invoices/{id}": {
      get: {
        tags: ["Portal"],
        summary: "Get a single invoice (portal)",
        operationId: "getPortalInvoice",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Invoice details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/portal/invoices/{id}/pdf": {
      get: {
        tags: ["Portal"],
        summary: "Download invoice PDF (portal)",
        operationId: "getPortalInvoicePdf",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } } },
      },
    },
    "/api/v1/portal/quotes": {
      get: {
        tags: ["Portal"],
        summary: "List client quotes (portal)",
        operationId: "getPortalQuotes",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's quote list" } },
      },
    },
    "/api/v1/portal/quotes/{id}/accept": {
      post: {
        tags: ["Portal"],
        summary: "Accept a quote (portal)",
        operationId: "acceptPortalQuote",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote accepted" } },
      },
    },
    "/api/v1/portal/quotes/{id}/decline": {
      post: {
        tags: ["Portal"],
        summary: "Decline a quote (portal)",
        operationId: "declinePortalQuote",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Quote declined" } },
      },
    },
    "/api/v1/portal/credit-notes": {
      get: {
        tags: ["Portal"],
        summary: "List credit notes (portal)",
        operationId: "getPortalCreditNotes",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's credit notes" } },
      },
    },
    "/api/v1/portal/payments": {
      get: {
        tags: ["Portal"],
        summary: "List payments (portal)",
        operationId: "getPortalPayments",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's payment list" } },
      },
    },
    "/api/v1/portal/statement": {
      get: {
        tags: ["Portal"],
        summary: "Get client statement (portal)",
        operationId: "getPortalStatement",
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
        operationId: "getPortalDisputes",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's disputes" } },
      },
      post: {
        tags: ["Portal"],
        summary: "Create a dispute (portal)",
        description: "Allows a client to raise a dispute on an invoice they have received.",
        operationId: "createPortalDispute",
        security: [{ PortalAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["invoiceId", "reason"], properties: { invoiceId: { type: "string", format: "uuid" }, reason: { type: "string" } } } } },
        },
        responses: { 201: { description: "Dispute created" } },
      },
    },
    "/api/v1/portal/disputes/{id}": {
      get: {
        tags: ["Portal"],
        summary: "Get a dispute (portal)",
        operationId: "getPortalDispute",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Dispute details" } },
      },
    },
    "/api/v1/portal/subscriptions": {
      get: {
        tags: ["Portal"],
        summary: "List subscriptions (portal)",
        operationId: "getPortalSubscriptions",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Client's subscriptions" } },
      },
    },
    "/api/v1/portal/subscriptions/{id}": {
      get: {
        tags: ["Portal"],
        summary: "Get a subscription (portal)",
        operationId: "getPortalSubscription",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Subscription details" } },
      },
    },
    "/api/v1/portal/subscriptions/{id}/change-plan": {
      post: {
        tags: ["Portal"],
        summary: "Change subscription plan (portal)",
        description: "Allows a client to upgrade or downgrade their subscription plan.",
        operationId: "portalChangePlan",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["planId"], properties: { planId: { type: "string", format: "uuid" } } } } },
        },
        responses: { 200: { description: "Plan changed" } },
      },
    },
    "/api/v1/portal/subscriptions/{id}/cancel": {
      post: {
        tags: ["Portal"],
        summary: "Cancel a subscription (portal)",
        operationId: "portalCancelSubscription",
        security: [{ PortalAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Subscription cancelled" } },
      },
    },
    "/api/v1/portal/plans": {
      get: {
        tags: ["Portal"],
        summary: "List available plans (portal)",
        operationId: "getPortalPlans",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Available plans" } },
      },
    },
    "/api/v1/portal/payment-method": {
      get: {
        tags: ["Portal"],
        summary: "Get saved payment method (portal)",
        operationId: "getPortalPaymentMethod",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Payment method details" } },
      },
      put: {
        tags: ["Portal"],
        summary: "Update payment method (portal)",
        operationId: "updatePortalPaymentMethod",
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
        operationId: "removePortalPaymentMethod",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Payment method removed" } },
      },
    },
    "/api/v1/portal/payment-gateways": {
      get: {
        tags: ["Portal"],
        summary: "List available payment gateways (portal)",
        operationId: "listPortalGateways",
        security: [{ PortalAuth: [] }],
        responses: { 200: { description: "Gateway list" } },
      },
    },
    "/api/v1/portal/pay": {
      post: {
        tags: ["Portal"],
        summary: "Create a payment order (portal)",
        description: "Initiates an online payment for an invoice via the specified gateway. Returns gateway-specific data (e.g., Stripe client secret, Razorpay order ID).",
        operationId: "createPortalPaymentOrder",
        security: [{ PortalAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["invoiceId", "gatewayId"], properties: { invoiceId: { type: "string", format: "uuid" }, gatewayId: { type: "string" }, amount: { type: "integer", description: "Optional: partial payment amount in smallest currency unit" } } } } },
        },
        responses: { 200: { description: "Payment order created with gateway-specific data" } },
      },
    },
    "/api/v1/portal/verify-payment": {
      post: {
        tags: ["Portal"],
        summary: "Verify a payment after gateway redirect (portal)",
        description: "Verifies the payment after the client completes the gateway flow. Records the payment against the invoice.",
        operationId: "verifyPortalPayment",
        security: [{ PortalAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { orderId: { type: "string" }, gatewayId: { type: "string" }, paymentData: { type: "object" } } } } },
        },
        responses: { 200: { description: "Payment verified and recorded" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // WEBHOOKS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook subscriptions",
        description: "Returns all webhook subscriptions for the organization.",
        operationId: "listWebhooks",
        responses: {
          200: { description: "Webhook list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } } } }] } } } },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create a webhook",
        description: "Subscribes a URL to receive events. Requires Admin role. The webhook will receive POST requests with a JSON payload for each subscribed event. If a `secret` is provided, each delivery includes an `X-Webhook-Signature` header (HMAC-SHA256).",
        operationId: "createWebhook",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWebhook" }, example: { url: "https://example.com/webhooks/billing", events: ["invoice.created", "payment.received"], secret: "whsec_your_secret_here" } } },
        },
        responses: {
          201: { description: "Webhook created", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Webhook" } } }] } } } },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/webhooks \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "url": "https://example.com/webhooks/billing",\n    "events": ["invoice.created", "payment.received"],\n    "secret": "whsec_your_secret_here"\n  }\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/webhooks", {\n  method: "POST",\n  headers: {\n    "Authorization": `Bearer ${accessToken}`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    url: "https://example.com/webhooks/billing",\n    events: ["invoice.created", "payment.received"],\n    secret: "whsec_your_secret_here"\n  })\n});\nconst { data: webhook } = await response.json();\nconsole.log("Webhook ID:", webhook.id);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/webhooks",\n    headers={"Authorization": f"Bearer {access_token}"},\n    json={\n        "url": "https://example.com/webhooks/billing",\n        "events": ["invoice.created", "payment.received"],\n        "secret": "whsec_your_secret_here"\n    }\n)\nwebhook = response.json()["data"]\nprint(f"Webhook ID: {webhook[\'id\']}")',
          },
        ],
      },
    },
    "/api/v1/webhooks/{id}": {
      put: {
        tags: ["Webhooks"],
        summary: "Update a webhook",
        operationId: "updateWebhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWebhook" } } },
        },
        responses: { 200: { description: "Webhook updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Webhooks"],
        summary: "Delete a webhook",
        operationId: "deleteWebhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Webhook deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/webhooks/{id}/test": {
      post: {
        tags: ["Webhooks"],
        summary: "Send a test event to a webhook",
        description: "Sends a test `ping` event to the webhook URL to verify connectivity. Returns the HTTP status code from the target.",
        operationId: "testWebhook",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Test event sent, response from target included" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/webhooks/{id}/deliveries": {
      get: {
        tags: ["Webhooks"],
        summary: "List delivery logs for a webhook",
        description: "Returns the delivery history for a webhook, including HTTP status codes, response bodies, and timestamps.",
        operationId: "listWebhookDeliveries",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Delivery log list" } },
      },
    },
    "/api/v1/webhooks/{id}/deliveries/{deliveryId}/retry": {
      post: {
        tags: ["Webhooks"],
        summary: "Retry a failed webhook delivery",
        operationId: "retryWebhookDelivery",
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
        description: "Returns all settings for the organization including branding, numbering, tax configuration, and payment gateway settings.",
        operationId: "getSettings",
        responses: { 200: { description: "Settings object" } },
      },
      put: {
        tags: ["Settings"],
        summary: "Update organization settings",
        description: "Updates organization-level settings. Requires Admin role.",
        operationId: "updateSettings",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateOrganization" } } },
        },
        responses: { 200: { description: "Settings updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/settings/branding": {
      put: {
        tags: ["Settings"],
        summary: "Update branding (logo, colors)",
        description: "Updates the organization's branding used in invoices, quotes, and the client portal. Requires Admin role.",
        operationId: "updateBranding",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { logoUrl: { type: "string" }, primaryColor: { type: "string", example: "#4F46E5" }, accentColor: { type: "string", example: "#10B981" } } } } },
        },
        responses: { 200: { description: "Branding updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/settings/numbering": {
      get: {
        tags: ["Settings"],
        summary: "Get invoice/quote numbering configuration",
        description: "Returns the current numbering format and next number for invoices, quotes, and credit notes.",
        operationId: "getNumberingConfig",
        responses: { 200: { description: "Numbering config" } },
      },
      put: {
        tags: ["Settings"],
        summary: "Update numbering configuration",
        description: "Updates the prefix and next number for invoices, quotes, and credit notes. Requires Admin role.",
        operationId: "updateNumberingConfig",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { invoicePrefix: { type: "string", example: "INV-" }, quotePrefix: { type: "string", example: "QTE-" }, creditNotePrefix: { type: "string", example: "CN-" }, nextInvoiceNumber: { type: "integer", example: 1001 } } } } },
        },
        responses: { 200: { description: "Numbering updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/settings/email-templates": {
      get: {
        tags: ["Settings"],
        summary: "List email templates",
        description: "Returns all configurable email templates (invoice_sent, payment_received, quote_sent, payment_reminder, etc.).",
        operationId: "listEmailTemplates",
        responses: { 200: { description: "Email template list" } },
      },
    },
    "/api/v1/settings/email-templates/{name}": {
      put: {
        tags: ["Settings"],
        summary: "Update an email template",
        description: "Updates the subject and body of a specific email template. Templates support Handlebars variables like `{{invoiceNumber}}`, `{{clientName}}`, `{{amountDue}}`.",
        operationId: "updateEmailTemplate",
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" }, description: "Template name: invoice_sent, payment_received, quote_sent, payment_reminder" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } } } } },
        },
        responses: { 200: { description: "Template updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CURRENCY
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/currency/rates": {
      get: {
        tags: ["Currency"],
        summary: "Get current exchange rates",
        description: "Returns exchange rates relative to the organization's base currency. Rates are updated periodically from open exchange rate APIs.",
        operationId: "getExchangeRates",
        responses: { 200: { description: "Exchange rate map (currency code to rate)" } },
      },
    },
    "/api/v1/currency/convert": {
      post: {
        tags: ["Currency"],
        summary: "Convert an amount between currencies",
        description: "Converts an amount from one currency to another using current exchange rates. Amount is in smallest currency unit.",
        operationId: "convertCurrency",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["amount", "from", "to"], properties: { amount: { type: "integer", example: 10000, description: "Amount in smallest currency unit" }, from: { type: "string", example: "USD" }, to: { type: "string", example: "INR" } } } } },
        },
        responses: { 200: { description: "Converted amount with exchange rate used" } },
      },
    },
    "/api/v1/currency/currencies": {
      get: {
        tags: ["Currency"],
        summary: "List supported currencies",
        description: "Returns all 170+ supported currencies with their codes, names, and symbols.",
        operationId: "listCurrencies",
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
        operationId: "uploadFile",
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          200: { description: "File uploaded", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/UploadedFile" } } }] } } } },
          400: { description: "No file uploaded or invalid file type" },
        },
      },
    },
    "/api/v1/uploads/receipts": {
      post: {
        tags: ["Uploads"],
        summary: "Upload a receipt image (for expense OCR scanning)",
        description: "Uploads a receipt image (JPEG, PNG, or PDF). If OCR is enabled, the receipt is scanned and text is extracted.",
        operationId: "uploadReceipt",
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
        operationId: "uploadAttachment",
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
        summary: "Global search",
        description: "Searches across invoices, clients, quotes, payments, and expenses. Results are grouped by entity type.",
        operationId: "globalSearch",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Search query (min 2 characters)" },
          { name: "type", in: "query", schema: { type: "string", enum: ["invoice", "client", "quote", "payment", "expense"] }, description: "Limit search to a specific entity type" },
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
        summary: "List notifications",
        description: "Returns a paginated list of notifications for the current user.",
        operationId: "listNotifications",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
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
        operationId: "getUnreadNotificationCount",
        responses: { 200: { description: "Unread count", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "object", properties: { count: { type: "integer" } } } } }] } } } } },
      },
    },
    "/api/v1/notifications/{id}/read": {
      put: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
        operationId: "markNotificationRead",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Notification marked as read" } },
      },
    },
    "/api/v1/notifications/mark-all-read": {
      post: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        operationId: "markAllNotificationsRead",
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
        operationId: "listScheduledReports",
        responses: {
          200: { description: "Scheduled report list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ScheduledReport" } } } }] } } } },
        },
      },
      post: {
        tags: ["Scheduled Reports"],
        summary: "Create a scheduled report",
        description: "Creates a scheduled report that is automatically emailed to recipients on a schedule. Requires Accountant role or higher.",
        operationId: "createScheduledReport",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["reportType", "frequency", "recipients"], properties: { reportType: { type: "string", description: "Report type: revenue, receivables, expenses, tax, aging, profit_loss" }, frequency: { type: "string", enum: ["daily", "weekly", "monthly"] }, recipients: { type: "array", items: { type: "string", format: "email" } } } } } },
        },
        responses: { 201: { description: "Scheduled report created" } },
      },
    },
    "/api/v1/scheduled-reports/{id}": {
      put: {
        tags: ["Scheduled Reports"],
        summary: "Update a scheduled report",
        operationId: "updateScheduledReport",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { reportType: { type: "string" }, frequency: { type: "string" }, recipients: { type: "array", items: { type: "string" } }, isActive: { type: "boolean" } } } } },
        },
        responses: { 200: { description: "Report updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Scheduled Reports"],
        summary: "Delete a scheduled report",
        operationId: "deleteScheduledReport",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Report deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SUBSCRIPTIONS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/subscriptions/plans": {
      get: {
        tags: ["Subscriptions"],
        summary: "List subscription plans",
        description: "Returns all subscription plans configured for the organization.",
        operationId: "listPlans",
        responses: {
          200: { description: "Plan list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Plan" } } } }] } } } },
        },
      },
      post: {
        tags: ["Subscriptions"],
        summary: "Create a plan",
        operationId: "createPlan",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["name", "code", "amount", "interval"], properties: { name: { type: "string", example: "Pro Plan" }, code: { type: "string", example: "pro-monthly" }, amount: { type: "integer", example: 299900, description: "Amount in smallest currency unit" }, currency: { type: "string", example: "INR" }, interval: { type: "string", enum: ["monthly", "yearly"] } } } } },
        },
        responses: { 201: { description: "Plan created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/subscriptions/plans/{id}": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get a plan by ID",
        operationId: "getPlan",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Plan details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Subscriptions"],
        summary: "Update a plan",
        operationId: "updatePlan",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "integer" }, isActive: { type: "boolean" } } } } },
        },
        responses: { 200: { description: "Plan updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Subscriptions"],
        summary: "Delete a plan",
        operationId: "deletePlan",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Plan deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "List subscriptions",
        operationId: "listSubscriptions",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "paused", "cancelled", "past_due", "trialing"] } },
          { name: "clientId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          200: { description: "Subscription list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Subscription" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Subscriptions"],
        summary: "Create a subscription",
        description: "Creates a new subscription for a client on a plan. The first invoice is generated immediately.",
        operationId: "createSubscription",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["clientId", "planId"], properties: { clientId: { type: "string", format: "uuid" }, planId: { type: "string", format: "uuid" }, startDate: { type: "string", format: "date" } } } } },
        },
        responses: { 201: { description: "Subscription created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/subscriptions/{id}": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get a subscription",
        operationId: "getSubscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Subscription details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions/{id}/change-plan": {
      put: {
        tags: ["Subscriptions"],
        summary: "Change subscription plan",
        description: "Upgrades or downgrades a subscription to a different plan. Optionally prorates the change.",
        operationId: "changeSubscriptionPlan",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["planId"], properties: { planId: { type: "string", format: "uuid" }, prorate: { type: "boolean", description: "Whether to prorate the plan change (default: true)" } } } } },
        },
        responses: { 200: { description: "Plan changed" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions/{id}/cancel": {
      post: {
        tags: ["Subscriptions"],
        summary: "Cancel a subscription",
        description: "Cancels a subscription. Can be immediate or at the end of the current billing period.",
        operationId: "cancelSubscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { cancelAtPeriodEnd: { type: "boolean", description: "If true, the subscription remains active until the current period ends" }, reason: { type: "string" } } } } },
        },
        responses: { 200: { description: "Subscription cancelled" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions/{id}/pause": {
      post: {
        tags: ["Subscriptions"],
        summary: "Pause a subscription",
        operationId: "pauseSubscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Subscription paused" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions/{id}/resume": {
      post: {
        tags: ["Subscriptions"],
        summary: "Resume a subscription",
        operationId: "resumeSubscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Subscription resumed" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/subscriptions/{id}/events": {
      get: {
        tags: ["Subscriptions"],
        summary: "List events for a subscription",
        description: "Returns the event history for a subscription (created, plan changed, paused, resumed, cancelled, invoice generated).",
        operationId: "listSubscriptionEvents",
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
        description: "Returns a paginated list of usage records. Filter by subscription.",
        operationId: "listUsageRecords",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "subscriptionId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: { 200: { description: "Usage records list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/UsageRecord" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } } },
      },
      post: {
        tags: ["Usage"],
        summary: "Record a usage event",
        description: "Records a raw usage event for a subscription metric. Use this for granular event-by-event tracking. Requires Accountant role or higher.",
        operationId: "recordUsage",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["subscriptionId", "metric", "quantity"], properties: { subscriptionId: { type: "string", format: "uuid" }, metric: { type: "string", example: "api_calls" }, quantity: { type: "number", example: 1 }, timestamp: { type: "string", format: "date-time" } } } } },
        },
        responses: { 201: { description: "Usage recorded" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/usage/summary": {
      get: {
        tags: ["Usage"],
        summary: "Get usage summary",
        description: "Returns aggregated usage totals for a subscription in a given period, grouped by metric.",
        operationId: "getUsageSummary",
        parameters: [
          { name: "subscriptionId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Usage summary grouped by metric" } },
      },
    },
    "/api/v1/usage/report": {
      post: {
        tags: ["Usage"],
        summary: "Report usage (simplified)",
        description: "Simplified usage reporting endpoint for SaaS integrations. Reports a usage quantity for a specific subscription metric. Ideal for batch reporting at the end of a billing period.",
        operationId: "reportUsage",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReportUsage" }, example: { subscriptionId: "550e8400-e29b-41d4-a716-446655440000", metric: "api_calls", quantity: 15000 } } },
        },
        responses: {
          201: { description: "Usage reported successfully" },
          404: { description: "Subscription not found" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/usage/report \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "subscriptionId": "550e8400-e29b-41d4-a716-446655440000",\n    "metric": "api_calls",\n    "quantity": 15000\n  }\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/usage/report", {\n  method: "POST",\n  headers: {\n    "Authorization": `Bearer ${accessToken}`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    subscriptionId: "550e8400-e29b-41d4-a716-446655440000",\n    metric: "api_calls",\n    quantity: 15000\n  })\n});\nconsole.log("Usage reported:", response.status);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/usage/report",\n    headers={"Authorization": f"Bearer {access_token}"},\n    json={\n        "subscriptionId": "550e8400-e29b-41d4-a716-446655440000",\n        "metric": "api_calls",\n        "quantity": 15000\n    }\n)\nprint("Usage reported:", response.status_code)',
          },
        ],
      },
    },
    "/api/v1/usage/generate-invoice": {
      post: {
        tags: ["Usage"],
        summary: "Generate invoice from usage",
        description: "Generates a draft invoice from accumulated usage records for a subscription's billing period. Aggregates all usage metrics and creates line items with appropriate pricing.",
        operationId: "generateUsageInvoice",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/GenerateUsageInvoice" }, example: { subscriptionId: "550e8400-e29b-41d4-a716-446655440000" } } },
        },
        responses: {
          201: { description: "Invoice generated from usage", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/Invoice" } } }] } } } },
          400: { description: "No usage records found for the period" },
          404: { description: "Subscription not found" },
        },
        "x-codeSamples": [
          {
            lang: "cURL",
            label: "cURL",
            source: 'curl -X POST http://localhost:4001/api/v1/usage/generate-invoice \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"subscriptionId": "550e8400-e29b-41d4-a716-446655440000"}\'',
          },
          {
            lang: "JavaScript",
            label: "Node.js (fetch)",
            source: 'const response = await fetch("http://localhost:4001/api/v1/usage/generate-invoice", {\n  method: "POST",\n  headers: {\n    "Authorization": `Bearer ${accessToken}`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    subscriptionId: "550e8400-e29b-41d4-a716-446655440000"\n  })\n});\nconst { data: invoice } = await response.json();\nconsole.log("Generated invoice:", invoice.invoiceNumber, "Total:", invoice.total);',
          },
          {
            lang: "Python",
            label: "Python (requests)",
            source: 'import requests\n\nresponse = requests.post(\n    "http://localhost:4001/api/v1/usage/generate-invoice",\n    headers={"Authorization": f"Bearer {access_token}"},\n    json={"subscriptionId": "550e8400-e29b-41d4-a716-446655440000"}\n)\ninvoice = response.json()["data"]\nprint(f"Generated invoice: {invoice[\'invoiceNumber\']}, Total: {invoice[\'total\']}")',
          },
        ],
      },
    },
    "/api/v1/usage/generate-all-invoices": {
      post: {
        tags: ["Usage"],
        summary: "Generate usage invoices for all subscriptions",
        description: "Admin-only endpoint that triggers usage invoice generation for all active subscriptions with pending usage. Typically called by a cron job or scheduler.",
        operationId: "generateAllUsageInvoices",
        responses: {
          200: { description: "Batch generation results with counts of invoices generated and errors" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // COUPONS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/coupons/validate": {
      post: {
        tags: ["Coupons"],
        summary: "Validate a coupon code",
        description: "Checks if a coupon code is valid, not expired, and has remaining redemptions. Optionally pass an amount to see the discount calculation.",
        operationId: "validateCoupon",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["code"], properties: { code: { type: "string", example: "SAVE20" }, amount: { type: "integer", description: "Optional: amount to calculate discount against" } } } } },
        },
        responses: { 200: { description: "Validation result with discount info" }, 404: { description: "Coupon not found or expired" } },
      },
    },
    "/api/v1/coupons/apply": {
      post: {
        tags: ["Coupons"],
        summary: "Apply a coupon to an invoice",
        description: "Applies a coupon discount to an invoice. The invoice total is recalculated.",
        operationId: "applyCouponToInvoice",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["code", "invoiceId"], properties: { code: { type: "string" }, invoiceId: { type: "string", format: "uuid" } } } } },
        },
        responses: { 200: { description: "Coupon applied, invoice updated" }, 400: { description: "Coupon invalid or already applied" } },
      },
    },
    "/api/v1/coupons/apply-to-subscription": {
      post: {
        tags: ["Coupons"],
        summary: "Apply a coupon to a subscription",
        description: "Applies a coupon discount to future invoices generated by a subscription.",
        operationId: "applyCouponToSubscription",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["code", "subscriptionId"], properties: { code: { type: "string" }, subscriptionId: { type: "string", format: "uuid" } } } } },
        },
        responses: { 200: { description: "Coupon applied to subscription" } },
      },
    },
    "/api/v1/coupons/subscription/{id}": {
      delete: {
        tags: ["Coupons"],
        summary: "Remove coupon from a subscription",
        operationId: "removeCouponFromSubscription",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Subscription ID" }],
        responses: { 200: { description: "Coupon removed" } },
      },
    },
    "/api/v1/coupons": {
      get: {
        tags: ["Coupons"],
        summary: "List coupons",
        operationId: "listCoupons",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "Coupon list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/Coupon" } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } }] } } } },
        },
      },
      post: {
        tags: ["Coupons"],
        summary: "Create a coupon",
        operationId: "createCoupon",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["code", "discountType", "discountValue"], properties: { code: { type: "string", example: "SAVE20" }, discountType: { type: "string", enum: ["percentage", "fixed"] }, discountValue: { type: "number", example: 20 }, maxRedemptions: { type: "integer" }, validFrom: { type: "string", format: "date" }, validUntil: { type: "string", format: "date" } } } } },
        },
        responses: { 201: { description: "Coupon created" }, 422: { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/api/v1/coupons/{id}": {
      get: {
        tags: ["Coupons"],
        summary: "Get a coupon by ID",
        operationId: "getCoupon",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Coupon details" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      put: {
        tags: ["Coupons"],
        summary: "Update a coupon",
        operationId: "updateCoupon",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" }, discountType: { type: "string" }, discountValue: { type: "number" }, maxRedemptions: { type: "integer" }, isActive: { type: "boolean" } } } } },
        },
        responses: { 200: { description: "Coupon updated" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
      delete: {
        tags: ["Coupons"],
        summary: "Delete a coupon",
        operationId: "deleteCoupon",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { 200: { description: "Coupon deleted" }, 404: { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/api/v1/coupons/{id}/redemptions": {
      get: {
        tags: ["Coupons"],
        summary: "List redemption history for a coupon",
        description: "Returns all redemptions (uses) of a coupon, including the invoice/subscription and date.",
        operationId: "listCouponRedemptions",
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
        description: "Returns the dunning (failed payment retry) configuration for the organization.",
        operationId: "getDunningConfig",
        responses: { 200: { description: "Dunning config", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/DunningConfig" } } }] } } } } },
      },
      put: {
        tags: ["Dunning"],
        summary: "Update dunning configuration",
        description: "Updates the dunning retry schedule and final action (cancel, pause, or none).",
        operationId: "updateDunningConfig",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/DunningConfig" } } },
        },
        responses: { 200: { description: "Config updated" }, 403: { $ref: "#/components/responses/Forbidden" } },
      },
    },
    "/api/v1/dunning/attempts": {
      get: {
        tags: ["Dunning"],
        summary: "List dunning attempts",
        description: "Returns dunning attempts (failed payment retries) with their status and next retry date.",
        operationId: "listDunningAttempts",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "invoiceId", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: { 200: { description: "Dunning attempts list" } },
      },
    },
    "/api/v1/dunning/summary": {
      get: {
        tags: ["Dunning"],
        summary: "Get dunning summary statistics",
        description: "Returns aggregate dunning stats: total attempts, success rate, recovered revenue.",
        operationId: "getDunningSummary",
        responses: { 200: { description: "Dunning summary" } },
      },
    },
    "/api/v1/dunning/attempts/{id}/retry": {
      post: {
        tags: ["Dunning"],
        summary: "Manually retry a dunning attempt",
        description: "Immediately retries a failed payment attempt instead of waiting for the next scheduled retry.",
        operationId: "retryDunningAttempt",
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
        description: "Returns current MRR, growth rate, new MRR from new subscriptions, and churned MRR from cancellations.",
        operationId: "getMRR",
        responses: { 200: { description: "MRR data", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/MRR" } } }] } } } } },
      },
    },
    "/api/v1/metrics/arr": {
      get: {
        tags: ["Metrics"],
        summary: "Get Annual Recurring Revenue (ARR)",
        description: "Returns ARR (MRR x 12) with year-over-year growth.",
        operationId: "getARR",
        responses: { 200: { description: "ARR data" } },
      },
    },
    "/api/v1/metrics/churn": {
      get: {
        tags: ["Metrics"],
        summary: "Get churn metrics",
        description: "Returns customer churn rate and revenue churn rate for a period.",
        operationId: "getChurnMetrics",
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
        description: "Returns average customer LTV based on average revenue per customer and churn rate.",
        operationId: "getLTV",
        responses: { 200: { description: "LTV data" } },
      },
    },
    "/api/v1/metrics/revenue-breakdown": {
      get: {
        tags: ["Metrics"],
        summary: "Get monthly revenue breakdown",
        description: "Returns monthly revenue broken down into new, expansion, contraction, and churned components.",
        operationId: "getRevenueBreakdown",
        parameters: [
          { name: "months", in: "query", schema: { type: "integer", default: 12 }, description: "Number of months to include" },
        ],
        responses: { 200: { description: "Revenue breakdown by month" } },
      },
    },
    "/api/v1/metrics/subscription-stats": {
      get: {
        tags: ["Metrics"],
        summary: "Get subscription statistics",
        description: "Returns subscription counts by status, plan distribution, and trial conversion rate.",
        operationId: "getSubscriptionStats",
        responses: { 200: { description: "Subscription statistics" } },
      },
    },
    "/api/v1/metrics/cohort": {
      get: {
        tags: ["Metrics"],
        summary: "Get cohort retention analysis",
        description: "Returns a cohort retention matrix showing what percentage of customers from each monthly cohort are still active in subsequent months.",
        operationId: "getCohortAnalysis",
        parameters: [
          { name: "months", in: "query", schema: { type: "integer", default: 12 }, description: "Number of cohort months to analyze" },
        ],
        responses: { 200: { description: "Cohort analysis data" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // API KEYS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/api-keys": {
      get: {
        tags: ["API Keys"],
        summary: "List API keys",
        description: "Returns all API keys for the organization. The full key value is never shown after creation. Requires Admin role.",
        operationId: "listApiKeys",
        responses: {
          200: { description: "API key list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } } } }] } } } },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["API Keys"],
        summary: "Create an API key",
        description: "Generates a new API key. The full key is returned only once in the response. Store it securely. Requires Admin role.",
        operationId: "createApiKey",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateApiKey" }, example: { name: "Production API Key" } } },
        },
        responses: {
          201: {
            description: "API key created — the full key value is included only in this response",
            content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { allOf: [{ $ref: "#/components/schemas/ApiKey" }, { properties: { key: { type: "string", example: "emp_live_sk_1234567890abcdef", description: "The full API key — store securely, shown only once" } } }] } } }] } } },
          },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/v1/api-keys/{id}": {
      delete: {
        tags: ["API Keys"],
        summary: "Revoke an API key",
        description: "Permanently revokes an API key. Any requests using this key will immediately fail. Requires Admin role.",
        operationId: "revokeApiKey",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "API key revoked" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CUSTOM DOMAINS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/v1/domains": {
      get: {
        tags: ["Custom Domains"],
        summary: "List custom domains",
        description: "Returns all custom domains configured for the organization's client portal. Requires Admin role.",
        operationId: "listDomains",
        responses: {
          200: { description: "Domain list", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { type: "array", items: { $ref: "#/components/schemas/CustomDomain" } } } }] } } } },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Custom Domains"],
        summary: "Add a custom domain",
        description: "Adds a custom domain for the client portal. Returns a verification token that must be added as a DNS TXT record. Requires Admin role.",
        operationId: "addDomain",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AddDomain" }, example: { domain: "billing.acme.com" } } },
        },
        responses: {
          201: { description: "Domain added with verification token", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/ApiResponse" }, { properties: { data: { $ref: "#/components/schemas/CustomDomain" } } }] } } } },
          403: { $ref: "#/components/responses/Forbidden" },
          409: { description: "Domain already registered" },
        },
      },
    },
    "/api/v1/domains/{id}": {
      delete: {
        tags: ["Custom Domains"],
        summary: "Remove a custom domain",
        operationId: "removeDomain",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Domain removed" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/domains/{id}/verify": {
      post: {
        tags: ["Custom Domains"],
        summary: "Verify a custom domain",
        description: "Checks the DNS TXT record for the domain to verify ownership. Call this after adding the verification token to your DNS.",
        operationId: "verifyDomain",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Domain verified successfully" },
          400: { description: "DNS verification failed — TXT record not found" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // GATEWAY WEBHOOKS
    // ═══════════════════════════════════════════════════════════════════════
    "/webhooks/gateway/stripe": {
      post: {
        tags: ["Gateway Webhooks"],
        summary: "Stripe webhook handler",
        description: "Handles incoming Stripe webhook events (payment_intent.succeeded, charge.refunded, etc.). Verifies the webhook signature using the Stripe signing secret.",
        operationId: "handleStripeWebhook",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Webhook processed" }, 400: { description: "Invalid signature" } },
      },
    },
    "/webhooks/gateway/razorpay": {
      post: {
        tags: ["Gateway Webhooks"],
        summary: "Razorpay webhook handler",
        description: "Handles incoming Razorpay webhook events (payment.captured, refund.processed, etc.). Verifies the webhook signature.",
        operationId: "handleRazorpayWebhook",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Webhook processed" }, 400: { description: "Invalid signature" } },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // HEALTH
    // ═══════════════════════════════════════════════════════════════════════
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns the service status. Use this for load balancer health checks.",
        operationId: "healthCheck",
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
} as const;
