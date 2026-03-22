import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { PricingModel, InvoiceStatus } from "@emp-billing/shared";
import { computeLineItem, computeInvoiceTotals } from "../invoice/invoice.calculator";
import { nextInvoiceNumber } from "../../utils/number-generator";
import type { Product, PricingTier, UsageRecord, Invoice, InvoiceItem } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateUsageRecordSchema, UsageFilterSchema, ReportUsageSchema, GenerateUsageInvoiceSchema } from "@emp-billing/shared";

// ============================================================================
// PRICING SERVICE
// Advanced pricing calculations: flat, tiered, volume, per-seat, metered.
// All monetary values are in smallest unit (paise/cents).
// ============================================================================

// ── Price calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the total price for a given product and quantity.
 * Returns the total in the smallest currency unit (paise/cents).
 */
export function calculatePrice(product: Product, quantity: number): number {
  switch (product.pricingModel) {
    case PricingModel.FLAT:
      return Math.round(product.rate * quantity);

    case PricingModel.PER_SEAT:
      return Math.round(product.rate * quantity);

    case PricingModel.TIERED:
      return calculateTieredPrice(product.pricingTiers ?? [], quantity);

    case PricingModel.VOLUME:
      return calculateVolumePrice(product.pricingTiers ?? [], quantity);

    case PricingModel.METERED:
      // Metered pricing uses tiered or volume pricing on aggregated usage.
      // If tiers are defined, use tiered; otherwise fall back to flat rate.
      if (product.pricingTiers && product.pricingTiers.length > 0) {
        return calculateTieredPrice(product.pricingTiers, quantity);
      }
      return Math.round(product.rate * quantity);

    default:
      return Math.round(product.rate * quantity);
  }
}

/**
 * Tiered pricing: each tier bracket is priced independently.
 * Example: first 100 units at $10, next 400 at $8, rest at $5.
 */
function calculateTieredPrice(tiers: PricingTier[], quantity: number): number {
  if (tiers.length === 0) return 0;

  // Sort tiers by upTo (null = infinity goes last)
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  let remaining = quantity;
  let total = 0;
  let prevCap = 0;

  for (const tier of sorted) {
    if (remaining <= 0) break;

    const tierCap = tier.upTo === null ? Infinity : tier.upTo;
    const tierQuantity = Math.min(remaining, tierCap - prevCap);

    if (tierQuantity > 0) {
      total += Math.round(tierQuantity * tier.unitPrice);
      if (tier.flatFee) {
        total += tier.flatFee;
      }
      remaining -= tierQuantity;
    }

    prevCap = tier.upTo === null ? Infinity : tier.upTo;
  }

  return total;
}

/**
 * Volume pricing: the total quantity determines a single rate for ALL units.
 * Example: 150 units => entire order at $8/unit (the tier that covers 150).
 */
function calculateVolumePrice(tiers: PricingTier[], quantity: number): number {
  if (tiers.length === 0) return 0;

  // Sort tiers by upTo (null = infinity goes last)
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  // Find the tier that covers this quantity
  for (const tier of sorted) {
    if (tier.upTo === null || quantity <= tier.upTo) {
      let total = Math.round(quantity * tier.unitPrice);
      if (tier.flatFee) {
        total += tier.flatFee;
      }
      return total;
    }
  }

  // Fallback: use last tier
  const lastTier = sorted[sorted.length - 1];
  return Math.round(quantity * lastTier.unitPrice) + (lastTier.flatFee ?? 0);
}

/**
 * Get a breakdown of tiered pricing (for display in tooltips/invoices).
 */
export function getTieredPriceBreakdown(
  tiers: PricingTier[],
  quantity: number
): { from: number; to: number | null; qty: number; unitPrice: number; amount: number }[] {
  if (tiers.length === 0) return [];

  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  let remaining = quantity;
  let prevCap = 0;
  const breakdown: { from: number; to: number | null; qty: number; unitPrice: number; amount: number }[] = [];

  for (const tier of sorted) {
    if (remaining <= 0) break;

    const tierCap = tier.upTo === null ? Infinity : tier.upTo;
    const tierQuantity = Math.min(remaining, tierCap - prevCap);

    if (tierQuantity > 0) {
      breakdown.push({
        from: prevCap + 1,
        to: tier.upTo,
        qty: tierQuantity,
        unitPrice: tier.unitPrice,
        amount: Math.round(tierQuantity * tier.unitPrice),
      });
      remaining -= tierQuantity;
    }

    prevCap = tier.upTo === null ? Infinity : tier.upTo;
  }

  return breakdown;
}

// ── Usage records ─────────────────────────────────────────────────────────────

