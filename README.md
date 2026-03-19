# EMP Billing

Open-source billing and invoicing platform — part of the [EmpCloud](https://empcloud.com) ecosystem. Think **open-source Zoho Invoice + Zoho Books invoicing layer**.

Handles the complete billing lifecycle: **Quotes > Invoices > Payments > Receipts > Reports**.

**Target users:** SMBs, freelancers, agencies, and enterprises — with India-first GST compliance, plus multi-country tax support (UAE VAT, EU/UK VAT, US Sales Tax).

**Business model:** Open-core. Free community edition (self-hosted), paid SaaS on empcloud.com, commercial license for embedding.

---

## Screenshots

### Authentication
| Login | Register | Forgot Password |
|-------|----------|-----------------|
| ![Login](docs/screenshots/01-login.png) | ![Register](docs/screenshots/02-register.png) | ![Forgot Password](docs/screenshots/03-forgot-password.png) |

### Dashboard & Navigation
| Dashboard | Settings |
|-----------|----------|
| ![Dashboard](docs/screenshots/04-dashboard.png) | ![Settings](docs/screenshots/23-settings.png) |

### Invoicing
| Invoice List | Create Invoice |
|-------------|----------------|
| ![Invoices](docs/screenshots/05-invoices.png) | ![Create Invoice](docs/screenshots/06-invoice-create.png) |

### Quotes
| Quote List | Create Quote |
|-----------|--------------|
| ![Quotes](docs/screenshots/07-quotes.png) | ![Create Quote](docs/screenshots/08-quote-create.png) |

### Clients & Products
| Clients | Add Client | Products | Add Product |
|---------|-----------|----------|-------------|
| ![Clients](docs/screenshots/09-clients.png) | ![Add Client](docs/screenshots/10-client-create.png) | ![Products](docs/screenshots/11-products.png) | ![Add Product](docs/screenshots/12-product-create.png) |

### Payments & Expenses
| Payments | Expenses | Create Expense |
|----------|----------|----------------|
| ![Payments](docs/screenshots/13-payments.png) | ![Expenses](docs/screenshots/14-expenses.png) | ![Create Expense](docs/screenshots/15-expense-create.png) |

### Credit Notes, Recurring & Vendors
| Credit Notes | Recurring Invoices | Vendors |
|-------------|-------------------|---------|
| ![Credit Notes](docs/screenshots/16-credit-notes.png) | ![Recurring](docs/screenshots/17-recurring.png) | ![Vendors](docs/screenshots/18-vendors.png) |

### Reports
| Reports | Report Builder |
|---------|---------------|
| ![Reports](docs/screenshots/19-reports.png) | ![Report Builder](docs/screenshots/20-report-builder.png) |

### Subscriptions & Plans
| Subscriptions | Plans |
|--------------|-------|
| ![Subscriptions](docs/screenshots/21-subscriptions.png) | ![Plans](docs/screenshots/22-plans.png) |

### Team & Client Portal
| Team | Client Portal Login |
|------|-------------------|
| ![Team](docs/screenshots/24-team.png) | ![Portal Login](docs/screenshots/25-portal-login.png) |

---

## Features

### Core Billing
- **Invoicing** — Create, edit, duplicate, void, write-off invoices with multi-tax line items, auto-numbering, partial payments, credit notes, bulk actions, PDF generation
- **Quotes / Estimates** — Full quote lifecycle with versioning, client approval via portal, one-click convert to invoice
- **Payments** — Record full/partial payments, multiple methods (cash, bank, UPI, card, gateway), refunds, overpayment credits, auto-charge recurring
- **Credit Notes** — Issue credits, apply to invoices, process refunds
- **Recurring Invoices** — Auto-generate on schedule (daily/weekly/monthly/yearly), auto-send, auto-charge, pause/resume

### Clients & Products
- **Client Management** — Contact database, multiple addresses, portal access, statements, outstanding tracking, CSV import/export, tags/groups
- **Product Catalog** — Items/services with SKU, units, tax association, price lists, optional inventory tracking

### Tax Engines
- **India GST** — CGST + SGST / IGST, HSN/SAC codes, 5 rate slabs, reverse charge, TDS, GSTR-1/3B data export, e-Invoice (IRN) and e-Way Bill integration hooks
- **UAE Tax** — 5% VAT (standard/zero-rated/exempt), excise tax, corporate tax (9%/15%), TRN validation, reverse charge for imported services
- **EU/UK VAT** — 27 EU countries + UK rates, reduced/super-reduced/zero/parking rates, reverse charge mechanism for cross-border B2B
- **US Sales Tax** — All 50 states + DC rates, county/city tax stacking, nexus tracking

### Payments & Subscriptions
- **Payment Gateways** (plugin architecture):
  - Stripe (cards, ACH)
  - Razorpay (India: UPI, netbanking, cards, wallets)
  - PayPal (REST API v2, sandbox/live modes)
  - Extensible: implement `IPaymentGateway` interface to add any gateway
- **Subscriptions** — Plan management, trial periods, usage-based billing, quantity seats
- **Coupons** — Percentage/fixed discounts, max redemptions, per-client limits, date validity, minimum amount rules
- **Dunning** — Automated failed payment retry, configurable retry schedules

### Platform
- **Client Portal** — Branded login, view invoices/quotes/payments, pay online, approve quotes, raise disputes, download statements
- **Multi-tenancy** — Every query scoped by `org_id`, role-based access (Owner/Admin/Accountant/Sales/Viewer)
- **Notifications** — Email (Nodemailer + Handlebars), SMS (Twilio), WhatsApp (Twilio + Meta Cloud API)
- **Templates** — Handlebars-based PDF/email templates (invoice, quote, receipt, credit note, statement, payment reminder, welcome, dispute, subscription)
- **Reports** — Revenue, receivables aging, tax summaries, expenses, P&L, client reports, scheduled email reports, custom report builder UI
- **Metrics** — MRR, ARR, churn, LTV, cohort analysis, revenue breakdown
- **Webhooks** — Subscribe to 20+ events, delivery logs, retry mechanism
- **Search** — Full-text search across invoices, clients, quotes, payments, expenses
- **Import/Export** — CSV import/export for clients and products
- **OCR** — Receipt scanning via Tesseract.js (local) or cloud providers (Google Vision, AWS Textract, Azure Form Recognizer)
- **API Documentation** — Full OpenAPI 3.0 spec at `/api/docs` (Swagger UI)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS + Radix UI |
| State | Zustand (client) + TanStack Query (server) |
| Backend | Express 5 + TypeScript |
| Validation | Zod (shared between client & server) |
| Database | MySQL (default) / PostgreSQL / MongoDB — switchable via `DB_PROVIDER` |
| Queue | BullMQ + Redis |
| PDF | Puppeteer + Handlebars |
| Email | Nodemailer + Handlebars |
| SMS | Twilio REST API |
| WhatsApp | Twilio / Meta Cloud API |
| Payments | Stripe, Razorpay, PayPal (plugin-based) |
| Auth | JWT (access + refresh tokens) |
| Monorepo | pnpm workspaces — 3 packages |

---

## Project Structure

```
emp-billing/
├── packages/
│   ├── shared/              # @emp-billing/shared — types, validators, constants
│   │   └── src/
│   │       ├── types/       # TypeScript interfaces & enums
│   │       ├── constants/   # Tax engines (GST, UAE, VAT, Sales Tax), currencies
│   │       ├── validators/  # Zod schemas (shared client + server)
│   │       └── utils/       # Formatters, calculators
│   │
│   ├── server/              # @emp-billing/server — Express API
│   │   └── src/
│   │       ├── api/
│   │       │   ├── routes/       # 14 route modules
│   │       │   ├── controllers/  # Thin controllers
│   │       │   ├── middleware/   # Auth, RBAC, rate limiting, error handling
│   │       │   ├── validators/   # Request validation
│   │       │   └── docs/         # OpenAPI spec + Swagger UI
│   │       ├── services/         # Business logic (15 service domains)
│   │       ├── db/adapters/      # MySQL/PG (Knex) + MongoDB adapters
│   │       ├── config/           # Environment config
│   │       ├── utils/            # Logger, PDF, number generator, CSV
│   │       ├── jobs/             # BullMQ workers (8 queues)
│   │       ├── events/           # Typed event emitter
│   │       └── templates/        # Handlebars templates (9 templates)
│   │
│   └── client/              # @emp-billing/client — React SPA
│       └── src/
│           ├── api/              # Axios client + typed hooks
│           ├── components/       # Reusable UI components
│           ├── pages/            # 12 page modules
│           └── store/            # Zustand stores
│
├── docker/                  # Dockerfile + entrypoint
├── docker-compose.yml       # MySQL + PostgreSQL + Redis + Mailpit + App
├── .env.example             # All environment variables
└── CLAUDE.md                # AI coding instructions
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for infrastructure)

### Quick Start

```bash
# 1. Clone
git clone https://github.com/EmpCloud/emp-billing.git
cd emp-billing

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your DB credentials, JWT secrets, etc.

# 4. Start infrastructure
docker compose up -d  # MySQL + Redis + Mailpit

# 5. Run migrations & seed
pnpm run db:migrate
pnpm run db:seed

# 6. Start development
pnpm run dev
# Server: http://localhost:4001
# Client: http://localhost:5174
# API Docs: http://localhost:4001/api/docs
# Mailpit: http://localhost:8025
```

### Docker Deployment

```bash
# Build and run everything
docker compose --profile app up -d

# Or build manually
docker build -f docker/Dockerfile -t emp-billing .
docker run -p 4001:4001 --env-file .env emp-billing
```

### Running Tests

```bash
# All packages
pnpm run test

# Individual packages
pnpm --filter @emp-billing/server test
pnpm --filter @emp-billing/client test
pnpm --filter @emp-billing/shared test
```

### Build

```bash
pnpm run build
```

---

## API Routes

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Login, register, refresh, logout, forgot/reset password |
| Organizations | `/api/v1/organizations` | CRUD, settings, branding, tax config |
| Clients | `/api/v1/clients` | CRUD, contacts, portal access, statements, import/export |
| Products | `/api/v1/products` | CRUD, price lists, import/export |
| Invoices | `/api/v1/invoices` | CRUD, send, duplicate, void, write-off, bulk actions, PDF |
| Quotes | `/api/v1/quotes` | CRUD, send, convert to invoice, client approval |
| Payments | `/api/v1/payments` | Record, refund, receipts, gateway callbacks |
| Credit Notes | `/api/v1/credit-notes` | CRUD, apply to invoice, refund |
| Expenses | `/api/v1/expenses` | CRUD, receipt upload, bill to client, OCR scanning |
| Recurring | `/api/v1/recurring` | Profiles CRUD, pause/resume, execution history |
| Reports | `/api/v1/reports` | Revenue, receivables, tax, expenses, aging, P&L |
| Portal | `/api/v1/portal` | Client-facing: invoices, quotes, payments, disputes |
| Subscriptions | `/api/v1/subscriptions` | Plans, subscriptions, usage, coupons |
| Settings | `/api/v1/settings` | Tax rates, payment gateways, templates, numbering |

Full interactive API documentation available at `/api/docs` when running the server.

---

## Database Support

| Provider | Config Value | Adapter |
|----------|-------------|---------|
| MySQL 8.0 | `DB_PROVIDER=mysql` | KnexAdapter |
| PostgreSQL 16 | `DB_PROVIDER=pg` | KnexAdapter |
| MongoDB 7+ | `DB_PROVIDER=mongodb` | MongoAdapter |

Set `DB_PROVIDER` in your `.env` file. The application uses a database abstraction layer — business logic never touches the DB directly.

---

## Payment Gateways

Each gateway implements the `IPaymentGateway` interface:

```typescript
interface IPaymentGateway {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  chargeCustomer(input: ChargeCustomerInput): Promise<ChargeCustomerResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
}
```

Configure gateway credentials in `.env` and they auto-initialize on server start.

---

## Tax Engine Coverage

| Region | Features |
|--------|----------|
| **India (GST)** | CGST+SGST/IGST, 5 rate slabs, HSN/SAC, TDS, reverse charge, e-Invoice IRN, e-Way Bill |
| **UAE** | 5% VAT (standard/zero/exempt), excise tax (50-100%), corporate tax (0/9/15%), TRN validation |
| **EU (27 countries)** | Standard/reduced/super-reduced/zero/parking rates, reverse charge B2B |
| **UK** | 20% standard, 5% reduced, 0% zero-rated, reverse charge |
| **US (50 states + DC)** | State base rates, county/city stacking, no-tax states (OR, MT, NH, DE, AK) |

---

## Architecture Decisions

1. **Money as integers** — All amounts in smallest currency unit (paise/cents/fils). No floating-point rounding errors.
2. **DB abstraction** — `IDBAdapter` interface with Knex (MySQL/PG) and MongoDB adapters. Switch via env var.
3. **Event-driven** — Major actions emit typed events. Listeners handle side effects (email, PDF, webhooks) keeping services decoupled.
4. **Plugin-based gateways** — Add payment gateways without touching core code.
5. **Multi-tenant** — Every query scoped by `org_id`. Middleware extracts org context from JWT.
6. **Thin controllers** — Validate (Zod) > Service > ApiResponse. Business logic lives in services.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Follow conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
4. Write tests for new features
5. Ensure `pnpm run build && pnpm run test` passes
6. Submit a pull request

---

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.

---

## Related Projects

- [EmpMonitor](https://empmonitor.com) — Employee monitoring & productivity
- [emp-payroll](https://github.com/EmpCloud/emp-payroll) — Payroll management (shares DB adapter pattern)

---

Built with care by the [EmpCloud](https://empcloud.com) team.
