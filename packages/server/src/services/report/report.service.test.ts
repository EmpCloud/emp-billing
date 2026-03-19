import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

import { getDB } from "../../db/adapters/index";
import {
  getDashboardStats,
  getRevenueReport,
  getReceivablesReport,
  getExpenseReport,
  getProfitLossReport,
  getTaxReport,
} from "./report.service";
import { InvoiceStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    raw: vi.fn(),
  };
}

const ORG_ID = "org-001";

describe("ReportService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── getDashboardStats ──────────────────────────────────────────────────

  describe("getDashboardStats", () => {
    it("returns aggregated summary stats", async () => {
      // Setup the 7 sequential raw() calls the service makes
      mockDb.raw
        // 1. status counts
        .mockResolvedValueOnce([
          { status: "paid", count: 15 },
          { status: "sent", count: 8 },
          { status: "overdue", count: 3 },
          { status: "draft", count: 5 },
        ])
        // 2. total revenue (paid invoices)
        .mockResolvedValueOnce([{ total: 75000000 }]) // 7,50,000.00 in paise
        // 3. total outstanding
        .mockResolvedValueOnce([{ total: 15000000 }])
        // 4. total overdue
        .mockResolvedValueOnce([{ total: 5000000 }])
        // 5. total expenses
        .mockResolvedValueOnce([{ total: 20000000 }])
        // 6. recent invoices
        .mockResolvedValueOnce([
          { id: "inv-1", invoiceNumber: "INV-2026-0001", total: 500000 },
        ])
        // 7. recent payments
        .mockResolvedValueOnce([
          { id: "pay-1", amount: 500000, date: "2026-01-15" },
        ])
        // 8. aging buckets
        .mockResolvedValueOnce([
          { bucket: "current", total: 5000000 },
          { bucket: "1-30", total: 3000000 },
          { bucket: "31-60", total: 2000000 },
          { bucket: "61-90", total: 1000000 },
          { bucket: "90+", total: 4000000 },
        ]);

      const result = await getDashboardStats(ORG_ID);

      expect(result.data.invoiceCounts).toEqual({
        paid: 15,
        sent: 8,
        overdue: 3,
        draft: 5,
      });
      expect(result.data.totalRevenue).toBe(75000000);
      expect(result.data.totalOutstanding).toBe(15000000);
      expect(result.data.totalOverdue).toBe(5000000);
      expect(result.data.totalExpenses).toBe(20000000);
      expect(result.data.recentInvoices).toHaveLength(1);
      expect(result.data.recentPayments).toHaveLength(1);
      expect(result.data.receivablesAging).toEqual({
        current: 5000000,
        days1to30: 3000000,
        days31to60: 2000000,
        days61to90: 1000000,
        days90plus: 4000000,
      });
    });

    it("handles zero totals when no data exists", async () => {
      mockDb.raw
        .mockResolvedValueOnce([]) // no status counts
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]) // no recent invoices
        .mockResolvedValueOnce([]) // no recent payments
        .mockResolvedValueOnce([]); // no aging

      const result = await getDashboardStats(ORG_ID);

      expect(result.data.totalRevenue).toBe(0);
      expect(result.data.totalOutstanding).toBe(0);
      expect(result.data.totalOverdue).toBe(0);
      expect(result.data.totalExpenses).toBe(0);
      expect(result.data.receivablesAging).toEqual({
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
      });
    });
  });

  // ── getRevenueReport ───────────────────────────────────────────────────

  describe("getRevenueReport", () => {
    it("aggregates revenue by month", async () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-03-31");
      mockDb.raw.mockResolvedValue([
        { month: "2026-01", revenue: 25000000 },
        { month: "2026-02", revenue: 30000000 },
        { month: "2026-03", revenue: 20000000 },
      ]);

      const result = await getRevenueReport(ORG_ID, from, to);

      expect(result.data).toEqual([
        { month: "2026-01", revenue: 25000000 },
        { month: "2026-02", revenue: 30000000 },
        { month: "2026-03", revenue: 20000000 },
      ]);
      expect(mockDb.raw).toHaveBeenCalledWith(
        expect.stringContaining("DATE_FORMAT"),
        [ORG_ID, InvoiceStatus.PAID, from, to]
      );
    });

    it("returns empty array when no revenue in period", async () => {
      mockDb.raw.mockResolvedValue([]);

      const result = await getRevenueReport(
        ORG_ID,
        new Date("2025-01-01"),
        new Date("2025-03-31")
      );

      expect(result.data).toEqual([]);
    });
  });

  // ── getReceivablesReport ───────────────────────────────────────────────

  describe("getReceivablesReport", () => {
    it("computes outstanding by client", async () => {
      mockDb.raw.mockResolvedValue([
        { client_id: "c1", client_name: "Acme Corp", total_outstanding: 10000000, invoice_count: 5 },
        { client_id: "c2", client_name: "Beta LLC", total_outstanding: 5000000, invoice_count: 2 },
      ]);

      const result = await getReceivablesReport(ORG_ID);

      expect(result.data).toEqual([
        { clientId: "c1", clientName: "Acme Corp", totalOutstanding: 10000000, invoiceCount: 5 },
        { clientId: "c2", clientName: "Beta LLC", totalOutstanding: 5000000, invoiceCount: 2 },
      ]);
      expect(mockDb.raw).toHaveBeenCalledWith(
        expect.stringContaining("amount_due"),
        [ORG_ID, InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF]
      );
    });
  });

  // ── getExpenseReport ───────────────────────────────────────────────────

  describe("getExpenseReport", () => {
    it("groups expenses by category", async () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-03-31");
      mockDb.raw.mockResolvedValue([
        { category_id: "cat1", category_name: "Travel", total: 8000000, count: 12 },
        { category_id: "cat2", category_name: "Software", total: 3000000, count: 4 },
        { category_id: "cat3", category_name: "Office Supplies", total: 1500000, count: 8 },
      ]);

      const result = await getExpenseReport(ORG_ID, from, to);

      expect(result.data).toEqual([
        { categoryId: "cat1", categoryName: "Travel", total: 8000000, count: 12 },
        { categoryId: "cat2", categoryName: "Software", total: 3000000, count: 4 },
        { categoryId: "cat3", categoryName: "Office Supplies", total: 1500000, count: 8 },
      ]);
      expect(mockDb.raw).toHaveBeenCalledWith(
        expect.stringContaining("expense_categories"),
        [ORG_ID, from, to]
      );
    });
  });

  // ── getTaxReport ───────────────────────────────────────────────────────

  describe("getTaxReport", () => {
    it("computes CGST/SGST breakdown for GST type", async () => {
      mockDb.raw.mockResolvedValue([
        {
          tax_rate_id: "tr1",
          tax_rate: 1800,
          tax_rate_name: "GST 18%",
          tax_rate_type: "gst",
          tax_components: null,
          taxable_amount: 50000000,
          tax_amount: 9000000,
          invoice_count: 20,
        },
      ]);

      const result = await getTaxReport(ORG_ID, new Date("2026-01-01"), new Date("2026-03-31"));

      expect(result.data).toHaveLength(1);
      const gstRow = result.data[0];
      expect(gstRow.taxRateType).toBe("gst");
      expect(gstRow.totalTax).toBe(9000000);
      // GST splits evenly into CGST and SGST
      expect(gstRow.cgst).toBe(4500000);
      expect(gstRow.sgst).toBe(4500000);
      expect(gstRow.igst).toBe(0);
    });

    it("computes full IGST for igst type", async () => {
      mockDb.raw.mockResolvedValue([
        {
          tax_rate_id: "tr2",
          tax_rate: 1800,
          tax_rate_name: "IGST 18%",
          tax_rate_type: "igst",
          tax_components: null,
          taxable_amount: 30000000,
          tax_amount: 5400000,
          invoice_count: 10,
        },
      ]);

      const result = await getTaxReport(ORG_ID);

      const igstRow = result.data[0];
      expect(igstRow.igst).toBe(5400000);
      expect(igstRow.cgst).toBe(0);
      expect(igstRow.sgst).toBe(0);
    });

    it("sets cgst/sgst/igst to 0 for VAT/custom types", async () => {
      mockDb.raw.mockResolvedValue([
        {
          tax_rate_id: "tr3",
          tax_rate: 2000,
          tax_rate_name: "VAT 20%",
          tax_rate_type: "vat",
          tax_components: null,
          taxable_amount: 10000000,
          tax_amount: 2000000,
          invoice_count: 5,
        },
      ]);

      const result = await getTaxReport(ORG_ID);

      const vatRow = result.data[0];
      expect(vatRow.cgst).toBe(0);
      expect(vatRow.sgst).toBe(0);
      expect(vatRow.igst).toBe(0);
      expect(vatRow.totalTax).toBe(2000000);
    });

    it("handles odd GST amount by rounding CGST and assigning remainder to SGST", async () => {
      mockDb.raw.mockResolvedValue([
        {
          tax_rate_id: "tr4",
          tax_rate: 1800,
          tax_rate_name: "GST 18%",
          tax_rate_type: "gst",
          tax_components: null,
          taxable_amount: 5555500,
          tax_amount: 999999, // odd number
          invoice_count: 1,
        },
      ]);

      const result = await getTaxReport(ORG_ID);

      const row = result.data[0];
      expect(row.cgst + row.sgst).toBe(999999);
      expect(row.cgst).toBe(500000); // Math.round(999999/2)
      expect(row.sgst).toBe(499999); // 999999 - 500000
    });
  });

  // ── getProfitLossReport ────────────────────────────────────────────────

  describe("getProfitLossReport", () => {
    it("computes revenue minus expenses per month", async () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-03-31");

      mockDb.raw
        // revenue rows
        .mockResolvedValueOnce([
          { month: "2026-01", total: 25000000 },
          { month: "2026-02", total: 30000000 },
        ])
        // expense rows
        .mockResolvedValueOnce([
          { month: "2026-01", total: 10000000 },
          { month: "2026-02", total: 12000000 },
          { month: "2026-03", total: 5000000 },
        ]);

      const result = await getProfitLossReport(ORG_ID, from, to);

      expect(result.data).toEqual([
        { month: "2026-01", revenue: 25000000, expenses: 10000000, profit: 15000000 },
        { month: "2026-02", revenue: 30000000, expenses: 12000000, profit: 18000000 },
        { month: "2026-03", revenue: 0, expenses: 5000000, profit: -5000000 },
      ]);
    });

    it("returns empty data when no revenue or expenses", async () => {
      mockDb.raw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProfitLossReport(
        ORG_ID,
        new Date("2025-01-01"),
        new Date("2025-12-31")
      );

      expect(result.data).toEqual([]);
    });

    it("handles months with only revenue and no expenses", async () => {
      mockDb.raw
        .mockResolvedValueOnce([
          { month: "2026-01", total: 10000000 },
        ])
        .mockResolvedValueOnce([]);

      const result = await getProfitLossReport(
        ORG_ID,
        new Date("2026-01-01"),
        new Date("2026-01-31")
      );

      expect(result.data).toEqual([
        { month: "2026-01", revenue: 10000000, expenses: 0, profit: 10000000 },
      ]);
    });
  });
});