export async function recordUsage(
  orgId: string,
  data: z.infer<typeof CreateUsageRecordSchema>
): Promise<UsageRecord> {
  const db = await getDB();

  // Validate product exists
  const product = await db.findById<Product>("products", data.productId, orgId);
  if (!product) throw NotFoundError("Product");

  // Validate client exists
  const client = await db.findById("clients", data.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  if (product.pricingModel !== PricingModel.METERED) {
    throw BadRequestError("Usage records can only be created for metered products");
  }

  const now = new Date();
  const record = await db.create<UsageRecord>("usage_records", {
    id: uuid(),
    orgId,
    subscriptionId: data.subscriptionId ?? null,
    productId: data.productId,
    clientId: data.clientId,
    quantity: data.quantity,
    description: data.description ?? null,
    recordedAt: data.recordedAt ?? now,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    billed: false,
    invoiceId: null,
    createdAt: now,
  });

  return record;
}

export async function getUsageSummary(
  orgId: string,
  productId: string,
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ totalQuantity: number; totalAmount: number; recordCount: number }> {
  const db = await getDB();

  // Get the product for pricing calculation
  const product = await db.findById<Product>("products", productId, orgId);
  if (!product) throw NotFoundError("Product");
  // Parse pricingTiers from JSON string if needed
  if (product.pricingTiers && typeof product.pricingTiers === "string") {
    product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
  }

  const records = await db.raw<{ total_qty: number; record_count: number }[]>(
    `SELECT COALESCE(SUM(quantity), 0) as total_qty, COUNT(*) as record_count
     FROM usage_records
     WHERE org_id = ? AND product_id = ? AND client_id = ?
       AND period_start >= ? AND period_end <= ?`,
    [orgId, productId, clientId, periodStart, periodEnd]
  );

  const totalQuantity = Number(records[0]?.total_qty ?? 0);
  const recordCount = Number(records[0]?.record_count ?? 0);
  const totalAmount = calculatePrice(product, totalQuantity);

  return { totalQuantity, totalAmount, recordCount };
}

export async function listUsageRecords(
  orgId: string,
  opts: z.infer<typeof UsageFilterSchema>
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.productId) where.product_id = opts.productId;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<UsageRecord>("usage_records", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "recorded_at", direction: "desc" }],
  });

  // Date range filter
  if (opts.periodStart || opts.periodEnd) {
    result.data = result.data.filter((r) => {
      const start = new Date(r.periodStart);
      const end = new Date(r.periodEnd);
      if (opts.periodStart && end < opts.periodStart) return false;
      if (opts.periodEnd && start > opts.periodEnd) return false;
      return true;
    });
  }

  return result;
}

// ── Simplified usage reporting ───────────────────────────────────────────────

/**
 * Report metered usage — simplified endpoint for SaaS integrations.
 * Defaults periodStart/periodEnd to the current calendar month if not provided.
 */
