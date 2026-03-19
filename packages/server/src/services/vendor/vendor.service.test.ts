import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB adapter
vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "generated-uuid"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} from "./vendor.service";

const mockedGetDB = vi.mocked(getDB);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-100";
const VENDOR_ID = "vendor-600";

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    id: VENDOR_ID,
    orgId: ORG_ID,
    name: "Tech Supplies Ltd",
    email: "sales@techsupplies.com",
    phone: "+919876543210",
    company: "Tech Supplies Ltd",
    address: "123 Market St, Mumbai",
    taxId: "GSTIN1234567890",
    notes: "Preferred hardware vendor",
    isActive: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-01"),
    ...overrides,
  };
}

function makeMockDb() {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    softDelete: vi.fn(),
    increment: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("vendor.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listVendors ──────────────────────────────────────────────────────────

  describe("listVendors", () => {
    it("returns paginated vendors scoped to orgId", async () => {
      const vendors = [
        makeVendor(),
        makeVendor({ id: "vendor-601", name: "Paper Co", email: "info@paper.co", company: "Paper Co" }),
      ];
      mockDb.findPaginated.mockResolvedValue({
        data: vendors,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listVendors(ORG_ID, { page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("vendors", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "name", direction: "asc" }],
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by search across name, email, and company", async () => {
      const vendors = [
        makeVendor({ name: "Tech Supplies Ltd", email: "sales@techsupplies.com", company: "Tech Supplies Ltd" }),
        makeVendor({ id: "vendor-601", name: "Paper Co", email: "info@paper.co", company: "Paper Co" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: vendors, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listVendors(ORG_ID, { search: "paper", page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Paper Co");
    });

    it("search matches on email", async () => {
      const vendors = [
        makeVendor({ name: "Alpha", email: "unique@alpha.io", company: "Alpha Corp" }),
        makeVendor({ id: "v2", name: "Beta", email: "sales@beta.com", company: "Beta Corp" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: vendors, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listVendors(ORG_ID, { search: "unique@alpha", page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Alpha");
    });

    it("passes isActive filter to the DB where clause", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listVendors(ORG_ID, { isActive: true, page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("vendors", expect.objectContaining({
        where: { org_id: ORG_ID, is_active: true },
      }));
    });

    it("passes isActive=false filter correctly", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listVendors(ORG_ID, { isActive: false, page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("vendors", expect.objectContaining({
        where: { org_id: ORG_ID, is_active: false },
      }));
    });

    it("returns all vendors when no filters are provided", async () => {
      const vendors = [makeVendor()];
      mockDb.findPaginated.mockResolvedValue({ data: vendors, total: 1, page: 1, limit: 20, totalPages: 1 });

      const result = await listVendors(ORG_ID, { page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("vendors", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "name", direction: "asc" }],
      });
      expect(result.data).toHaveLength(1);
    });
  });

  // ── getVendor ────────────────────────────────────────────────────────────

  describe("getVendor", () => {
    it("returns vendor by id scoped to orgId", async () => {
      const vendor = makeVendor();
      mockDb.findById.mockResolvedValue(vendor);

      const result = await getVendor(ORG_ID, VENDOR_ID);

      expect(result.id).toBe(VENDOR_ID);
      expect(result.name).toBe("Tech Supplies Ltd");
      expect(mockDb.findById).toHaveBeenCalledWith("vendors", VENDOR_ID, ORG_ID);
    });

    it("throws NotFoundError when vendor does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getVendor(ORG_ID, "missing-id")).rejects.toThrow("Vendor not found");
    });
  });

  // ── createVendor ─────────────────────────────────────────────────────────

  describe("createVendor", () => {
    it("creates vendor with all fields and returns the created vendor", async () => {
      mockDb.create.mockResolvedValue(undefined);
      mockDb.findById.mockResolvedValue(makeVendor());

      const input = {
        name: "Tech Supplies Ltd",
        email: "sales@techsupplies.com",
        phone: "+919876543210",
        company: "Tech Supplies Ltd",
        address: "123 Market St, Mumbai",
        taxId: "GSTIN1234567890",
        notes: "Preferred hardware vendor",
      };

      const result = await createVendor(ORG_ID, input as any);

      expect(mockDb.create).toHaveBeenCalledWith("vendors", expect.objectContaining({
        id: "generated-uuid",
        orgId: ORG_ID,
        name: "Tech Supplies Ltd",
        email: "sales@techsupplies.com",
        phone: "+919876543210",
        company: "Tech Supplies Ltd",
        taxId: "GSTIN1234567890",
        isActive: true,
      }));
      expect(result.id).toBe(VENDOR_ID);
    });

    it("sets isActive to true by default", async () => {
      mockDb.create.mockResolvedValue(undefined);
      mockDb.findById.mockResolvedValue(makeVendor());

      await createVendor(ORG_ID, { name: "Minimal Vendor" } as any);

      expect(mockDb.create).toHaveBeenCalledWith("vendors", expect.objectContaining({
        isActive: true,
      }));
    });
  });

  // ── updateVendor ─────────────────────────────────────────────────────────

  describe("updateVendor", () => {
    it("updates vendor fields and returns the updated vendor", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeVendor())                              // existing check
        .mockResolvedValueOnce(makeVendor({ name: "Updated Supplies" })); // getVendor return
      mockDb.update.mockResolvedValue(undefined);

      const result = await updateVendor(ORG_ID, VENDOR_ID, { name: "Updated Supplies" } as any);

      expect(mockDb.update).toHaveBeenCalledWith("vendors", VENDOR_ID, expect.objectContaining({
        name: "Updated Supplies",
      }), ORG_ID);
      expect(result.name).toBe("Updated Supplies");
    });

    it("throws NotFoundError when vendor does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateVendor(ORG_ID, "missing-id", { name: "X" } as any)).rejects.toThrow(
        "Vendor not found"
      );
    });

    it("includes updatedAt timestamp in the update", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeVendor())
        .mockResolvedValueOnce(makeVendor());
      mockDb.update.mockResolvedValue(undefined);

      await updateVendor(ORG_ID, VENDOR_ID, { phone: "+910000000000" } as any);

      const updateCall = mockDb.update.mock.calls[0];
      expect(updateCall[2]).toHaveProperty("updatedAt");
      expect(updateCall[2].updatedAt).toBeInstanceOf(Date);
    });
  });

  // ── deleteVendor ─────────────────────────────────────────────────────────

  describe("deleteVendor", () => {
    it("soft-deletes an existing vendor", async () => {
      mockDb.findById.mockResolvedValue(makeVendor());

      await deleteVendor(ORG_ID, VENDOR_ID);

      expect(mockDb.softDelete).toHaveBeenCalledWith("vendors", VENDOR_ID, ORG_ID);
    });

    it("throws NotFoundError when vendor does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteVendor(ORG_ID, "missing-id")).rejects.toThrow("Vendor not found");
    });

    it("scopes the soft-delete to the correct orgId", async () => {
      mockDb.findById.mockResolvedValue(makeVendor());

      await deleteVendor(ORG_ID, VENDOR_ID);

      expect(mockDb.softDelete).toHaveBeenCalledWith("vendors", VENDOR_ID, ORG_ID);
      expect(mockDb.findById).toHaveBeenCalledWith("vendors", VENDOR_ID, ORG_ID);
    });
  });
});
