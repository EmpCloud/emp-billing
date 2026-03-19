# CLAUDE.md — EMP Billing

## What is this project?

**emp-billing** is an open-source billing and invoicing platform — part of the EmpCloud ecosystem. Think "open-source Zoho Invoice + Zoho Books invoicing layer." It handles the complete billing lifecycle: quotes → invoices → payments → receipts → reports.

**Target users:** Small-to-medium businesses, freelancers, agencies, and enterprises — with India-first GST compliance, plus multi-country tax support.

**Business model:** Open-core. Free community edition (self-hosted), paid SaaS on empcloud.com, commercial license for embedding.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite + TypeScript | Same stack as emp-payroll, shared components |
| Styling | Tailwind CSS + Radix UI primitives | Accessible, composable, no CSS bloat |
| State | Zustand (client state) + TanStack Query (server state) | Simple, fast, minimal boilerplate |
| Backend | Express 5 + TypeScript | Lightweight, matches EmpCloud ecosystem |
| Validation | Zod (shared between client & server) | Single schema, both sides |
| Database | MySQL (default) / PostgreSQL / MongoDB | Switchable via `DB_PROVIDER` env — uses the same DB abstraction layer from emp-payroll |
| Queue | BullMQ + Redis | Recurring invoice generation, email delivery, PDF generation |
| PDF | Puppeteer + Handlebars templates | Professional invoice/quote PDFs |
| Email | Nodemailer + Handlebars | Invoice delivery, payment reminders |
| Payments | Stripe, Razorpay, PayPal (plugin-based) | Extensible payment gateway architecture |
| Auth | JWT (access + refresh tokens) | Stateless, scalable |
| Monorepo | npm workspaces | 3 packages: @emp-billing/shared, @emp-billing/server, @emp-billing/client |

---

## Project Structure

```
emp-billing/
├── packages/
│   ├── shared/                  # Shared types, constants, validators
│   │   └── src/
│   │       ├── types/           # TypeScript interfaces (Invoice, Client, Payment, etc.)
│   │       ├── constants/       # Tax rates, currencies, invoice statuses
│   │       ├── validators/      # Zod schemas (shared between client & server)
│   │       └── utils/           # Formatters, calculators
│   │
│   ├── server/                  # Express API
│   │   └── src/
│   │       ├── api/
│   │       │   ├── routes/      # 12 route modules (see API section below)
│   │       │   ├── controllers/ # Thin controllers — validate → service → respond
│   │       │   ├── middleware/  # Auth, RBAC, rate limiting, error handling
│   │       │   └── validators/ # Request validation (uses shared Zod schemas)
│   │       ├── services/        # Business logic (one service per domain)
│   │       │   ├── invoice/     # Create, send, duplicate, void, write-off
│   │       │   ├── quote/       # Create, send, convert to invoice
│   │       │   ├── payment/     # Record, refund, gateway integration
│   │       │   ├── client/      # CRUD, portal access, statements
│   │       │   ├── product/     # Items/services catalog, pricing
│   │       │   ├── expense/     # Track, categorize, bill to client
│   │       │   ├── tax/         # GST, VAT, sales tax computation
│   │       │   ├── recurring/   # Recurring invoice/expense scheduling
│   │       │   ├── notification/# Email, SMS, WhatsApp delivery
│   │       │   └── report/      # Revenue, receivables, tax, expense reports
│   │       ├── db/
│   │       │   ├── adapters/    # DB abstraction (MySQL/PG/Mongo) — SAME pattern as emp-payroll
│   │       │   ├── migrations/  # SQL schema migrations
│   │       │   └── seeds/       # Demo data
│   │       ├── config/          # Environment config
│   │       ├── utils/           # Logger, PDF generator, number formatter
│   │       ├── jobs/            # BullMQ workers (recurring invoices, reminders, PDF)
│   │       ├── events/          # Event emitter (invoice.created, payment.received, etc.)
│   │       └── templates/       # Handlebars templates (invoice PDF, email, receipt)
│   │
│   └── client/                  # React SPA
│       └── src/
│           ├── api/             # Axios client + typed hooks
│           ├── components/      # Reusable UI (InvoiceForm, PaymentModal, etc.)
│           ├── pages/
│           │   ├── auth/        # Login, register, forgot password
│           │   ├── dashboard/   # Revenue overview, receivables, recent activity
│           │   ├── clients/     # Client list, detail, statement
│           │   ├── invoices/    # Invoice list, create/edit, preview, send
│           │   ├── quotes/      # Quote list, create/edit, convert to invoice
│           │   ├── payments/    # Payment list, record payment, refund
│           │   ├── expenses/    # Expense list, create, receipt upload
│           │   ├── products/    # Product/service catalog
│           │   ├── reports/     # Revenue, tax, receivables, expense reports
│           │   ├── settings/    # Org, branding, tax, payment gateways, templates
│           │   └── portal/      # Client portal (view invoices, pay, approve quotes)
│           ├── store/           # Zustand stores
│           └── styles/          # Tailwind config, globals
│
├── docs/
├── docker/
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                    # ← YOU ARE HERE
```

