import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import {
  getMRR,
  getARR,
  getChurnMetrics,
  getLTV,
  getSubscriptionStats,
  getRevenueBreakdown,
  getCohortAnalysis,
} from "./metrics.service";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return { raw: vi.fn() };
}

describe("metrics.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("getMRR", () => {
    it("computes MRR from active subscriptions", async () => {
      // Current MRR
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
        { price: 60000, billing_interval: "annual", quantity: 2 },
      ]);
      // Last month MRR
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
      ]);

      const result = await getMRR(ORG_ID);

      // 10000*1 + (60000/12)*2 = 10000 + 10000 = 20000
      expect(result.mrr).toBe(20000);
      // Growth: ((20000-10000)/10000)*100 = 100%
      expect(result.mrrGrowth).toBe(100);
    });

    it("returns zero growth when no last month data", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ price: 5000, billing_interval: "monthly", quantity: 1 }])
        .mockResolvedValueOnce([]);

      const result = await getMRR(ORG_ID);
      expect(result.mrr).toBe(5000);
      expect(result.mrrGrowth).toBe(0);
    });

    it("returns zero when no active subscriptions", async () => {
      mockDb.raw.mockResolvedValue([]);

      const result = await getMRR(ORG_ID);
      expect(result.mrr).toBe(0);
    });

    it("normalizes quarterly and semi_annual billing intervals", async () => {
      mockDb.raw
        .mockResolvedValueOnce([
          { price: 30000, billing_interval: "quarterly", quantity: 1 },
          { price: 60000, billing_interval: "semi_annual", quantity: 1 },
        ])
        .mockResolvedValueOnce([]);

      const result = await getMRR(ORG_ID);

      // quarterly: 30000/3 = 10000, semi_annual: 60000/6 = 10000
      expect(result.mrr).toBe(20000);
    });

    it("handles unknown billing interval as monthly", async () => {
      mockDb.raw
        .mockResolvedValueOnce([
          { price: 5000, billing_interval: "custom", quantity: 1 },
        ])
        .mockResolvedValueOnce([]);

      const result = await getMRR(ORG_ID);
      expect(result.mrr).toBe(5000);
    });
  });

  describe("getARR", () => {
    it("returns MRR * 12", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ price: 10000, billing_interval: "monthly", quantity: 1 }])
        .mockResolvedValueOnce([]);

      const result = await getARR(ORG_ID);
      expect(result.arr).toBe(120000);
    });
  });

  describe("getChurnMetrics", () => {
    it("computes customer and revenue churn", async () => {
      // activeAtStart
      mockDb.raw.mockResolvedValueOnce([{ count: 100 }]);
      // cancelledDuringPeriod
      mockDb.raw.mockResolvedValueOnce([{ count: 5 }]);
      // MRR at start
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
      ]);
      // Churned MRR
      mockDb.raw.mockResolvedValueOnce([
        { price: 2000, billing_interval: "monthly", quantity: 1 },
      ]);
      // MRR at end
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
      ]);

      const result = await getChurnMetrics(ORG_ID, { from: "2026-01-01", to: "2026-01-31" });

      expect(result.customerChurn).toBe(5); // 5/100 * 100
      expect(result.revenueChurn).toBe(20); // 2000/10000 * 100
      expect(result.netRevenueRetention).toBe(100); // 10000/10000 * 100
    });

    it("returns zero churn when no active at start", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getChurnMetrics(ORG_ID, { from: "2026-01-01", to: "2026-01-31" });
      expect(result.customerChurn).toBe(0);
      expect(result.netRevenueRetention).toBe(100);
    });
  });

  describe("getLTV", () => {
    it("computes LTV from ARPC and churn", async () => {
      // active subscriptions
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
        { price: 20000, billing_interval: "monthly", quantity: 1 },
      ]);
      // avg duration
      mockDb.raw.mockResolvedValueOnce([{ avg_months: 12 }]);
      // cancelled last 3 months
      mockDb.raw.mockResolvedValueOnce([{ count: 3 }]);
      // total
      mockDb.raw.mockResolvedValueOnce([{ count: 30 }]);

      const result = await getLTV(ORG_ID);

      expect(result.averageSubscriptionDurationMonths).toBe(12);
      expect(result.ltv).toBeGreaterThan(0);
    });

    it("uses fallback when no churn", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ price: 5000, billing_interval: "monthly", quantity: 1 }])
        .mockResolvedValueOnce([{ avg_months: 6 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await getLTV(ORG_ID);
      // Fallback: ARPC * 24
      expect(result.ltv).toBe(5000 * 24);
    });
  });

  describe("getSubscriptionStats", () => {
    it("computes subscription statistics", async () => {
      // statusCounts
      mockDb.raw.mockResolvedValueOnce([
        { status: "active", count: 50 },
        { status: "trialing", count: 10 },
        { status: "cancelled", count: 5 },
      ]);
      // trial_started events
      mockDb.raw.mockResolvedValueOnce([{ count: 20 }]);
      // activated events
      mockDb.raw.mockResolvedValueOnce([{ count: 15 }]);
      // active subs for ARPS
      mockDb.raw.mockResolvedValueOnce([
        { price: 10000, billing_interval: "monthly", quantity: 1 },
      ]);

      const result = await getSubscriptionStats(ORG_ID);

      expect(result.totalActive).toBe(50);
      expect(result.totalTrialing).toBe(10);
      expect(result.totalCancelled).toBe(5);
      expect(result.conversionRate).toBe(75); // 15/20*100
    });
  });

  describe("getRevenueBreakdown", () => {
    it("returns monthly breakdown", async () => {
      // For each month: new, expansion, contraction, churn
      mockDb.raw.mockResolvedValue([]);

      const result = await getRevenueBreakdown(ORG_ID, 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("month");
      expect(result[0]).toHaveProperty("newMRR");
      expect(result[0]).toHaveProperty("netNewMRR");
    });
  });

  describe("getCohortAnalysis", () => {
    it("returns cohort data", async () => {
      mockDb.raw.mockResolvedValue([{ count: 0 }]);

      const result = await getCohortAnalysis(ORG_ID, 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("cohortMonth");
      expect(result[0]).toHaveProperty("totalSubscriptions");
      expect(result[0]).toHaveProperty("retentionByMonth");
    });
  });
});
