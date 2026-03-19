import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "disp-uuid-001"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listDisputes,
  getDispute,
  createDispute,
  updateDispute,
} from "./dispute.service";
import { DisputeStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

const ORG_ID = "org-001";
const CLIENT_ID = "client-001";
const USER_ID = "admin-001";

describe("DisputeService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listDisputes ───────────────────────────────────────────────────────

  describe("listDisputes", () => {
    it("returns paginated disputes", async () => {
      const disputes = [
        { id: "d1", reason: "Incorrect amount", status: DisputeStatus.OPEN },
        { id: "d2", reason: "Duplicate charge", status: DisputeStatus.UNDER_REVIEW },
      ];
      mockDb.findPaginated.mockResolvedValue({
        data: disputes,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listDisputes(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("disputes", {
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

      await listDisputes(ORG_ID, { status: DisputeStatus.OPEN, page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("disputes", {
        where: { org_id: ORG_ID, status: DisputeStatus.OPEN },
        page: 1,
        limit: 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
      });
    });

    it("applies client filter", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await listDisputes(ORG_ID, { clientId: CLIENT_ID, page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("disputes", {
        where: { org_id: ORG_ID, client_id: CLIENT_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
      });
    });

    it("applies both status and client filters together", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      await listDisputes(ORG_ID, {
        status: DisputeStatus.UNDER_REVIEW,
        clientId: CLIENT_ID,
        page: 1,
        limit: 10,
      });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("disputes", {
        where: {
          org_id: ORG_ID,
          status: DisputeStatus.UNDER_REVIEW,
          client_id: CLIENT_ID,
        },
        page: 1,
        limit: 10,
        orderBy: [{ column: "created_at", direction: "desc" }],
      });
    });
  });

  // ── getDispute ─────────────────────────────────────────────────────────

  describe("getDispute", () => {
    it("returns the dispute when found", async () => {
      const dispute = {
        id: "d1",
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        reason: "Incorrect amount charged",
        status: DisputeStatus.OPEN,
        invoiceId: "inv-001",
      };
      mockDb.findById.mockResolvedValue(dispute);

      const result = await getDispute(ORG_ID, "d1");

      expect(result).toEqual(dispute);
      expect(mockDb.findById).toHaveBeenCalledWith("disputes", "d1", ORG_ID);
    });

    it("throws NotFoundError when dispute does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getDispute(ORG_ID, "nonexistent")).rejects.toThrow("Dispute not found");
    });
  });

  // ── createDispute ──────────────────────────────────────────────────────

  describe("createDispute", () => {
    it("creates dispute with OPEN status", async () => {
      const created = {
        id: "disp-uuid-001",
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        invoiceId: null,
        reason: "Billing discrepancy",
        status: DisputeStatus.OPEN,
        resolution: null,
        adminNotes: null,
        resolvedBy: null,
        resolvedAt: null,
      };
      mockDb.create.mockResolvedValue(created);

      const result = await createDispute(ORG_ID, CLIENT_ID, {
        reason: "Billing discrepancy",
      });

      expect(result.status).toBe(DisputeStatus.OPEN);
      expect(result.resolvedBy).toBeNull();
      expect(result.resolvedAt).toBeNull();
      expect(mockDb.create).toHaveBeenCalledWith(
        "disputes",
        expect.objectContaining({
          id: "disp-uuid-001",
          orgId: ORG_ID,
          clientId: CLIENT_ID,
          reason: "Billing discrepancy",
          status: DisputeStatus.OPEN,
          resolution: null,
          adminNotes: null,
          attachments: null,
          resolvedBy: null,
          resolvedAt: null,
        })
      );
    });

    it("creates dispute linked to an invoice", async () => {
      const invoice = { id: "inv-001", clientId: CLIENT_ID };
      mockDb.findById.mockResolvedValue(invoice);
      mockDb.create.mockResolvedValue({
        id: "disp-uuid-001",
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        invoiceId: "inv-001",
        reason: "Wrong amount on invoice",
        status: DisputeStatus.OPEN,
      });

      const result = await createDispute(ORG_ID, CLIENT_ID, {
        invoiceId: "inv-001",
        reason: "Wrong amount on invoice",
      });

      expect(result.invoiceId).toBe("inv-001");
      expect(mockDb.findById).toHaveBeenCalledWith("invoices", "inv-001", ORG_ID);
    });

    it("throws NotFoundError when linked invoice does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        createDispute(ORG_ID, CLIENT_ID, {
          invoiceId: "nonexistent",
          reason: "Test",
        })
      ).rejects.toThrow("Invoice not found");
    });

    it("throws ForbiddenError when invoice belongs to a different client", async () => {
      mockDb.findById.mockResolvedValue({ id: "inv-001", clientId: "other-client" });

      await expect(
        createDispute(ORG_ID, CLIENT_ID, {
          invoiceId: "inv-001",
          reason: "Test",
        })
      ).rejects.toThrow("You do not have access to this invoice");
    });
  });

  // ── updateDispute ──────────────────────────────────────────────────────

  describe("updateDispute", () => {
    it("updates dispute status and admin notes", async () => {
      const existing = {
        id: "d1",
        orgId: ORG_ID,
        status: DisputeStatus.OPEN,
        reason: "Billing error",
      };
      const updated = {
        ...existing,
        status: DisputeStatus.UNDER_REVIEW,
        adminNotes: "Looking into this",
      };
      mockDb.findById.mockResolvedValue(existing);
      mockDb.update.mockResolvedValue(updated);

      const result = await updateDispute(
        ORG_ID,
        "d1",
        { status: DisputeStatus.UNDER_REVIEW, adminNotes: "Looking into this" },
        USER_ID
      );

      expect(result.status).toBe(DisputeStatus.UNDER_REVIEW);
      expect(result.adminNotes).toBe("Looking into this");
    });

    it("sets resolvedBy and resolvedAt when status is RESOLVED", async () => {
      const existing = { id: "d1", status: DisputeStatus.UNDER_REVIEW };
      mockDb.findById.mockResolvedValue(existing);
      mockDb.update.mockResolvedValue({
        ...existing,
        status: DisputeStatus.RESOLVED,
        resolution: "Credit issued",
        resolvedBy: USER_ID,
        resolvedAt: expect.any(Date),
      });

      await updateDispute(
        ORG_ID,
        "d1",
        { status: DisputeStatus.RESOLVED, resolution: "Credit issued" },
        USER_ID
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        "disputes",
        "d1",
        expect.objectContaining({
          status: DisputeStatus.RESOLVED,
          resolution: "Credit issued",
          resolvedBy: USER_ID,
          resolvedAt: expect.any(Date),
        }),
        ORG_ID
      );
    });

    it("sets resolvedBy and resolvedAt when status is CLOSED", async () => {
      const existing = { id: "d1", status: DisputeStatus.OPEN };
      mockDb.findById.mockResolvedValue(existing);
      mockDb.update.mockResolvedValue({
        ...existing,
        status: DisputeStatus.CLOSED,
        resolvedBy: USER_ID,
      });

      await updateDispute(ORG_ID, "d1", { status: DisputeStatus.CLOSED }, USER_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        "disputes",
        "d1",
        expect.objectContaining({
          status: DisputeStatus.CLOSED,
          resolvedBy: USER_ID,
          resolvedAt: expect.any(Date),
        }),
        ORG_ID
      );
    });

    it("does not set resolvedBy when status is UNDER_REVIEW", async () => {
      const existing = { id: "d1", status: DisputeStatus.OPEN };
      mockDb.findById.mockResolvedValue(existing);
      mockDb.update.mockResolvedValue({ ...existing, status: DisputeStatus.UNDER_REVIEW });

      await updateDispute(
        ORG_ID,
        "d1",
        { status: DisputeStatus.UNDER_REVIEW },
        USER_ID
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        "disputes",
        "d1",
        expect.not.objectContaining({ resolvedBy: USER_ID }),
        ORG_ID
      );
    });

    it("throws NotFoundError when dispute does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        updateDispute(ORG_ID, "missing", { status: DisputeStatus.CLOSED }, USER_ID)
      ).rejects.toThrow("Dispute not found");
    });
  });
});
