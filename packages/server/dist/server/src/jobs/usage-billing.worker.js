"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageBillingWorker = void 0;
const bullmq_1 = require("bullmq");
const dayjs_1 = __importDefault(require("dayjs"));
const uuid_1 = require("uuid");
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
const pricing_service_1 = require("../services/pricing/pricing.service");
const number_generator_1 = require("../utils/number-generator");
// ============================================================================
// USAGE BILLING WORKER
// Runs daily at 1am — converts metered usage into invoices:
// 1. Finds active subscriptions whose billing period has ended
// 2. Aggregates usage records for each subscription's period
// 3. Creates an invoice with usage line items priced via the pricing service
// ============================================================================
const usageBillingWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.USAGE_BILLING, async (job) => {
    logger_1.logger.info("Processing usage billing", { jobId: job.id });
    const db = await (0, index_1.getDB)();
    const today = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const now = new Date();
    let invoiceCount = 0;
    // Find active subscriptions where current_period_end <= today
    // These are subscriptions that need usage billing
    const subscriptions = await db.raw(`SELECT s.*, p.currency as plan_currency
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status = 'active'
         AND s.current_period_end IS NOT NULL
         AND DATE(s.current_period_end) <= ?`, [today]);
    for (const sub of subscriptions) {
        try {
            const orgId = sub.orgId || sub.org_id;
            const clientId = sub.clientId || sub.client_id;
            const periodStart = sub.currentPeriodStart || sub.current_period_start;
            const periodEnd = sub.currentPeriodEnd || sub.current_period_end;
            // Find usage records for this subscription's billing period
            const usageRecords = await db.raw(`SELECT product_id, SUM(quantity) as total_quantity
           FROM usage_records
           WHERE org_id = ? AND subscription_id = ?
             AND period_start >= ? AND period_end <= ?
           GROUP BY product_id`, [orgId, sub.id, periodStart, periodEnd]);
            if (usageRecords.length === 0)
                continue;
            // Load products and calculate amounts
            const lineItems = [];
            let subtotal = 0;
            for (const usage of usageRecords) {
                const product = await db.findById("products", usage.product_id, orgId);
                if (!product)
                    continue;
                // Parse pricing tiers if needed
                if (product.pricingTiers && typeof product.pricingTiers === "string") {
                    product.pricingTiers = JSON.parse(product.pricingTiers);
                }
                // Only bill metered products
                if (product.pricingModel !== shared_1.PricingModel.METERED)
                    continue;
                const amount = (0, pricing_service_1.calculatePrice)(product, Number(usage.total_quantity));
                lineItems.push({ product, quantity: Number(usage.total_quantity), amount });
                subtotal += amount;
            }
            if (lineItems.length === 0 || subtotal === 0)
                continue;
            // Create usage invoice
            const createdBy = sub.createdBy || sub.created_by || "system";
            const currency = sub.plan_currency || "INR";
            const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
            const invoiceId = (0, uuid_1.v4)();
            const dueDate = (0, dayjs_1.default)(now).add(7, "day").format("YYYY-MM-DD");
            await db.create("invoices", {
                id: invoiceId,
                orgId,
                clientId,
                invoiceNumber,
                status: shared_1.InvoiceStatus.SENT,
                issueDate: (0, dayjs_1.default)(now).format("YYYY-MM-DD"),
                dueDate,
                currency,
                exchangeRate: 1,
                subtotal,
                discountAmount: 0,
                taxAmount: 0,
                total: subtotal,
                amountPaid: 0,
                amountDue: subtotal,
                notes: `Metered usage charges for ${(0, dayjs_1.default)(periodStart).format("MMM D")} - ${(0, dayjs_1.default)(periodEnd).format("MMM D, YYYY")}`,
                createdBy,
                createdAt: now,
                updatedAt: now,
            });
            // Create invoice items
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                await db.create("invoice_items", {
                    id: (0, uuid_1.v4)(),
                    invoiceId,
                    orgId,
                    productId: item.product.id,
                    name: item.product.name,
                    description: `Usage: ${item.quantity} ${item.product.unit || "units"} (${(0, dayjs_1.default)(periodStart).format("MMM D")} - ${(0, dayjs_1.default)(periodEnd).format("MMM D")})`,
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
            logger_1.logger.info("Usage invoice created", {
                subscriptionId: sub.id,
                invoiceId,
                total: subtotal,
                items: lineItems.length,
            });
        }
        catch (err) {
            logger_1.logger.error("Usage billing failed for subscription", {
                subscriptionId: sub.id,
                err: err instanceof Error ? err.message : String(err),
            });
        }
    }
    logger_1.logger.info("Usage billing complete", { invoicesCreated: invoiceCount });
}, { connection: queue_1.connection, concurrency: 1 });
exports.usageBillingWorker = usageBillingWorker;
// ── Worker events ────────────────────────────────────────────────────────────
usageBillingWorker.on("completed", (job) => {
    logger_1.logger.info("Usage billing job completed", { jobId: job.id });
});
usageBillingWorker.on("failed", (job, err) => {
    logger_1.logger.error("Usage billing job failed", { jobId: job?.id, error: err.message });
});
//# sourceMappingURL=usage-billing.worker.js.map