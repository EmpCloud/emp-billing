// ============================================================================
// @empcloud/billing-sdk — Node.js SDK for EMP Billing API
// ============================================================================

import { HttpClient } from "./http";
import {
  ClientsResource,
  InvoicesResource,
  SubscriptionsResource,
  PlansResource,
  UsageResource,
  WebhooksResource,
} from "./resources";
import type { EmpBillingOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.empcloud.com/billing/v1";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * EMP Billing SDK client.
 *
 * ```ts
 * import { EmpBilling } from "@empcloud/billing-sdk";
 *
 * const billing = new EmpBilling({ apiKey: "empb_live_..." });
 *
 * // Create a client
 * const client = await billing.clients.create({
 *   name: "Acme Corp",
 *   email: "billing@acme.com",
 * });
 *
 * // Create and send an invoice
 * const invoice = await billing.invoices.create({
 *   clientId: client.id,
 *   items: [{ name: "Pro Plan — March 2026", quantity: 1, rate: 9900 }],
 * });
 * await billing.invoices.send(invoice.id);
 * ```
 */
export class EmpBilling {
  private readonly http: HttpClient;

  /** Client (customer) management. */
  public readonly clients: ClientsResource;
  /** Invoice creation, sending, and PDF download. */
  public readonly invoices: InvoicesResource;
  /** Subscription lifecycle management. */
  public readonly subscriptions: SubscriptionsResource;
  /** Billing plan management. */
  public readonly plans: PlansResource;
  /** Metered usage reporting and invoice generation. */
  public readonly usage: UsageResource;
  /** Webhook subscription and signature verification. */
  public readonly webhooks: WebhooksResource;

  constructor(options: EmpBillingOptions) {
    if (!options.apiKey) {
      throw new Error(
        "EmpBilling: apiKey is required. Get one at https://app.empcloud.com/settings/api-keys",
      );
    }

    this.http = new HttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: options.apiKey,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    });

    this.clients = new ClientsResource(this.http);
    this.invoices = new InvoicesResource(this.http);
    this.subscriptions = new SubscriptionsResource(this.http);
    this.plans = new PlansResource(this.http);
    this.usage = new UsageResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
  }
}

// Re-export everything consumers need
export * from "./types";
export * from "./errors";
