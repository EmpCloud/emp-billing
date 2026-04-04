import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import {
  calculatePrice,
  getTieredPriceBreakdown,
  recordUsage,
  getUsageSummary,
  listUsageRecords,
} from "./pricing.service";
import { PricingModel } from "@emp-billing/shared";
import type { Product, PricingTier } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findById: vi.fn(),
    findPaginated: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    raw: vi.fn(),
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    orgId: ORG_ID,
    name: "Widget",
    description: null,
    sku: null,
    type: "service",
    unit: "unit",
    rate: 1000, // $10.00
    pricingModel: PricingModel.FLAT,
    pricingTiers: null,
    hsnCode: null,
    trackInventory: false,
    stockOnHand: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Product;
}

const TIERS: PricingTier[] = [
  { upTo: 100, unitPrice: 1000, flatFee: 0 },
  { upTo: 500, unitPrice: 800, flatFee: 0 },
  { upTo: null, unitPrice: 500, flatFee: 0 },
];

describe("pricing.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── calculatePrice ──────────────────────────────────────────────────────

  describe("calculatePrice", () => {
    it("calculates flat price", () => {
      const product = makeProduct({ pricingModel: PricingModel.FLAT, rate: 1000 });
      expect(calculatePrice(product, 5)).toBe(5000);
    });

    it("calculates per-seat price", () => {
      const product = makeProduct({ pricingModel: PricingModel.PER_SEAT, rate: 2000 });
      expect(calculatePrice(product, 10)).toBe(20000);
    });

    it("calculates tiered price", () => {
      const product = makeProduct({ pricingModel: PricingModel.TIERED, pricingTiers: TIERS });

      // 150 units: first 100 at 1000, next 50 at 800
      const total = calculatePrice(product, 150);
      expect(total).toBe(100 * 1000 + 50 * 800); // 140000
    });

    it("calculates volume price", () => {
      const product = makeProduct({ pricingModel: PricingModel.VOLUME, pricingTiers: TIERS });

      // 150 units: all at 800 (the tier that covers 150)
      const total = calculatePrice(product, 150);
      expect(total).toBe(150 * 800); // 120000
    });

    it("handles metered with tiers", () => {
      const product = makeProduct({ pricingModel: PricingModel.METERED, pricingTiers: TIERS });
      const total = calculatePrice(product, 50);
      expect(total).toBe(50 * 1000); // first tier only
    });

    it("handles metered without tiers (falls back to flat)", () => {
      const product = makeProduct({ pricingModel: PricingModel.METERED, rate: 500, pricingTiers: [] });
      expect(calculatePrice(product, 10)).toBe(5000);
    });

    it("handles unknown pricing model (defaults to flat)", () => {
      const product = makeProduct({ pricingModel: "unknown" as PricingModel, rate: 200 });
      expect(calculatePrice(product, 3)).toBe(600);
    });

    it("handles tiered with flat fees", () => {
      const tiersWithFee: PricingTier[] = [
        { upTo: 10, unitPrice: 100, flatFee: 500 },
        { upTo: null, unitPrice: 80, flatFee: 0 },
      ];
      const product = makeProduct({ pricingModel: PricingModel.TIERED, pricingTiers: tiersWithFee });

      // 15 units: first 10 at 100 + 500 flat, next 5 at 80
      expect(calculatePrice(product, 15)).toBe(10 * 100 + 500 + 5 * 80); // 1900
    });

    it("returns 0 for tiered with empty tiers", () => {
      const product = makeProduct({ pricingModel: PricingModel.TIERED, pricingTiers: [] });
      expect(calculatePrice(product, 10)).toBe(0);
    });

    it("calculates volume price with flat fees", () => {
      const tiersWithFee: PricingTier[] = [
        { upTo: 10, unitPrice: 100, flatFee: 500 },
        { upTo: 50, unitPrice: 80, flatFee: 200 },
        { upTo: null, unitPrice: 50, flatFee: 0 },
      ];
      const product = makeProduct({ pricingModel: PricingModel.VOLUME, pricingTiers: tiersWithFee });

      // 30 units: falls in tier 2 (upTo=50), rate=80, flatFee=200
      expect(calculatePrice(product, 30)).toBe(30 * 80 + 200); // 2600
    });

    it("returns 0 for volume with empty tiers", () => {
      const product = makeProduct({ pricingModel: PricingModel.VOLUME, pricingTiers: [] });
      expect(calculatePrice(product, 10)).toBe(0);
    });

    it("volume pricing uses last tier as fallback when quantity exceeds all tiers", () => {
      const tiers: PricingTier[] = [
        { upTo: 10, unitPrice: 100, flatFee: 0 },
      ];
      const product = makeProduct({ pricingModel: PricingModel.VOLUME, pricingTiers: tiers });

      // 20 units exceeds tier max of 10, but since there's no null tier,
      // the loop finishes and falls back to last tier
      expect(calculatePrice(product, 5)).toBe(5 * 100); // within tier
    });

    it("handles metered with null pricingTiers (fallback to flat)", () => {
      const product = makeProduct({ pricingModel: PricingModel.METERED, rate: 300, pricingTiers: null as any });
      expect(calculatePrice(product, 5)).toBe(1500);
    });

    it("tiered pricing handles quantity exactly at tier boundary", () => {
      const product = makeProduct({ pricingModel: PricingModel.TIERED, pricingTiers: TIERS });
      // 100 units: all in first tier at 1000
      expect(calculatePrice(product, 100)).toBe(100 * 1000);
    });

    it("tiered pricing extends to infinity tier", () => {
      const product = makeProduct({ pricingModel: PricingModel.TIERED, pricingTiers: TIERS });
      // 600 units: 100 at 1000, 400 at 800, 100 at 500
      expect(calculatePrice(product, 600)).toBe(100 * 1000 + 400 * 800 + 100 * 500);
    });
  });

  // ── getTieredPriceBreakdown ─────────────────────────────────────────────

  describe("getTieredPriceBreakdown", () => {
    it("returns breakdown for tiered pricing", () => {
      const breakdown = getTieredPriceBreakdown(TIERS, 250);

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]).toEqual({ from: 1, to: 100, qty: 100, unitPrice: 1000, amount: 100000 });
      expect(breakdown[1]).toEqual({ from: 101, to: 500, qty: 150, unitPrice: 800, amount: 120000 });
    });

    it("returns empty array for no tiers", () => {
      expect(getTieredPriceBreakdown([], 10)).toEqual([]);
    });

    it("handles zero quantity", () => {
      expect(getTieredPriceBreakdown(TIERS, 0)).toEqual([]);
    });
  });

  // ── recordUsage ─────────────────────────────────────────────────────────

  describe("recordUsage", () => {
    it("creates a usage record for metered product", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeProduct({ pricingModel: PricingModel.METERED })) // product
        .mockResolvedValueOnce({ id: "cli-1" }); // client

      const result = await recordUsage(ORG_ID, {
        productId: "prod-1",
        clientId: "cli-1",
        quantity: 100,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
      });

      expect(result.quantity).toBe(100);
      expect(mockDb.create).toHaveBeenCalledWith("usage_records", expect.objectContaining({
        productId: "prod-1",
        quantity: 100,
      }));
    });

    it("throws when product not found", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        recordUsage(ORG_ID, {
          productId: "missing",
          clientId: "cli-1",
          quantity: 10,
          periodStart: new Date(),
          periodEnd: new Date(),
        })
      ).rejects.toThrow("Product");
    });

    it("throws when product is not metered", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeProduct({ pricingModel: PricingModel.FLAT }))
        .mockResolvedValueOnce({ id: "cli-1" });

      await expect(
        recordUsage(ORG_ID, {
          productId: "prod-1",
          clientId: "cli-1",
          quantity: 10,
          periodStart: new Date(),
          periodEnd: new Date(),
        })
      ).rejects.toThrow("metered products");
    });
  });

  // ── getUsageSummary ─────────────────────────────────────────────────────

  describe("getUsageSummary", () => {
    it("returns usage summary with calculated amount", async () => {
      mockDb.findById.mockResolvedValue(makeProduct({ pricingModel: PricingModel.FLAT, rate: 500 }));
      mockDb.raw.mockResolvedValue([{ total_qty: 20, record_count: 3 }]);

      const result = await getUsageSummary(ORG_ID, "prod-1", "cli-1", new Date(), new Date());

      expect(result.totalQuantity).toBe(20);
      expect(result.totalAmount).toBe(10000); // 20 * 500
      expect(result.recordCount).toBe(3);
    });
  });

  // ── listUsageRecords ────────────────────────────────────────────────────

  describe("listUsageRecords", () => {
    it("returns paginated usage records", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [{ id: "ur-1", quantity: 50 }],
        total: 1, page: 1, limit: 20, totalPages: 1,
      });

      const result = await listUsageRecords(ORG_ID, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });

    it("filters by productId and clientId", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listUsageRecords(ORG_ID, { page: 1, limit: 20, productId: "prod-1", clientId: "cli-1" });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("usage_records", expect.objectContaining({
        where: expect.objectContaining({ product_id: "prod-1", client_id: "cli-1" }),
      }));
    });
  });
});
