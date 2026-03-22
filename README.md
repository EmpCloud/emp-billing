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

### Invoice & Client Details
| Invoice Detail | Client Detail |
|----------------|---------------|
| ![Invoice Detail](docs/screenshots/26-invoice-detail.png) | ![Client Detail](docs/screenshots/27-client-detail.png) |

### Coupons, Webhooks & Audit
| Coupons | Webhooks | Audit Log |
|---------|----------|-----------|
| ![Coupons](docs/screenshots/28-coupons.png) | ![Webhooks](docs/screenshots/29-webhooks.png) | ![Audit Log](docs/screenshots/30-audit-log.png) |

### Metrics, Disputes & Usage
| SaaS Metrics | Disputes | Usage Records |
|-------------|----------|---------------|
| ![Metrics](docs/screenshots/31-metrics.png) | ![Disputes](docs/screenshots/32-disputes.png) | ![Usage](docs/screenshots/33-usage.png) |

### Dunning & API Docs
| Dunning / Payment Retry | API Documentation (Swagger) |
|------------------------|----------------------------|
| ![Dunning](docs/screenshots/34-dunning.png) | ![API Docs](docs/screenshots/35-api-docs.png?v=2) |

---

## Project Status

### Build & Test Status

- **Build**: All 3 packages compile successfully (shared, server, client)
- **Unit Tests**: **618+ passing** across 46 test files — zero failures
  - `@emp-billing/server`: 457+ tests (39 files) — services, middleware, utils, events
  - `@emp-billing/client`: 11 tests (3 files) — Zustand stores
  - `@emp-billing/shared`: 150 tests (4 files) — validators, tax engines (GST, UAE, VAT, Sales Tax), billing utils
- **E2E Tests**: **130 Playwright tests** across 7 test files — deep functional, UI-driven
  - Auth & Dashboard, Invoices & Quotes, Clients & Products, Payments & Expenses & Vendors, Credit Notes & Recurring & Subscriptions, Coupons & Dunning & Disputes & Usage & Metrics, Reports & Webhooks & Settings & Team & Audit
  - Tests fill real forms, click buttons, verify toasts, navigate between pages
  - Run with: `bash scripts/e2e/run-all.sh`

### Security Audit & Hardening

A comprehensive security audit identified and fixed **30 vulnerabilities**:

- **Redis-based rate limiting** on all authentication and sensitive endpoints
- **RBAC enforcement** on all sensitive routes (admin, settings, team management, audit logs)
- **SSRF protection** on webhook URLs — blocks private/internal IPs, localhost, and link-local addresses
- **Puppeteer sandboxing** — PDF generation runs in a sandboxed Chromium instance
- **Input validation** on all API endpoints via Zod schemas (shared between client and server)
- **XSS prevention** — template outputs sanitized, Content-Security-Policy headers
- **SQL injection protection** — parameterized queries via Knex, no raw string interpolation

### Bug Fixes

- **11 GitHub issues** identified and fixed during E2E testing
- **7 additional bugs** discovered and resolved through deep functional testing
- Fixes span UI rendering, form validation, API response handling, navigation edge cases, and data persistence

### What's Built (Complete)

| Area | Status | Details |
|------|--------|---------|
| **Invoicing** | Done | Full CRUD, line items, multi-tax, auto-numbering, PDF generation, bulk actions |
| **Quotes** | Done | Full lifecycle, versioning, convert to invoice, client approval |
| **Payments** | Done | Record/refund, 3 gateways (Stripe, Razorpay, PayPal), auto-charge |
| **Credit Notes** | Done | Issue, apply to invoice, refund |
| **Recurring** | Done | Schedule profiles, auto-generate, auto-send, pause/resume |
| **Clients** | Done | CRUD, contacts, portal access, statements, CSV import/export |
| **Products** | Done | CRUD, SKU, pricing tiers, inventory tracking |
| **Expenses** | Done | CRUD, receipt upload, OCR scanning, bill-to-client |
| **Vendors** | Done | CRUD, expense association |
| **Tax — India GST** | Done | CGST/SGST/IGST, HSN/SAC, TDS, e-Invoice IRN, e-Way Bill hooks |
| **Tax — UAE** | Done | 5% VAT, excise tax, corporate tax, TRN validation, reverse charge |
| **Tax — EU/UK VAT** | Done | 27 EU countries + UK, all rate types, reverse charge B2B |
| **Tax — US Sales Tax** | Done | 50 states + DC, county/city stacking |
| **Subscriptions** | Done | Plans, trials, usage-based billing, quantity seats |
| **Coupons** | Done | Percentage/fixed, per-client limits, date validity |
| **Dunning** | Done | Automated retry, configurable schedules |
| **Client Portal** | Done | Login, view invoices/quotes, pay online, disputes |
| **Notifications** | Done | Email (Nodemailer), SMS (Twilio), WhatsApp (Twilio + Meta) |
| **Reports** | Done | Revenue, aging, tax, expenses, P&L, scheduled reports |
| **Report Builder UI** | Done | Custom filters, grouping, column selection, save/load configs |
| **Search** | Done | Full-text across all entities |
| **Webhooks** | Done | 20+ event types, delivery logs |
| **SaaS Metrics** | Done | MRR, ARR, churn, LTV, cohort analysis |
| **Team/RBAC** | Done | Owner/Admin/Accountant/Sales/Viewer roles |
| **Audit Log** | Done | Full activity trail |
| **API Docs** | Done | OpenAPI 3.0 spec, Swagger UI at `/api/docs` |
| **Custom Domain Mapping** | Done | SaaS customers map subdomains via CNAME, DNS verification, in-memory caching, settings UI |
| **MongoDB Adapter** | Done | Full `IDBAdapter` implementation with native driver |
| **Docker** | Done | Multi-stage Dockerfile, docker-compose with MySQL + Redis + App |
| **OCR** | Done | Tesseract.js local + cloud provider hooks |

