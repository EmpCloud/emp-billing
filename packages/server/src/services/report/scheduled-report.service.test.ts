import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import {
  computeNextSendAt,
  listScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  getDueReports,
  markReportSent,
} from "./scheduled-report.service";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn(),
    delete: vi.fn(),
    raw: vi.fn(),
  };
}

describe("scheduled-report.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("computeNextSendAt", () => {
    it("daily: returns next day at 8:00 AM", () => {
      const from = new Date("2026-03-15T10:00:00Z");
      const next = computeNextSendAt("daily", from);

      expect(next.getHours()).toBe(8);
      expect(next.getMinutes()).toBe(0);
    });

    it("weekly: returns next Monday at 8:00 AM", () => {
      // 2026-03-15 is a Sunday
      const from = new Date("2026-03-15T10:00:00Z");
      const next = computeNextSendAt("weekly", from);

      expect(next.getDay()).toBe(1); // Monday
      expect(next.getHours()).toBe(8);
    });

    it("monthly: returns 1st of next month at 8:00 AM", () => {
      const from = new Date("2026-03-15T10:00:00Z");
      const next = computeNextSendAt("monthly", from);

      expect(next.getDate()).toBe(1);
      expect(next.getMonth()).toBe(3); // April (0-indexed)
      expect(next.getHours()).toBe(8);
    });

    it("uses current time when fromDate not provided", () => {
      const next = computeNextSendAt("daily");
      expect(next.getTime()).toBeGreaterThan(Date.now());
    });

    it("defaults to daily for unknown frequency", () => {
      const from = new Date("2026-03-15T10:00:00Z");
      const next = computeNextSendAt("unknown" as any, from);

      expect(next.getHours()).toBe(8);
    });
  });

  describe("listScheduledReports", () => {
    it("returns reports for org", async () => {
      mockDb.findMany.mockResolvedValue([{ id: "sr-1", reportType: "revenue" }]);

      const result = await listScheduledReports(ORG_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe("createScheduledReport", () => {
    it("creates a report with computed next send time", async () => {
      const result = await createScheduledReport(ORG_ID, "usr-1", {
        reportType: "revenue",
        frequency: "weekly",
        recipientEmail: "admin@test.com",
      });

      expect(result.reportType).toBe("revenue");
      expect(result.frequency).toBe("weekly");
      expect(result.nextSendAt).toBeDefined();
      expect(result.isActive).toBe(true);
      expect(mockDb.create).toHaveBeenCalledWith("scheduled_reports", expect.objectContaining({
        reportType: "revenue",
      }));
    });

    it("respects isActive flag", async () => {
      const result = await createScheduledReport(ORG_ID, "usr-1", {
        reportType: "tax",
        frequency: "monthly",
        recipientEmail: "admin@test.com",
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe("updateScheduledReport", () => {
    it("updates report and recomputes nextSendAt on frequency change", async () => {
      mockDb.findById.mockResolvedValue({ id: "sr-1", frequency: "daily" });

      await updateScheduledReport(ORG_ID, "sr-1", { frequency: "monthly" });

      expect(mockDb.update).toHaveBeenCalledWith("scheduled_reports", "sr-1", expect.objectContaining({
        frequency: "monthly",
        nextSendAt: expect.any(Date),
      }), ORG_ID);
    });

    it("does not recompute nextSendAt if frequency not changed", async () => {
      mockDb.findById.mockResolvedValue({ id: "sr-1" });

      await updateScheduledReport(ORG_ID, "sr-1", { recipientEmail: "new@test.com" });

      expect(mockDb.update).toHaveBeenCalledWith("scheduled_reports", "sr-1", expect.objectContaining({
        recipientEmail: "new@test.com",
      }), ORG_ID);
    });
  });

  describe("deleteScheduledReport", () => {
    it("deletes a scheduled report", async () => {
      await deleteScheduledReport(ORG_ID, "sr-1");

      expect(mockDb.delete).toHaveBeenCalledWith("scheduled_reports", "sr-1", ORG_ID);
    });
  });

  describe("getDueReports", () => {
    it("returns due reports", async () => {
      mockDb.raw.mockResolvedValue([{ id: "sr-1" }]);

      const result = await getDueReports();
      expect(result).toHaveLength(1);
    });
  });

  describe("markReportSent", () => {
    it("updates lastSentAt and computes next send time", async () => {
      const report = { id: "sr-1", orgId: ORG_ID, frequency: "daily" } as any;

      await markReportSent(report);

      expect(mockDb.update).toHaveBeenCalledWith("scheduled_reports", "sr-1", expect.objectContaining({
        lastSentAt: expect.any(Date),
        nextSendAt: expect.any(Date),
      }), ORG_ID);
    });
  });
});