---

## Feature List (Complete)

### 1. Invoicing (Core)
- Create, edit, duplicate, delete invoices
- Line items with quantity, rate, tax, discount (per-item and overall)
- Auto-numbering with configurable prefix/format (INV-2026-0001)
- Multiple tax support per line item (GST: CGST + SGST / IGST, VAT, sales tax)
- Currency support (170+ currencies, auto exchange rate)
- Invoice statuses: Draft → Sent → Viewed → Partially Paid → Paid → Overdue → Void → Written Off
- Attach files (contracts, delivery notes)
- Invoice notes and terms & conditions (per-invoice + default)
- Due date calculation (Net 15, Net 30, Net 60, custom)
- Partial payments and payment tracking per invoice
- Credit notes: issue, apply to invoice, or refund
- Write-off bad debts
- Duplicate detection (same client + amount + date range)
- Bulk actions: send, download PDF, mark as sent, delete

### 2. Quotes / Estimates
- Create, edit, send quotes
- Quote statuses: Draft → Sent → Viewed → Accepted → Declined → Expired → Converted
- One-click convert accepted quote to invoice
- Expiry date with auto-expiry
- Client approval via portal (digital acceptance)
- Quote versioning (v1, v2 revisions)

### 3. Clients / Customers
- Client database with contacts, addresses, custom fields
- Multiple contact persons per client
- Billing and shipping addresses
- Client portal: login, view invoices, pay online, approve quotes, download statements
- Client statements (all transactions for a period)
- Outstanding balance tracking
- Client-level payment terms default
- Import/export clients (CSV)
- Client groups/tags for filtering

### 4. Products / Services Catalog
- Item database (name, description, SKU, unit, rate)
- Product types: goods, services
- Unit types: hours, units, kg, miles, etc.
- Tax association per product
- Price lists (different rates for different client groups)
- Track inventory (optional — units in stock, reorder level)
- Bulk import/export

### 5. Payments
- Record payments against invoices (full or partial)
- Multiple payment methods: cash, bank transfer, cheque, UPI, card, gateway
- Online payment gateways (plugin architecture):
  - Stripe (cards, ACH)
  - Razorpay (India: UPI, netbanking, cards, wallets)
  - PayPal
  - Extensible: add any gateway via plugin interface
- Payment receipts (auto-generated, customizable template)
- Overpayment handling (store as credit, apply to future invoices)
- Refunds: full or partial, linked to credit notes
- Payment reminders: automated email/SMS before and after due date
- Auto-charge for recurring invoices (saved cards/mandates)

### 6. Recurring Invoices
- Create recurring profiles (daily, weekly, monthly, yearly, custom)
- Auto-generate invoices on schedule
- Auto-send to client on generation
- Auto-charge saved payment method
- Start/end date, max occurrences
- Pause/resume recurring profiles
- Pre-generation review option (draft first, then send)

### 7. Expenses
- Track business expenses with receipt upload (image/PDF)
- Expense categories (travel, office, software, meals, etc.)
- Mark expense as billable → attach to client → convert to invoice line item
- Recurring expenses
- Mileage tracking (distance × rate)
- Vendor management (who you pay)
- Expense approval workflow (for teams)
- OCR receipt scanning (premium feature)

### 8. Tax Engine
- **India GST**: CGST + SGST (intra-state), IGST (inter-state), cess
  - HSN/SAC code support
  - GST rate: 0%, 5%, 12%, 18%, 28%
  - Reverse charge mechanism
  - GSTR-1 / GSTR-3B report data export
  - e-Invoice and e-Way Bill integration hooks
