import { Worker } from "bullmq";
import dayjs from "dayjs";
import { v4 as uuid } from "uuid";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { InvoiceStatus, PricingModel } from "@emp-billing/shared";
import { calculatePrice } from "../services/pricing/pricing.service";
import { nextInvoiceNumber } from "../utils/number-generator";
import type { Product, Subscription } from "@emp-billing/shared";

// ============================================================================
// USAGE BILLING WORKER
// Runs daily at 1am — converts metered usage into invoices:
// 1. Finds active subscriptions whose billing period has ended
// 2. Aggregates usage records for each subscription's period
// 3. Creates an invoice with usage line items priced via the pricing service
// ============================================================================

const usageBillingWorker = new Worker(
  QUEUE_NAMES.USAGE_BILLING,
  async (job) => {
    logger.info("Processing usage billing", { jobId: job.id });

    const db = await getDB();
    const today = dayjs().format("YYYY-MM-DD");
    const now = new Date();
    let invoiceCount = 0;

    // Find active subscriptions where current_period_end <= today
    // These are subscriptions that need usage billing
    const subscriptions = await db.raw<(Subscription & { plan_currency: string })[]>(
      `SELECT s.*, p.currency as plan_currency
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active'
         AND s.current_period_end IS NOT NULL
         AND DATE(s.current_period_end) <= ?`,
      [today]
    );

    for (const sub of subscriptions) {
      try {
        const orgId = sub.orgId || (sub as any).org_id;
        const clientId = sub.clientId || (sub as any).client_id;
        const periodStart = sub.currentPeriodStart || (sub as any).current_period_start;
        const periodEnd = sub.currentPeriodEnd || (sub as any).current_period_end;

        // Find usage records for this subscription's billing period
        const usageRecords = await db.raw<{
          product_id: string;
          total_quantity: number;
        }[]>(
          `SELECT product_id, SUM(quantity) as total_quantity
           FROM usage_records
           WHERE org_id = ? AND subscription_id = ?
             AND period_start >= ? AND period_end <= ?
           GROUP BY product_id`,
          [orgId, sub.id, periodStart, periodEnd]
        );

        if (usageRecords.length === 0) continue;

        // Load products and calculate amounts
        const lineItems: { product: Product; quantity: number; amount: number }[] = [];
        let subtotal = 0;

        for (const usage of usageRecords) {
          const product = await db.findById<Product>("products", usage.product_id, orgId);
          if (!product) continue;

          // Parse pricing tiers if needed
          if (product.pricingTiers && typeof product.pricingTiers === "string") {
            product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
          }

          // Only bill metered products
          if (product.pricingModel !== PricingModel.METERED) continue;

          const amount = calculatePrice(product, Number(usage.total_quantity));
          lineItems.push({ product, quantity: Number(usage.total_quantity), amount });
          subtotal += amount;
        }

        if (lineItems.length === 0 || subtotal === 0) continue;

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

        // Mark usage records as billed (optional: add a billed flag or link to invoice)
        // For now we rely on period dates to avoid double-billing

        invoiceCount++;
        logger.info("Usage invoice created", {
          subscriptionId: sub.id,
          invoiceId,
          total: subtotal,
          items: lineItems.length,
        });
      } catch (err) {
        logger.error("Usage billing failed for subscription", {
          subscriptionId: sub.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Usage billing complete", { invoicesCreated: invoiceCount });
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
