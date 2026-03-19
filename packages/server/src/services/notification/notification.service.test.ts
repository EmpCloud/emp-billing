import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "notif-uuid-001"),
}));

import { getDB } from "../../db/adapters/index";
import {
  createNotification,
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "./notification.service";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
}

const ORG_ID = "org-001";
const USER_ID = "user-001";

describe("NotificationService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── createNotification ─────────────────────────────────────────────────

  describe("createNotification", () => {
    it("inserts a notification with all fields", async () => {
      const input = {
        userId: USER_ID,
        type: "invoice_paid" as const,
        title: "Invoice Paid",
        message: "Invoice INV-2026-0001 has been paid.",
        entityType: "invoice",
        entityId: "inv-001",
      };
      const created = {
        id: "notif-uuid-001",
        orgId: ORG_ID,
        ...input,
        isRead: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };
      mockDb.create.mockResolvedValue(created);

      const result = await createNotification(ORG_ID, input);

      expect(result.id).toBe("notif-uuid-001");
      expect(result.isRead).toBe(false);
      expect(mockDb.create).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          id: "notif-uuid-001",
          orgId: ORG_ID,
          userId: USER_ID,
          type: "invoice_paid",
          title: "Invoice Paid",
          message: "Invoice INV-2026-0001 has been paid.",
          entityType: "invoice",
          entityId: "inv-001",
          isRead: false,
        })
      );
    });

    it("creates notification with null userId for org-wide notifications", async () => {
      const input = {
        type: "invoice_overdue" as const,
        title: "Overdue Alert",
        message: "3 invoices are overdue",
      };
      const created = {
        id: "notif-uuid-001",
        orgId: ORG_ID,
        userId: null,
        ...input,
        entityType: null,
        entityId: null,
        isRead: false,
      };
      mockDb.create.mockResolvedValue(created);

      const result = await createNotification(ORG_ID, input);

      expect(mockDb.create).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: null,
          entityType: null,
          entityId: null,
        })
      );
    });
  });

  // ── listNotifications ──────────────────────────────────────────────────

  describe("listNotifications", () => {
    it("returns paginated notifications merging user-specific and org-wide", async () => {
      const userNotifs = [
        { id: "n1", userId: USER_ID, title: "Personal", isRead: false, createdAt: "2026-03-15T10:00:00Z" },
        { id: "n3", userId: USER_ID, title: "Personal 2", isRead: true, createdAt: "2026-03-13T10:00:00Z" },
      ];
      const orgNotifs = [
        { id: "n2", userId: null, title: "Org-wide", isRead: false, createdAt: "2026-03-14T10:00:00Z" },
      ];
      mockDb.findMany
        .mockResolvedValueOnce(userNotifs)
        .mockResolvedValueOnce(orgNotifs);

      const result = await listNotifications(ORG_ID, USER_ID, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(3);
      // Sorted by createdAt descending
      expect(result.data[0].id).toBe("n1");
      expect(result.data[1].id).toBe("n2");
      expect(result.data[2].id).toBe("n3");
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("applies unread filter when specified", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await listNotifications(ORG_ID, USER_ID, { page: 1, limit: 10, unread: true });

      // Both user-specific and org-wide queries should include is_read: false
      expect(mockDb.findMany).toHaveBeenCalledWith("notifications", {
        where: { org_id: ORG_ID, is_read: false, user_id: USER_ID },
        orderBy: [{ column: "created_at", direction: "desc" }],
        limit: 10,
      });
      expect(mockDb.findMany).toHaveBeenCalledWith("notifications", {
        where: { org_id: ORG_ID, is_read: false, user_id: null },
        orderBy: [{ column: "created_at", direction: "desc" }],
        limit: 10,
      });
    });

    it("paginates correctly for page 2", async () => {
      const allNotifs = Array.from({ length: 6 }, (_, i) => ({
        id: `n${i}`,
        userId: USER_ID,
        title: `Notification ${i}`,
        isRead: false,
        createdAt: new Date(2026, 2, 15, 10 - i).toISOString(),
      }));
      mockDb.findMany
        .mockResolvedValueOnce(allNotifs)
        .mockResolvedValueOnce([]);

      const result = await listNotifications(ORG_ID, USER_ID, { page: 2, limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe("n3");
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  // ── markAsRead ─────────────────────────────────────────────────────────

  describe("markAsRead", () => {
    it("updates is_read to true", async () => {
      const notification = { id: "n1", orgId: ORG_ID, isRead: false, title: "Test" };
      const updated = { ...notification, isRead: true };
      mockDb.findById.mockResolvedValue(notification);
      mockDb.update.mockResolvedValue(updated);

      const result = await markAsRead(ORG_ID, "n1");

      expect(result.isRead).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(
        "notifications",
        "n1",
        expect.objectContaining({ isRead: true }),
        ORG_ID
      );
    });

    it("throws NotFoundError when notification does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(markAsRead(ORG_ID, "missing")).rejects.toThrow("Notification not found");
    });
  });

  // ── markAllAsRead ──────────────────────────────────────────────────────

  describe("markAllAsRead", () => {
    it("bulk updates user-specific and org-wide notifications", async () => {
      mockDb.updateMany.mockResolvedValue(undefined);

      await markAllAsRead(ORG_ID, USER_ID);

      // Should call updateMany twice: once for user-specific, once for org-wide
      expect(mockDb.updateMany).toHaveBeenCalledTimes(2);
      expect(mockDb.updateMany).toHaveBeenCalledWith(
        "notifications",
        { org_id: ORG_ID, user_id: USER_ID, is_read: false },
        expect.objectContaining({ is_read: true })
      );
      expect(mockDb.updateMany).toHaveBeenCalledWith(
        "notifications",
        { org_id: ORG_ID, user_id: null, is_read: false },
        expect.objectContaining({ is_read: true })
      );
    });
  });

  // ── getUnreadCount ─────────────────────────────────────────────────────

  describe("getUnreadCount", () => {
    it("returns sum of user-specific and org-wide unread counts", async () => {
      mockDb.count
        .mockResolvedValueOnce(5)  // user-specific
        .mockResolvedValueOnce(3); // org-wide

      const count = await getUnreadCount(ORG_ID, USER_ID);

      expect(count).toBe(8);
      expect(mockDb.count).toHaveBeenCalledWith("notifications", {
        org_id: ORG_ID,
        user_id: USER_ID,
        is_read: false,
      });
      expect(mockDb.count).toHaveBeenCalledWith("notifications", {
        org_id: ORG_ID,
        user_id: null,
        is_read: false,
      });
    });

    it("returns 0 when no unread notifications exist", async () => {
      mockDb.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const count = await getUnreadCount(ORG_ID, USER_ID);

      expect(count).toBe(0);
    });
  });
});