- **VAT (UK/EU)**: Standard, reduced, zero-rated, exempt
  - VAT return data export
  - Reverse charge for B2B cross-border
- **US Sales Tax**: State-level rates, nexus tracking
- **Tax-inclusive and tax-exclusive pricing**
- **Tax exemption** per client or per transaction
- Custom tax rates for any country
- TDS (Tax Deducted at Source) for India
- Withholding tax support

### 9. Client Portal
- Branded login page (your logo, colors)
- Client sees: all invoices, quotes, payments, credit notes, statements
- Pay invoices online (via configured gateways)
- Accept/decline quotes
- Download PDF invoices and receipts
- View outstanding balance
- Raise disputes on invoices
- Upload documents (proofs, POs)

### 10. Templates & Branding
- 10+ invoice/quote/receipt templates (professional, modern, minimal, classic)
- Custom branding: logo, colors, fonts, header/footer
- Custom fields on invoices, quotes, clients
- Email templates: customizable subject + body for each event
- PDF templates: Handlebars-based, fully customizable
- Multi-language support (invoice content, not just UI)

### 11. Reports & Analytics
- Dashboard: revenue, outstanding, overdue, recent activity, cash flow chart
- Invoice reports: by status, by client, by date range, aging
- Payment reports: by method, by gateway, by period
- Tax reports: GST summary, VAT return, sales tax by state
- Expense reports: by category, by vendor, by period, billable vs non-billable
- Client reports: top clients by revenue, outstanding by client
- Profit & loss (revenue - expenses)
- Receivables aging (current, 1-30, 31-60, 61-90, 90+ days)
- Custom report builder (premium)
- Export to CSV, Excel, PDF
- Scheduled email reports (daily/weekly/monthly digest)

### 12. Automation & Workflows
- Auto-send invoice on creation
- Auto-send payment reminders (X days before/after due date)
- Auto-mark overdue invoices
- Auto-generate recurring invoices
- Auto-apply credits to new invoices
- Auto-send thank you email on payment
- Webhook events for all major actions (invoice.created, payment.received, etc.)
- Zapier/n8n integration via webhooks

### 13. Multi-tenancy & Team
- Multi-organization support (one account, multiple businesses)
- Role-based access: Owner, Admin, Accountant, Sales, View-only
- Approval workflows (invoice approval before sending)
- Activity log / audit trail (who did what, when)
- Team invites via email

### 14. Platform & Infrastructure
- REST API with full CRUD (for third-party integrations)
- Webhook system (subscribe to events)
- Import/export: CSV for clients, products, invoices
- Multi-currency with auto exchange rates (via open exchange rate API)
- Multi-language (UI + document content)
- Time zone support
- API rate limiting
- CORS configuration
- Docker deployment (single command)
- Backup/restore via CLI

---

