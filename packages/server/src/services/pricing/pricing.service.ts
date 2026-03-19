import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { PricingModel } from "@emp-billing/shared";
import type { Product, PricingTier, UsageRecord } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateUsageRecordSchema, UsageFilterSchema } from "@emp-billing/shared";

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