export async function reportUsage(
  orgId: string,
  data: z.infer<typeof ReportUsageSchema>
): Promise<UsageRecord> {
  const db = await getDB();

  // Validate product exists
  const product = await db.findById<Product>("products", data.productId, orgId);
  if (!product) throw NotFoundError("Product");

  // Validate client exists
  const client = await db.findById("clients", data.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  if (product.pricingModel !== PricingModel.METERED) {
    throw BadRequestError("Usage records can only be created for metered products");
  }

  const now = new Date();
  const periodStart = data.periodStart ?? dayjs(now).startOf("month").toDate();
  const periodEnd = data.periodEnd ?? dayjs(now).endOf("month").toDate();

  const record = await db.create<UsageRecord>("usage_records", {
    id: uuid(),
    orgId,
    subscriptionId: null,
    productId: data.productId,
    clientId: data.clientId,
    quantity: data.quantity,
    description: data.description ?? null,
    recordedAt: now,
    periodStart,
    periodEnd,
    billed: false,
    invoiceId: null,
    createdAt: now,
  });

  return record;
}

/**
 * Generate an invoice from unbilled usage records for a client in a given period.
 * Groups usage by product, calculates pricing, creates the invoice, and marks records as billed.
 */
export async function generateUsageInvoice(
  orgId: string,
  userId: string,
  data: z.infer<typeof GenerateUsageInvoiceSchema>
): Promise<Invoice & { items: InvoiceItem[] }> {
  const db = await getDB();

  // Validate client exists
  const client = await db.findById<{ id: string; orgId: string; currency?: string; paymentTerms?: number }>(
    "clients",
    data.clientId,
    orgId
  );
  if (!client) throw NotFoundError("Client");

  // Find all unbilled usage records for this client in the period
  const unbilledRecords = await db.raw<UsageRecord[]>(
    `SELECT * FROM usage_records
     WHERE org_id = ? AND client_id = ? AND billed = false
       AND period_start >= ? AND period_end <= ?
     ORDER BY product_id, recorded_at`,
    [orgId, data.clientId, data.periodStart, data.periodEnd]
  );

  if (unbilledRecords.length === 0) {
    throw BadRequestError("No unbilled usage records found for the specified client and period");
  }

  // Group by product and sum quantities
  const productUsage = new Map<string, { quantity: number; descriptions: string[] }>();
  for (const record of unbilledRecords) {
    const existing = productUsage.get(record.productId) ?? { quantity: 0, descriptions: [] };
    existing.quantity += Number(record.quantity);
    if (record.description) {
      existing.descriptions.push(record.description);
    }
    productUsage.set(record.productId, existing);
  }

  // Build invoice items from grouped usage
  const invoiceItems: {
    productId: string;
    name: string;
    description: string;
    quantity: number;
    rate: number;
    unit?: string;
    hsnCode?: string;
    taxRateId?: string;
    sortOrder: number;
  }[] = [];

  let sortOrder = 0;
  for (const [productId, usage] of productUsage) {
    const product = await db.findById<Product>("products", productId, orgId);
    if (!product) continue;

    // Parse pricingTiers from JSON string if needed
    if (product.pricingTiers && typeof product.pricingTiers === "string") {
      product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
    }

    const totalAmount = calculatePrice(product, usage.quantity);
    // Compute the effective unit rate for the invoice line item (in smallest unit)
    const effectiveRate = usage.quantity > 0 ? Math.round(totalAmount / usage.quantity) : product.rate;

    const descParts = [
      `Usage: ${usage.quantity} × ${product.name}`,
      `Period: ${dayjs(data.periodStart).format("YYYY-MM-DD")} to ${dayjs(data.periodEnd).format("YYYY-MM-DD")}`,
    ];
    if (usage.descriptions.length > 0) {
      descParts.push(usage.descriptions.join("; "));
    }

    invoiceItems.push({
      productId,
      name: product.name,
      description: descParts.join("\n"),
      quantity: usage.quantity,
      rate: effectiveRate,
      unit: product.unit,
      hsnCode: product.hsnCode,
      taxRateId: product.taxRateId,
      sortOrder: sortOrder++,
    });
  }

  if (invoiceItems.length === 0) {
    throw BadRequestError("No valid products found for the usage records");
  }

  // Resolve tax rates
  const taxRates = new Map<string, { rate: number; components?: { name: string; rate: number }[] }>();
  for (const item of invoiceItems) {
    if (item.taxRateId && !taxRates.has(item.taxRateId)) {
      const tr = await db.findById<{ rate: number; components: string }>("tax_rates", item.taxRateId, orgId);
      if (tr) {
        const components = tr.components
          ? (typeof tr.components === "string" ? JSON.parse(tr.components) : tr.components)
          : undefined;
        taxRates.set(item.taxRateId, { rate: tr.rate, components });
      }
    }
  }

  // Compute line items
  const computedItems = invoiceItems.map((item) => {
    const taxInfo = item.taxRateId ? taxRates.get(item.taxRateId) : undefined;
    const computed = computeLineItem({
      quantity: item.quantity,
      rate: item.rate,
      taxRate: taxInfo?.rate ?? 0,
      taxComponents: taxInfo?.components,
    });
    return { ...item, ...computed };
  });

  const totals = computeInvoiceTotals(computedItems);

  const invoiceNumber = await nextInvoiceNumber(orgId);
  const invoiceId = uuid();
  const now = new Date();
  const issueDate = now;
  const dueDate = dayjs(now).add(client.paymentTerms ?? 30, "day").toDate();
  const currency = client.currency ?? "INR";

  // Create invoice within a transaction to ensure atomicity
  return await db.transaction(async (trx) => {
    await trx.create("invoices", {
      id: invoiceId,
      orgId,
      clientId: data.clientId,
      invoiceNumber,
      referenceNumber: null,
      status: InvoiceStatus.DRAFT,
      issueDate,
      dueDate,
      currency,
      exchangeRate: 1,
      subtotal: totals.subtotal,
      discountType: null,
      discountValue: null,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      amountPaid: 0,
      amountDue: totals.total,
      tdsRate: null,
      tdsAmount: 0,
      tdsSection: null,
      notes: `Auto-generated from metered usage for period ${dayjs(data.periodStart).format("YYYY-MM-DD")} to ${dayjs(data.periodEnd).format("YYYY-MM-DD")}`,
      terms: null,
      customFields: null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Create invoice items
    await trx.createMany(
      "invoice_items",
      computedItems.map((item, idx) => ({
        id: uuid(),
        invoiceId,
        orgId,
        productId: item.productId ?? null,
        name: item.name,
        description: item.description ?? null,
        hsnCode: item.hsnCode ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        rate: item.rate,
        discountType: null,
        discountValue: null,
        discountAmount: item.discountAmount,
        taxRateId: item.taxRateId ?? null,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        taxComponents: item.taxBreakdown ? JSON.stringify(item.taxBreakdown) : null,
        amount: item.amount,
        sortOrder: idx,
      }))
    );

    // Update client totals
    await trx.increment("clients", data.clientId, "total_billed", totals.total);
    await trx.increment("clients", data.clientId, "outstanding_balance", totals.total);

    // Mark usage records as billed
    const recordIds = unbilledRecords.map((r) => r.id);
    for (const recordId of recordIds) {
      await trx.update("usage_records", recordId, {
        billed: true,
        invoiceId,
      });
    }

    // Fetch the created invoice and items
    const invoice = await trx.findById<Invoice>("invoices", invoiceId, orgId);
    const items = await trx.findMany<InvoiceItem>("invoice_items", {
      where: { invoice_id: invoiceId },
      orderBy: [{ column: "sort_order", direction: "asc" }],
    });

    return { ...invoice!, items };
  });
}
