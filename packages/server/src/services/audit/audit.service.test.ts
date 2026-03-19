import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import { listAuditLogs } from "./audit.service";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findPaginated: vi.fn(),
  };
}

describe("audit.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("listAuditLogs", () => {
    it("returns paginated audit logs", async () => {
      const logs = [
        { id: "al-1", orgId: ORG_ID, action: "invoice.created", entityType: "invoice", entityId: "inv-1", createdAt: new Date() },
      ];
      mockDb.findPaginated.mockResolvedValue({ data: logs, total: 1, page: 1, limit: 20, totalPages: 1 });

      const result = await listAuditLogs(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("audit_logs", expect.objectContaining({
        where: { org_id: ORG_ID },
      }));
    });

    it("applies entityType filter", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listAuditLogs(ORG_ID, { page: 1, limit: 20, entityType: "invoice" });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("audit_logs", expect.objectContaining({
        where: { org_id: ORG_ID, entity_type: "invoice" },
      }));
    });

    it("applies userId filter", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listAuditLogs(ORG_ID, { page: 1, limit: 20, userId: "usr-1" });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("audit_logs", expect.objectContaining({
        where: { org_id: ORG_ID, user_id: "usr-1" },
      }));
    });

    it("filters by date range (from/to)", async () => {
      const now = new Date("2026-03-15T12:00:00Z");
      const logs = [
        { id: "al-1", createdAt: new Date("2026-03-10T12:00:00Z") },
        { id: "al-2", createdAt: new Date("2026-03-20T12:00:00Z") },
        { id: "al-3", createdAt: new Date("2026-03-12T12:00:00Z") },
      ];
      mockDb.findPaginated.mockResolvedValue({ data: logs, total: 3, page: 1, limit: 20, totalPages: 1 });

      const result = await listAuditLogs(ORG_ID, {
        page: 1,
        limit: 20,
        from: new Date("2026-03-11T00:00:00Z"),
        to: new Date("2026-03-16T00:00:00Z"),
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("al-3");
    });

    it("returns all logs when no date range specified", async () => {
      const logs = [
        { id: "al-1", createdAt: new Date() },
        { id: "al-2", createdAt: new Date() },
      ];
      mockDb.findPaginated.mockResolvedValue({ data: logs, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listAuditLogs(ORG_ID, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
    });
  });
});