### Database Schema

15 migrations applied covering 30+ tables:
`organizations`, `users`, `clients`, `client_contacts`, `products`, `price_lists`, `tax_rates`, `invoices`, `invoice_items`, `quotes`, `quote_items`, `credit_notes`, `credit_note_items`, `payments`, `payment_allocations`, `expenses`, `expense_categories`, `vendors`, `recurring_profiles`, `recurring_executions`, `templates`, `client_portal_access`, `webhooks`, `webhook_deliveries`, `audit_logs`, `settings`, `notifications`, `disputes`, `scheduled_reports`, `subscriptions`, `plans`, `usage_records`, `coupons`, `dunning_attempts`, `saved_payment_methods`, `custom_domains`

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
- **Custom Domain Mapping** — SaaS customers can point their subdomain via CNAME, DNS verification with TXT records, in-memory caching for fast lookups, settings UI for domain management

### Real-World Integration: AdsGPT

emp-billing is actively used as the billing backend for [AdsGPT](https://adsgpt.com), validating the platform against real SaaS requirements:

- **9 subscription plans** configured: Free Trial, Basic, Starter, Individual, Creator, Growth, Scale (monthly + annual variants)
- **10 products** mapped to AdsGPT features with usage-based metering
- Full subscription lifecycle: trial signup, plan upgrades, usage tracking, invoicing

### E2E Test Suite

130 Playwright-based end-to-end tests cover all 24 modules with deep functional verification:

| Test File | Modules Covered | Tests |
|-----------|----------------|-------|
| `auth-dashboard.test.ts` | Login, Register, Forgot Password, Dashboard | 12 |
| `invoices-quotes.test.ts` | Invoice CRUD, PDF, Quotes, Convert to Invoice | 19 |
| `clients-products.test.ts` | Client CRUD, Statements, Product CRUD, Inventory | 16 |
| `payments-expenses-vendors.test.ts` | Payments, Expenses, Vendors | 20 |
| `creditnotes-recurring-subscriptions.test.ts` | Credit Notes, Recurring Profiles, Subscriptions | 21 |
| `coupons-dunning-disputes-usage-metrics.test.ts` | Coupons, Dunning, Disputes, Usage, Metrics | 21 |
| `reports-webhooks-settings-team-audit.test.ts` | Reports, Webhooks, Settings, Tax Rates, Team, Audit Log | 28 |

```bash
# Run the full E2E suite
bash scripts/e2e/run-all.sh
```

Tests are not shallow smoke tests -- they fill real forms with realistic data, interact with dropdowns and modals, verify toast notifications, check navigation, and validate data persistence across page reloads.

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
├── scripts/
│   └── e2e/                 # 130 Playwright E2E tests (7 test files)
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
# Start infrastructure + app (builds automatically)
docker compose up -d

# Or rebuild after code changes
docker compose up -d --build app

# View logs
docker logs -f emp-billing-app

# Stop everything
docker compose down
```

In production mode (`NODE_ENV=production`), the server serves the client SPA on port 4001 — no separate frontend server needed.

#### Expose via ngrok

```bash
ngrok http 4001 --domain=your-domain.ngrok-free.dev
```

### Running Tests

```bash
# Unit tests — all packages
pnpm run test

# Individual packages
pnpm --filter @emp-billing/server test
pnpm --filter @emp-billing/client test
pnpm --filter @emp-billing/shared test

# E2E tests (requires server + client running on localhost:4001)
bash scripts/e2e/run-all.sh
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
