import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "prod-uuid-001"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "./product.service";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    updateMany: vi.fn(),
  };
}

const ORG_ID = "org-001";
const USER_ID = "user-001";

describe("ProductService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listProducts ───────────────────────────────────────────────────────

  describe("listProducts", () => {
    it("returns paginated products", async () => {
      const products = [
        { id: "p1", name: "Widget", sku: "WDG-001", type: "goods", rate: 50000 },
        { id: "p2", name: "Consulting", sku: null, type: "service", rate: 300000 },
      ];
      mockDb.findPaginated.mockResolvedValue({
        data: products,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listProducts(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("products", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "name", direction: "asc" }],
      });
    });

    it("filters by search term across name, sku, description", async () => {
      const products = [
        { id: "p1", name: "Widget Pro", sku: "WDG-001", description: "A premium widget" },
        { id: "p2", name: "Gadget", sku: "GDG-002", description: "A simple gadget" },
        { id: "p3", name: "Thingamajig", sku: "THG-003", description: "Widget accessory" },
      ];
      mockDb.findPaginated.mockResolvedValue({
        data: products,
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listProducts(ORG_ID, { search: "widget", page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((p: any) => p.id)).toEqual(["p1", "p3"]);
    });

    it("applies type filter to DB query", async () => {
      mockDb.findPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await listProducts(ORG_ID, { type: "service", page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("products", {
        where: { org_id: ORG_ID, type: "service" },
        page: 1,
        limit: 20,
        orderBy: [{ column: "name", direction: "asc" }],
      });
    });
  });

  // ── getProduct ─────────────────────────────────────────────────────────

  describe("getProduct", () => {
    it("returns the product when found", async () => {
      const product = { id: "p1", name: "Widget", rate: 50000, orgId: ORG_ID };
      mockDb.findById.mockResolvedValue(product);

      const result = await getProduct(ORG_ID, "p1");

      expect(result).toEqual(product);
      expect(mockDb.findById).toHaveBeenCalledWith("products", "p1", ORG_ID);
    });

    it("throws NotFoundError when product does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getProduct(ORG_ID, "nonexistent")).rejects.toThrow("Product not found");
    });
  });

  // ── createProduct ──────────────────────────────────────────────────────

  describe("createProduct", () => {
    it("creates a product with rate in paise", async () => {
      const input = {
        name: "Premium Widget",
        type: "goods" as const,
        rate: 150000, // 1500.00 INR in paise
        sku: "PWG-001",
        unit: "units",
        description: "A premium quality widget",
      };
      const createdProduct = { id: "prod-uuid-001", orgId: ORG_ID, ...input, isActive: true };
      mockDb.findOne.mockResolvedValue(null); // no SKU conflict
      mockDb.create.mockResolvedValue(createdProduct);

      const result = await createProduct(ORG_ID, USER_ID, input);

      expect(result.rate).toBe(150000);
      expect(mockDb.create).toHaveBeenCalledWith(
        "products",
        expect.objectContaining({
          id: "prod-uuid-001",
          orgId: ORG_ID,
          name: "Premium Widget",
          rate: 150000,
          sku: "PWG-001",
          isActive: true,
        })
      );
    });

    it("throws ConflictError when SKU already exists", async () => {
      const input = { name: "Duplicate SKU", type: "goods" as const, rate: 10000, sku: "DUP-001" };
      mockDb.findOne.mockResolvedValue({ id: "existing-product", sku: "DUP-001" });

      await expect(createProduct(ORG_ID, USER_ID, input)).rejects.toThrow(
        "A product with SKU 'DUP-001' already exists"
      );
    });

    it("creates product without SKU (no conflict check)", async () => {
      const input = { name: "No SKU Service", type: "service" as const, rate: 500000 };
      const created = { id: "prod-uuid-001", orgId: ORG_ID, ...input, isActive: true };
      mockDb.create.mockResolvedValue(created);

      const result = await createProduct(ORG_ID, USER_ID, input);

      expect(result.name).toBe("No SKU Service");
      expect(mockDb.findOne).not.toHaveBeenCalled();
    });
  });

  // ── updateProduct ──────────────────────────────────────────────────────

  describe("updateProduct", () => {
    it("updates product fields", async () => {
      const existing = { id: "p1", name: "Widget", rate: 50000, sku: "WDG-001", orgId: ORG_ID };
      const updated = { ...existing, name: "Widget V2", rate: 75000 };
      mockDb.findById.mockResolvedValue(existing);
      mockDb.findOne.mockResolvedValue(null);
      mockDb.update.mockResolvedValue(updated);

      const result = await updateProduct(ORG_ID, "p1", { name: "Widget V2", rate: 75000 });

      expect(result.name).toBe("Widget V2");
      expect(result.rate).toBe(75000);
      expect(mockDb.update).toHaveBeenCalledWith(
        "products",
        "p1",
        expect.objectContaining({ name: "Widget V2", rate: 75000 }),
        ORG_ID
      );
    });

    it("throws NotFoundError when updating nonexistent product", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateProduct(ORG_ID, "missing", { name: "X" })).rejects.toThrow(
        "Product not found"
      );
    });

    it("throws ConflictError when updating to a taken SKU", async () => {
      mockDb.findById.mockResolvedValue({ id: "p1", name: "Widget", sku: "WDG-001" });
      mockDb.findOne.mockResolvedValue({ id: "p2", sku: "TAKEN-SKU" });

      await expect(
        updateProduct(ORG_ID, "p1", { sku: "TAKEN-SKU" })
      ).rejects.toThrow("A product with SKU 'TAKEN-SKU' already exists");
    });
  });

  // ── deleteProduct ──────────────────────────────────────────────────────

  describe("deleteProduct", () => {
    it("soft-deletes (deactivates) the product", async () => {
      mockDb.findById.mockResolvedValue({ id: "p1", name: "Widget", isActive: true });

      await deleteProduct(ORG_ID, "p1");

      expect(mockDb.softDelete).toHaveBeenCalledWith("products", "p1", ORG_ID);
    });

    it("throws NotFoundError when deleting nonexistent product", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteProduct(ORG_ID, "nonexistent")).rejects.toThrow("Product not found");
    });
  });

  // ── Tax Rate CRUD ──────────────────────────────────────────────────────

  describe("createTaxRate", () => {
    it("creates a tax rate and sets as default (clearing other defaults)", async () => {
      const input = { name: "GST 18%", type: "gst", rate: 1800, isCompound: false, isDefault: true };
      const created = { id: "prod-uuid-001", orgId: ORG_ID, ...input, isActive: true };
      mockDb.create.mockResolvedValue(created);
      mockDb.updateMany.mockResolvedValue(undefined);

      const result = await createTaxRate(ORG_ID, input);

      expect(mockDb.updateMany).toHaveBeenCalledWith(
        "tax_rates",
        { org_id: ORG_ID },
        expect.objectContaining({ is_default: false })
      );
      expect(result.name).toBe("GST 18%");
    });

    it("creates a non-default tax rate without clearing defaults", async () => {
      const input = { name: "VAT 5%", type: "vat", rate: 500, isCompound: false, isDefault: false };
      mockDb.create.mockResolvedValue({ id: "prod-uuid-001", ...input, isActive: true });

      await createTaxRate(ORG_ID, input);

      expect(mockDb.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("updateTaxRate", () => {
    it("updates an existing tax rate", async () => {
      mockDb.findById.mockResolvedValue({ id: "tr1", name: "GST 18%", rate: 1800 });
      mockDb.update.mockResolvedValue({ id: "tr1", name: "GST 12%", rate: 1200 });

      const result = await updateTaxRate(ORG_ID, "tr1", { name: "GST 12%", rate: 1200 });

      expect(result.name).toBe("GST 12%");
    });

    it("throws NotFoundError when updating nonexistent tax rate", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateTaxRate(ORG_ID, "missing", { name: "X" })).rejects.toThrow(
        "Tax rate not found"
      );
    });
  });

  describe("deleteTaxRate", () => {
    it("soft-deletes the tax rate", async () => {
      mockDb.findById.mockResolvedValue({ id: "tr1", name: "GST 18%", isActive: true });

      await deleteTaxRate(ORG_ID, "tr1");

      expect(mockDb.softDelete).toHaveBeenCalledWith("tax_rates", "tr1", ORG_ID);
    });

    it("throws NotFoundError when deleting nonexistent tax rate", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteTaxRate(ORG_ID, "missing")).rejects.toThrow("Tax rate not found");
    });
  });
});
