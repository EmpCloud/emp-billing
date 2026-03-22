# @empcloud/billing-sdk

Node.js SDK for the [EMP Billing](https://github.com/EmpCloud/emp-billing) API. Provides a typed, developer-friendly wrapper for managing clients, invoices, subscriptions, usage-based billing, and webhooks.

Requires **Node.js 18+** (uses native `fetch`).

## Installation

```bash
npm install @empcloud/billing-sdk
```

## Quick Start

```ts
import { EmpBilling } from "@empcloud/billing-sdk";

const billing = new EmpBilling({
  apiKey: "empb_live_...",
  // baseUrl: "https://your-self-hosted-instance.com/api/v1", // optional
});
```

## Clients

```ts
// List clients
const { data: clients, meta } = await billing.clients.list({ page: 1, limit: 10 });

// Create a client
const client = await billing.clients.create({
  name: "Acme Corp",
  email: "billing@acme.com",
  currency: "USD",
  paymentTerms: 30,
});

// Get a client
const acme = await billing.clients.get(client.id);

// Auto-provision (find-or-create) from your platform's user data
const { client: synced, created } = await billing.clients.autoProvision({
  externalId: "usr_abc123",
  name: "Acme Corp",
  email: "billing@acme.com",
});
```

## Invoices

```ts
// Create an invoice (amounts in smallest currency unit, e.g. cents)
const invoice = await billing.invoices.create({
  clientId: client.id,
  items: [
    { name: "Pro Plan - March 2026", quantity: 1, rate: 9900 },
    { name: "Extra seats (5)", quantity: 5, rate: 500 },
  ],
  notes: "Thank you for your business!",
});

// Send to client via email
await billing.invoices.send(invoice.id);

// Download PDF
const pdfBuffer = await billing.invoices.downloadPdf(invoice.id);
fs.writeFileSync("invoice.pdf", pdfBuffer);

// List invoices with filters
const { data: overdue } = await billing.invoices.list({
  status: InvoiceStatus.OVERDUE,
  clientId: client.id,
});
```

## Subscriptions

```ts
// Create a plan
const plan = await billing.plans.create({
  name: "Pro",
  billingInterval: BillingInterval.MONTHLY,
  price: 9900, // $99.00
  currency: "USD",
  features: ["Unlimited projects", "Priority support"],
});

// Subscribe a client
const subscription = await billing.subscriptions.create({
  clientId: client.id,
  planId: plan.id,
});

// Change plan (upgrade/downgrade)
await billing.subscriptions.changePlan(subscription.id, newPlanId);

// Cancel
await billing.subscriptions.cancel(subscription.id, "Switching to competitor");
```

## Usage-Based Billing

```ts
// Report metered usage
await billing.usage.report({
  clientId: client.id,
  productId: "prod_api_calls",
  quantity: 15000,
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
});

// Report usage in batch
await billing.usage.reportBatch([
  { clientId: "c1", productId: "prod_api_calls", quantity: 5000, periodStart: "2026-03-01", periodEnd: "2026-03-31" },
  { clientId: "c2", productId: "prod_api_calls", quantity: 12000, periodStart: "2026-03-01", periodEnd: "2026-03-31" },
]);

// Generate an invoice from unbilled usage
const usageInvoice = await billing.usage.generateInvoice({
  clientId: client.id,
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
});
```

## Webhooks

```ts
// Subscribe to events
const webhook = await billing.webhooks.create({
  url: "https://your-app.com/webhooks/billing",
  events: [WebhookEvent.INVOICE_PAID, WebhookEvent.SUBSCRIPTION_CANCELLED],
});

// Verify incoming webhook signatures in your handler
app.post("/webhooks/billing", (req, res) => {
  const isValid = billing.webhooks.verifySignature(
    req.body,                                    // raw body string
    req.headers["x-empbilling-signature"] as string,
    process.env.WEBHOOK_SECRET!,
  );

  if (!isValid) {
    return res.status(401).send("Invalid signature");
  }

  const event = JSON.parse(req.body);
  switch (event.type) {
    case "invoice.paid":
      // Activate the customer's account
      break;
    case "subscription.cancelled":
      // Deactivate access
      break;
  }

  res.status(200).send("OK");
});
```

## Error Handling

The SDK throws typed errors for different failure modes:

```ts
import {
  BillingApiError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
} from "@empcloud/billing-sdk";

try {
  await billing.invoices.get("nonexistent");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("Invoice not found");
  } else if (err instanceof ValidationError) {
    console.log("Validation errors:", err.fieldErrors);
  } else if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfterSeconds}s`);
  } else if (err instanceof AuthenticationError) {
    console.log("Bad API key");
  } else if (err instanceof BillingApiError) {
    console.log(`API error ${err.status}: ${err.message}`);
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | *required* | API key (starts with `empb_`) |
| `baseUrl` | `string` | `https://api.empcloud.com/billing/v1` | API base URL |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `maxRetries` | `number` | `3` | Max retries on 429/5xx errors |

## Automatic Retries

The SDK automatically retries requests that fail due to:

- **429 Too Many Requests** -- respects the `Retry-After` header when present
- **5xx Server Errors** -- transient server failures
- **Network errors** -- connection resets, DNS failures, timeouts

Retries use exponential backoff with jitter. Set `maxRetries: 0` to disable.

## License

MIT
