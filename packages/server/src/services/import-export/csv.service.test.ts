import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../utils/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { getDB } from "../../db/adapters/index";
import {
  exportClientsCSV,
  importClientsCSV,
  exportProductsCSV,
  importProductsCSV,
} from "./csv.service";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findMany: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
  };
}

describe("csv.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("exportClientsCSV", () => {
    it("exports clients as CSV string", async () => {
      mockDb.findMany.mockResolvedValue([
        {
          name: "Acme Corp",
          displayName: "Acme",
          email: "acme@example.com",
          phone: "1234567890",
          taxId: "GST123",
          currency: "INR",
          paymentTerms: "net_30",
          tags: '["enterprise","vip"]',
          billingAddress: JSON.stringify({ line1: "123 Main St", city: "Mumbai", state: "MH", postalCode: "400001", country: "IN" }),
        },
      ]);

      const csv = await exportClientsCSV(ORG_ID);

      expect(csv).toContain("name,displayName,email");
      expect(csv).toContain("Acme Corp");
      expect(csv).toContain("acme@example.com");
    });

    it("handles empty client list", async () => {
      mockDb.findMany.mockResolvedValue([]);

      const csv = await exportClientsCSV(ORG_ID);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(1); // header only
    });
  });

  describe("importClientsCSV", () => {
    it("imports valid CSV rows", async () => {
      mockDb.findOne.mockResolvedValue(null); // no duplicates

      const csv = `name,email,phone,currency\nAcme Corp,acme@test.com,12345,USD\nBeta Inc,beta@test.com,67890,INR`;

      const result = await importClientsCSV(ORG_ID, csv);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("skips rows with missing name", async () => {
      const csv = `name,email\n,missing@test.com`;

      const result = await importClientsCSV(ORG_ID, csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain("missing required field");
    });

    it("skips rows with missing email", async () => {
      const csv = `name,email\nAcme,`;

      const result = await importClientsCSV(ORG_ID, csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("skips duplicate emails", async () => {
      mockDb.findOne.mockResolvedValue({ id: "existing" });

      const csv = `name,email\nAcme,dup@test.com`;

      const result = await importClientsCSV(ORG_ID, csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain("already exists");
    });

    it("throws on empty CSV", async () => {
      await expect(importClientsCSV(ORG_ID, "")).rejects.toThrow("CSV data is empty");
    });

    it("throws on header-only CSV", async () => {
      await expect(importClientsCSV(ORG_ID, "name,email")).rejects.toThrow("CSV contains no data rows");
    });

    it("parses tags from semicolon-separated values", async () => {
      mockDb.findOne.mockResolvedValue(null);

      const csv = `name,email,tags\nAcme,a@test.com,enterprise;vip`;

      await importClientsCSV(ORG_ID, csv);

      expect(mockDb.create).toHaveBeenCalledWith("clients", expect.objectContaining({
        tags: JSON.stringify(["enterprise", "vip"]),
      }));
    });
  });

  describe("exportProductsCSV", () => {
    it("exports products as CSV", async () => {
      mockDb.findMany.mockResolvedValue([
        {
          name: "Widget",
          description: "A widget",
          sku: "WDG-001",
          type: "goods",
          unit: "unit",
          rate: 9999,
          hsnCode: "8471",
          trackInventory: true,
          stockOnHand: 50,
        },
      ]);

      const csv = await exportProductsCSV(ORG_ID);

      expect(csv).toContain("Widget");
      expect(csv).toContain("99.99"); // rate / 100
      expect(csv).toContain("WDG-001");
    });
  });

  describe("importProductsCSV", () => {
    it("imports valid product rows", async () => {
      mockDb.findOne.mockResolvedValue(null);

      const csv = `name,rate,sku\nWidget,49.99,WDG-001`;

      const result = await importProductsCSV(ORG_ID, csv);

      expect(result.imported).toBe(1);
      expect(mockDb.create).toHaveBeenCalledWith("products", expect.objectContaining({
        rate: 4999, // 49.99 * 100
      }));
    });

    it("skips duplicate SKU", async () => {
      mockDb.findOne.mockResolvedValue({ id: "existing" });

      const csv = `name,sku\nWidget,WDG-001`;

      const result = await importProductsCSV(ORG_ID, csv);

      expect(result.skipped).toBe(1);
    });

    it("skips invalid rate", async () => {
      mockDb.findOne.mockResolvedValue(null);

      const csv = `name,rate\nWidget,not-a-number`;

      const result = await importProductsCSV(ORG_ID, csv);

      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain("invalid rate");
    });

    it("throws on empty CSV", async () => {
      await expect(importProductsCSV(ORG_ID, "")).rejects.toThrow("CSV data is empty");
    });
  });
});
