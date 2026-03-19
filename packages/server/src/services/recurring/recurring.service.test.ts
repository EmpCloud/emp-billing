import { describe, it, expect, vi, beforeEach } from "vitest";
import dayjs from "dayjs";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "rec-uuid-001"),
}));

import { getDB } from "../../db/adapters/index";
import {
  computeNextDate,
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  pauseProfile,
  resumeProfile,
  getExecutions,
} from "./recurring.service";
import { RecurringFrequency, RecurringStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

const ORG_ID = "org-001";
const USER_ID = "user-001";
const BASE_DATE = "2026-01-15";

describe("RecurringService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── computeNextDate ────────────────────────────────────────────────────

  describe("computeNextDate", () => {
    it("adds 1 day for DAILY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.DAILY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-01-16");
    });

    it("adds 1 week for WEEKLY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.WEEKLY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-01-22");
    });

    it("adds 1 month for MONTHLY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.MONTHLY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-02-15");
    });

    it("adds 3 months for QUARTERLY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.QUARTERLY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-04-15");
    });

    it("adds 6 months for HALF_YEARLY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.HALF_YEARLY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-07-15");
    });

    it("adds 1 year for YEARLY frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.YEARLY);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2027-01-15");
    });

    it("adds custom number of days for CUSTOM frequency", () => {
      const result = computeNextDate(BASE_DATE, RecurringFrequency.CUSTOM, 10);
      expect(dayjs(result).format("YYYY-MM-DD")).toBe("2026-01-25");
    });

    it("throws when CUSTOM frequency has no customDays", () => {
      expect(() => computeNextDate(BASE_DATE, RecurringFrequency.CUSTOM)).toThrow(
        "customDays is required for custom frequency"
      );
    });

    it("throws when CUSTOM frequency has zero customDays", () => {
      expect(() => computeNextDate(BASE_DATE, RecurringFrequency.CUSTOM, 0)).toThrow(
        "customDays is required for custom frequency"
      );
    });
  });

  // ── listProfiles ───────────────────────────────────────────────────────

  describe("listProfiles", () => {
    it("returns paginated profiles", async () => {
      const profiles = [
        { id: "rp1", frequency: "monthly", status: "active" },
        { id: "rp2", frequency: "weekly", status: "paused" },
      ];
      mockDb.findPaginated.mockResolvedValue({
        data: profiles,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listProfiles(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("recurring_profiles", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
      });
    });

    it("applies status filter", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await listProfiles(ORG_ID, { status: "active" });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("recurring_profiles", {
        where: { org_id: ORG_ID, status: "active" },
        page: 1,
        limit: 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
      });
    });
  });

  // ── createProfile ──────────────────────────────────────────────────────

  describe("createProfile", () => {
    it("creates a profile with computed nextExecutionDate", async () => {
      const input = {
        clientId: "client-001",
        type: "invoice",
        frequency: RecurringFrequency.MONTHLY,
        startDate: "2026-03-01",
        templateData: { items: [{ name: "Retainer", rate: 500000 }] },
      };

      mockDb.findById
        .mockResolvedValueOnce({ id: "client-001" }) // client exists
        .mockResolvedValueOnce({ // getProfile call after create
          id: "rec-uuid-001",
          orgId: ORG_ID,
          ...input,
          status: RecurringStatus.ACTIVE,
          nextExecutionDate: computeNextDate(input.startDate, input.frequency),
          occurrenceCount: 0,
        });
      mockDb.create.mockResolvedValue(undefined);

      const result = await createProfile(ORG_ID, USER_ID, input);

      expect(result.status).toBe(RecurringStatus.ACTIVE);
      expect(mockDb.create).toHaveBeenCalledWith(
        "recurring_profiles",
        expect.objectContaining({
          id: "rec-uuid-001",
          orgId: ORG_ID,
          clientId: "client-001",
          frequency: RecurringFrequency.MONTHLY,
          status: RecurringStatus.ACTIVE,
          occurrenceCount: 0,
        })
      );
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        createProfile(ORG_ID, USER_ID, {
          clientId: "nonexistent",
          type: "invoice",
          frequency: RecurringFrequency.MONTHLY,
          startDate: "2026-03-01",
          templateData: {},
        })
      ).rejects.toThrow("Client not found");
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("recomputes nextExecutionDate when frequency changes", async () => {
      const existing = {
        id: "rp1",
        orgId: ORG_ID,
        frequency: RecurringFrequency.MONTHLY,
        startDate: "2026-03-01",
        customDays: null,
        status: RecurringStatus.ACTIVE,
      };
      mockDb.findById
        .mockResolvedValueOnce(existing) // existing lookup
        .mockResolvedValueOnce({ ...existing, frequency: RecurringFrequency.WEEKLY }); // getProfile after update
      mockDb.update.mockResolvedValue(undefined);

      const result = await updateProfile(ORG_ID, "rp1", {
        frequency: RecurringFrequency.WEEKLY,
      });

      expect(mockDb.update).toHaveBeenCalledWith(
        "recurring_profiles",
        "rp1",
        expect.objectContaining({
          frequency: RecurringFrequency.WEEKLY,
          nextExecutionDate: expect.any(Date),
        }),
        ORG_ID
      );
    });

    it("throws NotFoundError when profile does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateProfile(ORG_ID, "missing", { type: "invoice" })).rejects.toThrow(
        "RecurringProfile not found"
      );
    });
  });

  // ── pauseProfile ───────────────────────────────────────────────────────

  describe("pauseProfile", () => {
    it("sets status to PAUSED for an active profile", async () => {
      const profile = { id: "rp1", status: RecurringStatus.ACTIVE };
      mockDb.findById
        .mockResolvedValueOnce(profile) // existing
        .mockResolvedValueOnce({ ...profile, status: RecurringStatus.PAUSED }); // after update
      mockDb.update.mockResolvedValue(undefined);

      const result = await pauseProfile(ORG_ID, "rp1");

      expect(mockDb.update).toHaveBeenCalledWith(
        "recurring_profiles",
        "rp1",
        expect.objectContaining({ status: RecurringStatus.PAUSED }),
        ORG_ID
      );
    });

    it("throws BadRequestError when profile is not active", async () => {
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.PAUSED });

      await expect(pauseProfile(ORG_ID, "rp1")).rejects.toThrow(
        "Only active profiles can be paused"
      );
    });
  });

  // ── resumeProfile ──────────────────────────────────────────────────────

  describe("resumeProfile", () => {
    it("sets status to ACTIVE and recomputes nextExecutionDate", async () => {
      const profile = {
        id: "rp1",
        status: RecurringStatus.PAUSED,
        frequency: RecurringFrequency.WEEKLY,
        customDays: null,
      };
      mockDb.findById
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce({ ...profile, status: RecurringStatus.ACTIVE });
      mockDb.update.mockResolvedValue(undefined);

      const result = await resumeProfile(ORG_ID, "rp1");

      expect(mockDb.update).toHaveBeenCalledWith(
        "recurring_profiles",
        "rp1",
        expect.objectContaining({
          status: RecurringStatus.ACTIVE,
          nextExecutionDate: expect.any(Date),
        }),
        ORG_ID
      );
    });

    it("throws BadRequestError when profile is not paused", async () => {
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.ACTIVE });

      await expect(resumeProfile(ORG_ID, "rp1")).rejects.toThrow(
        "Only paused profiles can be resumed"
      );
    });
  });

  // ── deleteProfile ──────────────────────────────────────────────────────

  describe("deleteProfile", () => {
    it("deletes an active profile", async () => {
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.ACTIVE });

      await deleteProfile(ORG_ID, "rp1");

      expect(mockDb.delete).toHaveBeenCalledWith("recurring_profiles", "rp1", ORG_ID);
    });

    it("deletes a paused profile", async () => {
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.PAUSED });

      await deleteProfile(ORG_ID, "rp1");

      expect(mockDb.delete).toHaveBeenCalledWith("recurring_profiles", "rp1", ORG_ID);
    });

    it("throws BadRequestError for completed profile", async () => {
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.COMPLETED });

      await expect(deleteProfile(ORG_ID, "rp1")).rejects.toThrow(
        "Only active or paused profiles can be deleted"
      );
    });

    it("throws NotFoundError when profile does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteProfile(ORG_ID, "missing")).rejects.toThrow(
        "RecurringProfile not found"
      );
    });
  });

  // ── getExecutions ──────────────────────────────────────────────────────

  describe("getExecutions", () => {
    it("returns execution history for a profile", async () => {
      const executions = [
        { id: "ex1", profileId: "rp1", executedAt: "2026-02-01", invoiceId: "inv-001" },
        { id: "ex2", profileId: "rp1", executedAt: "2026-01-01", invoiceId: "inv-002" },
      ];
      mockDb.findById.mockResolvedValue({ id: "rp1", status: RecurringStatus.ACTIVE });
      mockDb.findMany.mockResolvedValue(executions);

      const result = await getExecutions(ORG_ID, "rp1");

      expect(result).toHaveLength(2);
      expect(mockDb.findMany).toHaveBeenCalledWith("recurring_executions", {
        where: { profile_id: "rp1", org_id: ORG_ID },
        orderBy: [{ column: "executed_at", direction: "desc" }],
      });
    });

    it("throws NotFoundError when profile does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getExecutions(ORG_ID, "missing")).rejects.toThrow(
        "RecurringProfile not found"
      );
    });
  });
});
