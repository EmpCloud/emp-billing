import { Worker } from "bullmq";
import dayjs from "dayjs";
import { v4 as uuid } from "uuid";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { InvoiceStatus, PricingModel } from "@emp-billing/shared";
import { calculatePrice } from "../services/pricing/pricing.service";
import { nextInvoiceNumber } from "../utils/number-generator";
import { emit } from "../events/index";
import type { Product, Subscription } from "@emp-billing/shared";

// ============================================================================
// USAGE BILLING WORKER
// Runs daily at 2am — converts metered usage into invoices:
// 1. Finds active subscriptions whose billing period has ended
// 2. Aggregates unbilled usage records for each subscription's period
// 3. Creates an invoice with usage line items priced via the pricing service
// 4. Marks usage records as billed to prevent double-billing
// 5. Also handles standalone (non-subscription) unbilled usage per client
// ============================================================================

export interface UsageBillingResult {
  invoicesGenerated: number;
  subscriptionsProcessed: number;
  standaloneClientsProcessed: number;
  errors: { id: string; error: string }[];
}

/**
 * Core billing logic — shared between the scheduled worker and manual trigger.
 */
export async function processUsageBilling(): Promise<UsageBillingResult> {
  const db = await getDB();
  const today = dayjs().format("YYYY-MM-DD");
  const now = new Date();

  const result: UsageBillingResult = {
    invoicesGenerated: 0,
    subscriptionsProcessed: 0,
    standaloneClientsProcessed: 0,
    errors: [],
  };

  // ── Phase 1: Subscription-based usage billing ─────────────────────────────
  // Find active subscriptions where the current billing period has ended

  const subscriptions = await db.raw<(Subscription & { plan_currency: string })[]>(
    `SELECT s.*, p.currency as plan_currency
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.status = 'active'
       AND s.current_period_end IS NOT NULL
       AND DATE(s.current_period_end) <= ?`,
    [today]
  );

  logger.info(`Found ${subscriptions.length} subscriptions with ended billing periods`);

  for (const sub of subscriptions) {
    try {
      const orgId = sub.orgId || (sub as any).org_id;
      const clientId = sub.clientId || (sub as any).client_id;
      const periodStart = sub.currentPeriodStart || (sub as any).current_period_start;
      const periodEnd = sub.currentPeriodEnd || (sub as any).current_period_end;

      // Find unbilled usage records for this subscription's billing period
      const usageRecords = await db.raw<{
        product_id: string;
        total_quantity: number;
      }[]>(
        `SELECT product_id, SUM(quantity) as total_quantity
         FROM usage_records
         WHERE org_id = ? AND subscription_id = ?
           AND period_start >= ? AND period_end <= ?
           AND billed = false
         GROUP BY product_id`,
        [orgId, sub.id, periodStart, periodEnd]
      );

      if (usageRecords.length === 0) {
        result.subscriptionsProcessed++;
        continue;
      }

      // Load products and calculate amounts
      const lineItems: { product: Product; quantity: number; amount: number }[] = [];
      let subtotal = 0;

      for (const usage of usageRecords) {
        const product = await db.findById<Product>("products", usage.product_id, orgId);
        if (!product) continue;

        // Parse pricing tiers if stored as JSON string
        if (product.pricingTiers && typeof product.pricingTiers === "string") {
          product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
        }

        // Only bill metered products
        if (product.pricingModel !== PricingModel.METERED) continue;

        const amount = calculatePrice(product, Number(usage.total_quantity));
        lineItems.push({ product, quantity: Number(usage.total_quantity), amount });
        subtotal += amount;
      }

      if (lineItems.length === 0 || subtotal === 0) {
        result.subscriptionsProcessed++;
        continue;
      }

      // Create usage invoice
      const createdBy = sub.createdBy || (sub as any).created_by || "system";
      const currency = sub.plan_currency || "INR";

      const invoiceNumber = await nextInvoiceNumber(orgId);
      const invoiceId = uuid();
      const dueDate = dayjs(now).add(7, "day").format("YYYY-MM-DD");

      await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId,
        invoiceNumber,
        status: InvoiceStatus.SENT,
        issueDate: dayjs(now).format("YYYY-MM-DD"),
        dueDate,
        currency,
        exchangeRate: 1,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        total: subtotal,
        amountPaid: 0,
        amountDue: subtotal,
        notes: `Metered usage charges for ${dayjs(periodStart).format("MMM D")} - ${dayjs(periodEnd).format("MMM D, YYYY")}`,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });

      // Create invoice items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await db.create("invoice_items", {
          id: uuid(),
          invoiceId,
          orgId,
          productId: item.product.id,
          name: item.product.name,
          description: `Usage: ${item.quantity} ${item.product.unit || "units"} (${dayjs(periodStart).format("MMM D")} - ${dayjs(periodEnd).format("MMM D")})`,
          quantity: item.quantity,
          rate: Math.round(item.amount / item.quantity),
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: item.amount,
          sortOrder: i,
        });
      }

      // Mark usage records as billed and link to invoice
      await db.raw(
        `UPDATE usage_records
         SET billed = true, invoice_id = ?
         WHERE org_id = ? AND subscription_id = ?
           AND period_start >= ? AND period_end <= ?
           AND billed = false`,
        [invoiceId, orgId, sub.id, periodStart, periodEnd]
      );

      result.invoicesGenerated++;
      result.subscriptionsProcessed++;

      // Emit event for downstream processing (webhooks, emails, etc.)
      emit("invoice.created", {
        orgId,
        invoiceId,
        invoice: { clientId, total: subtotal, source: "usage-billing" } as unknown as Record<string, unknown>,
      });

      logger.info("Usage invoice created for subscription", {
        subscriptionId: sub.id,
        invoiceId,
        total: subtotal,
        items: lineItems.length,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ id: sub.id, error: errMsg });
      logger.error("Usage billing failed for subscription", {
        subscriptionId: sub.id,
        err: errMsg,
      });
      // Continue processing remaining subscriptions
    }
  }

  // ── Phase 2: Standalone (non-subscription) usage billing ──────────────────
  // Find clients with unbilled usage records not tied to a subscription
  // whose period has ended (period_end <= today)

  const standaloneUsage = await db.raw<{ org_id: string; client_id: string }[]>(
    `SELECT DISTINCT org_id, client_id
     FROM usage_records
     WHERE subscription_id IS NULL
       AND billed = false
       AND DATE(period_end) <= ?`,
    [today]
  );

  logger.info(`Found ${standaloneUsage.length} clients with standalone unbilled usage`);

  for (const row of standaloneUsage) {
    const orgId = row.org_id;
    const clientId = row.client_id;

    try {
      // Aggregate unbilled usage grouped by product
      const usageRecords = await db.raw<{
        product_id: string;
        total_quantity: number;
        min_period_start: string;
        max_period_end: string;
      }[]>(
        `SELECT product_id,
                SUM(quantity) as total_quantity,
                MIN(period_start) as min_period_start,
                MAX(period_end) as max_period_end
         FROM usage_records
         WHERE org_id = ? AND client_id = ?
           AND subscription_id IS NULL
           AND billed = false
           AND DATE(period_end) <= ?
         GROUP BY product_id`,
        [orgId, clientId, today]
      );

      if (usageRecords.length === 0) continue;

      const lineItems: { product: Product; quantity: number; amount: number }[] = [];
      let subtotal = 0;
      let overallPeriodStart = "";
      let overallPeriodEnd = "";

      for (const usage of usageRecords) {
        const product = await db.findById<Product>("products", usage.product_id, orgId);
        if (!product) continue;

        if (product.pricingTiers && typeof product.pricingTiers === "string") {
          product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
        }

        if (product.pricingModel !== PricingModel.METERED) continue;

        const amount = calculatePrice(product, Number(usage.total_quantity));
        lineItems.push({ product, quantity: Number(usage.total_quantity), amount });
        subtotal += amount;

        // Track overall period range
        if (!overallPeriodStart || usage.min_period_start < overallPeriodStart) {
          overallPeriodStart = usage.min_period_start;
        }
        if (!overallPeriodEnd || usage.max_period_end > overallPeriodEnd) {
          overallPeriodEnd = usage.max_period_end;
        }
      }

      if (lineItems.length === 0 || subtotal === 0) {
        result.standaloneClientsProcessed++;
        continue;
      }

      // Look up client for payment terms and currency
      const client = await db.findById<{ id: string; currency?: string; paymentTerms?: number }>(
        "clients", clientId, orgId
      );
      const currency = client?.currency ?? "INR";
      const paymentTermsDays = client?.paymentTerms ?? 30;

      const invoiceNumber = await nextInvoiceNumber(orgId);
      const invoiceId = uuid();
      const dueDate = dayjs(now).add(paymentTermsDays, "day").format("YYYY-MM-DD");

      await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId,
        invoiceNumber,
        status: InvoiceStatus.DRAFT,
        issueDate: dayjs(now).format("YYYY-MM-DD"),
        dueDate,
        currency,
        exchangeRate: 1,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        total: subtotal,
        amountPaid: 0,
        amountDue: subtotal,
        notes: `Auto-generated from metered usage for ${dayjs(overallPeriodStart).format("MMM D")} - ${dayjs(overallPeriodEnd).format("MMM D, YYYY")}`,
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await db.create("invoice_items", {
          id: uuid(),
          invoiceId,
          orgId,
          productId: item.product.id,
          name: item.product.name,
          description: `Usage: ${item.quantity} ${item.product.unit || "units"} (${dayjs(overallPeriodStart).format("MMM D")} - ${dayjs(overallPeriodEnd).format("MMM D")})`,
          quantity: item.quantity,
          rate: Math.round(item.amount / item.quantity),
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: item.amount,
          sortOrder: i,
        });
      }

      // Mark standalone usage records as billed
      await db.raw(
        `UPDATE usage_records
         SET billed = true, invoice_id = ?
         WHERE org_id = ? AND client_id = ?
           AND subscription_id IS NULL
           AND billed = false
           AND DATE(period_end) <= ?`,
        [invoiceId, orgId, clientId, today]
      );

      result.invoicesGenerated++;
      result.standaloneClientsProcessed++;

      emit("invoice.created", {
        orgId,
        invoiceId,
        invoice: { clientId, total: subtotal, source: "usage-billing" } as unknown as Record<string, unknown>,
      });

      logger.info("Usage invoice created for standalone client", {
        clientId,
        orgId,
        invoiceId,
        total: subtotal,
        items: lineItems.length,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ id: `${orgId}:${clientId}`, error: errMsg });
      logger.error("Standalone usage billing failed", {
        orgId,
        clientId,
        err: errMsg,
      });
      // Continue processing remaining clients
    }
  }

  return result;
}

// ── BullMQ Worker ───────────────────────────────────────────────────────────

const usageBillingWorker = new Worker(
  QUEUE_NAMES.USAGE_BILLING,
  async (job) => {
    logger.info("Processing usage billing", { jobId: job.id });

    const result = await processUsageBilling();

    logger.info("Usage billing complete", {
      invoicesGenerated: result.invoicesGenerated,
      subscriptionsProcessed: result.subscriptionsProcessed,
      standaloneClientsProcessed: result.standaloneClientsProcessed,
      errors: result.errors.length,
    });

    return result;
  },
  { connection, concurrency: 1 }
);

// ── Worker events ────────────────────────────────────────────────────────────

usageBillingWorker.on("completed", (job) => {
  logger.info("Usage billing job completed", { jobId: job.id });
});

usageBillingWorker.on("failed", (job, err) => {
  logger.error("Usage billing job failed", { jobId: job?.id, error: err.message });
});

export { usageBillingWorker };