## API Routes

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/api/v1/auth` | login, register, refresh, logout, forgot/reset password |
| Organizations | `/api/v1/organizations` | CRUD, settings, branding, tax config |
| Clients | `/api/v1/clients` | CRUD, contacts, portal access, statements, import/export |
| Products | `/api/v1/products` | CRUD, price lists, import/export |
| Invoices | `/api/v1/invoices` | CRUD, send, duplicate, void, write-off, bulk actions, PDF |
| Quotes | `/api/v1/quotes` | CRUD, send, convert to invoice, client approval |
| Payments | `/api/v1/payments` | record, refund, receipts, gateway callbacks |
| Credit Notes | `/api/v1/credit-notes` | CRUD, apply to invoice, refund |
| Expenses | `/api/v1/expenses` | CRUD, receipt upload, bill to client, categories |
| Recurring | `/api/v1/recurring` | profiles CRUD, pause/resume, execution history |
| Reports | `/api/v1/reports` | revenue, receivables, tax, expenses, aging, P&L |
| Portal | `/api/v1/portal` | client-facing: invoices, quotes, payments, disputes |
| Webhooks | `/api/v1/webhooks` | subscribe, list, test, delivery logs |
| Settings | `/api/v1/settings` | tax rates, payment gateways, templates, numbering |

---

## Database Schema (Key Tables)

```
organizations          — multi-tenant root
users                  — team members with roles
clients                — customers / billing contacts
client_contacts        — multiple contacts per client
products               — items / services catalog
price_lists            — client-group specific pricing
tax_rates              — GST, VAT, sales tax definitions
invoices               — the core document
invoice_items          — line items with tax breakdown
quotes                 — estimates / proposals
quote_items            — line items
credit_notes           — issued credits
credit_note_items      — line items
payments               — received payments
payment_allocations    — links payments to invoices
expenses               — business expenses
expense_categories     — categorization
recurring_profiles     — recurring invoice/expense configs
recurring_executions   — execution history
templates              — PDF and email templates
client_portal_access   — portal credentials
webhooks               — event subscriptions
webhook_deliveries     — delivery logs
audit_logs             — activity trail
settings               — org-level config (numbering, defaults)
```

---

## Coding Conventions

### TypeScript
- Strict mode always (`"strict": true`)
- No `any` — use `unknown` and type guards
- Interfaces over types for object shapes
- Enums for finite sets (InvoiceStatus, PaymentMethod, etc.)
- All shared types live in `@emp-billing/shared`

### Backend
- **Thin controllers**: validate request (Zod) → call service → return `ApiResponse<T>`
- **Services contain business logic**: never in controllers or routes
- **Repository pattern**: services call `db.adapter` methods, never raw SQL
- **DB adapter**: same abstraction as emp-payroll — switch MySQL/PG/Mongo via `DB_PROVIDER` env
- **Consistent error handling**: throw `AppError(statusCode, code, message)` → caught by error middleware
- **All monetary values stored as integers** (paise/cents) to avoid floating point issues — divide by 100 for display

### Frontend
- **Functional components only** (no class components)
- **TanStack Query for all API calls** (useQuery, useMutation)
- **Zustand for client-only state** (UI state, filters, modals)
- **React Hook Form + Zod** for all forms
- **Tailwind CSS** — no inline styles, no CSS modules
- **Component structure**: `components/common/` for shared UI, `components/{domain}/` for feature-specific
- **Pages are thin**: compose layout + components, no business logic in pages

### Naming
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database columns: `snake_case`
- API routes: `kebab-case` (`/credit-notes`, `/payment-gateways`)

### Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Branch naming: `feat/invoice-pdf`, `fix/gst-calculation`, `refactor/payment-service`

---

## Key Design Decisions

1. **Money as integers**: All amounts stored in smallest unit (paise for INR, cents for USD). This eliminates floating-point rounding errors. The shared `formatMoney(amount, currency)` utility handles display.

2. **DB abstraction**: Same pattern as emp-payroll. The `IDBAdapter` interface with Knex (MySQL/PG) and Mongoose (MongoDB) adapters. Business logic never touches the DB directly.

3. **Event-driven architecture**: Major actions emit events (`invoice.created`, `payment.received`, `quote.accepted`). Listeners handle side effects (send email, generate PDF, fire webhook, update dashboard). This keeps services decoupled.

4. **Plugin-based payment gateways**: Each gateway implements `IPaymentGateway` interface with `createOrder()`, `verifyPayment()`, `refund()`, `getWebhookHandler()`. Add new gateways without touching core code.

5. **Template engine**: Invoice/quote/receipt PDFs use Handlebars templates rendered to HTML, then converted to PDF via Puppeteer. Users can customize templates without code changes.

6. **Multi-tenant from day one**: Every query is scoped by `org_id`. The middleware extracts org context from JWT. No data leaks between tenants.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DB credentials

# 3. Start infrastructure
docker compose up -d  # MySQL + Redis

# 4. Run migrations & seed
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev
# Server: http://localhost:4001
# Client: http://localhost:5174
```

---

## What to Build First (Priority Order)

1. **Invoice CRUD + PDF generation** — the core product
2. **Client management** — needed for invoices
3. **Payment recording** — close the billing loop
4. **Dashboard** — revenue, outstanding, overdue
5. **GST tax engine** — India compliance
6. **Recurring invoices** — automation
7. **Client portal** — let clients pay online
8. **Quotes** — pre-sale workflow
9. **Expenses** — complete the financial picture
10. **Reports** — analytics and compliance

---

## Relationship to Other EmpCloud Modules

- **emp-payroll**: Shares DB adapter pattern, shared types architecture, and monorepo structure
- **EmpMonitor**: emp-billing can import client/employee data from EmpMonitor's backend APIs
- **Future**: emp-billing invoices can be triggered from emp-payroll (vendor payments, contractor invoicing)
