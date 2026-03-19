import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../events/index", () => ({ emit: vi.fn() }));
vi.mock("../../jobs/queue", () => ({ emailQueue: { add: vi.fn() } }));
vi.mock("../../utils/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("../payment/gateways/index", () => ({ getGateway: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import {
  getDunningConfig,
  updateDunningConfig,
  createDunningAttempt,
  listDunningAttempts,
  processDunningAttempt,
  getDunningSummary,
} from "./dunning.service";
import { DunningAttemptStatus, InvoiceStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findMany: vi.fn(),
    findById: vi.fn(),
    findPaginated: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn().mockImplementation((_t: string, _id: string, data: Record<string, unknown>) => data),
    raw: vi.fn(),
    count: vi.fn(),
    increment: vi.fn(),
  };
}

describe("dunning.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("getDunningConfig", () => {
    it("returns stored config", async () => {
      const cfg = {
        id: "dc-1",
        orgId: ORG_ID,
        maxRetries: 3,
        retrySchedule: [1, 3, 5],
        gracePeriodDays: 2,
        cancelAfterAllRetries: true,
        sendReminderEmails: true,
      };
      mockDb.findMany.mockResolvedValue([cfg]);

      const result = await getDunningConfig(ORG_ID);
      expect(result.maxRetries).toBe(3);
    });

    it("parses retrySchedule from string", async () => {
      mockDb.findMany.mockResolvedValue([{
        id: "dc-1",
        orgId: ORG_ID,
        maxRetries: 4,
        retrySchedule: "[1,2,3]",
        gracePeriodDays: 3,
        cancelAfterAllRetries: true,
        sendReminderEmails: true,
      }]);

      const result = await getDunningConfig(ORG_ID);
      expect(result.retrySchedule).toEqual([1, 2, 3]);
    });

    it("returns defaults when no config exists", async () => {
      mockDb.findMany.mockResolvedValue([]);

      const result = await getDunningConfig(ORG_ID);
      expect(result.maxRetries).toBe(4);
      expect(result.retrySchedule).toEqual([1, 3, 5, 7]);
    });
  });

  describe("updateDunningConfig", () => {
    it("updates existing config", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([{ id: "dc-1", orgId: ORG_ID }]) // existing check
        .mockResolvedValueOnce([{ id: "dc-1", orgId: ORG_ID, maxRetries: 5, retrySchedule: [2, 4], gracePeriodDays: 3, cancelAfterAllRetries: true, sendReminderEmails: true }]); // getDunningConfig call

      const result = await updateDunningConfig(ORG_ID, { maxRetries: 5, retrySchedule: [2, 4] });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("creates new config when none exists", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([{ id: "dc-new", orgId: ORG_ID, maxRetries: 3, retrySchedule: [1], gracePeriodDays: 5, cancelAfterAllRetries: false, sendReminderEmails: true }]);

      const result = await updateDunningConfig(ORG_ID, { maxRetries: 3, retrySchedule: [1], gracePeriodDays: 5 });
      expect(mockDb.create).toHaveBeenCalledWith("dunning_configs", expect.objectContaining({ maxRetries: 3 }));
    });
  });

  describe("createDunningAttempt", () => {
    it("creates a pending attempt", async () => {
      mockDb.findMany.mockResolvedValue([]); // default config

      const result = await createDunningAttempt(ORG_ID, "inv-1");

      expect(result.status).toBe(DunningAttemptStatus.PENDING);
      expect(result.attemptNumber).toBe(1);
      expect(result.invoiceId).toBe("inv-1");
    });

    it("includes subscriptionId when provided", async () => {
      mockDb.findMany.mockResolvedValue([]);

      const result = await createDunningAttempt(ORG_ID, "inv-1", "sub-1");
      expect(result.subscriptionId).toBe("sub-1");
    });
  });

  describe("listDunningAttempts", () => {
    it("returns paginated results", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [{ id: "da-1" }], total: 1, page: 1, limit: 20, totalPages: 1 });

      const result = await listDunningAttempts(ORG_ID, {});
      expect(result.data).toHaveLength(1);
    });

    it("filters by status", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listDunningAttempts(ORG_ID, { status: DunningAttemptStatus.PENDING });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("dunning_attempts", expect.objectContaining({
        where: expect.objectContaining({ status: DunningAttemptStatus.PENDING }),
      }));
    });
  });

  describe("processDunningAttempt", () => {
    it("throws when attempt not found", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(processDunningAttempt("missing")).rejects.toThrow("Dunning attempt");
    });

    it("marks success when invoice already paid", async () => {
      mockDb.findById.mockResolvedValueOnce({
        id: "da-1",
        orgId: ORG_ID,
        invoiceId: "inv-1",
        attemptNumber: 1,
      });
      mockDb.findMany.mockResolvedValue([]); // default config
      mockDb.findById.mockResolvedValueOnce({
        id: "inv-1",
        orgId: ORG_ID,
        clientId: "cli-1",
        status: InvoiceStatus.PAID,
        amountDue: 0,
      });

      await processDunningAttempt("da-1");

      expect(mockDb.update).toHaveBeenCalledWith("dunning_attempts", "da-1", expect.objectContaining({
        status: DunningAttemptStatus.SUCCESS,
      }), ORG_ID);
    });

    it("skips when invoice not found", async () => {
      mockDb.findById.mockResolvedValueOnce({
        id: "da-1",
        orgId: ORG_ID,
        invoiceId: "inv-missing",
        attemptNumber: 1,
      });
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findById.mockResolvedValueOnce(null); // invoice not found

      await processDunningAttempt("da-1");

      expect(mockDb.update).toHaveBeenCalledWith("dunning_attempts", "da-1", expect.objectContaining({
        status: DunningAttemptStatus.SKIPPED,
      }), ORG_ID);
    });
  });

  describe("getDunningSummary", () => {
    it("returns summary stats", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ count: 5 }])  // pending
        .mockResolvedValueOnce([{ count: 3 }])  // failed
        .mockResolvedValueOnce([{ total: 50000 }]); // recovered

      const result = await getDunningSummary(ORG_ID);

      expect(result.totalPending).toBe(5);
      expect(result.failedThisMonth).toBe(3);
      expect(result.recoveredAmount).toBe(50000);
    });

    it("handles null counts gracefully", async () => {
      mockDb.raw
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ total: null }]);

      const result = await getDunningSummary(ORG_ID);

      expect(result.totalPending).toBe(0);
      expect(result.failedThisMonth).toBe(0);
      expect(result.recoveredAmount).toBe(0);
    });
  });
});
