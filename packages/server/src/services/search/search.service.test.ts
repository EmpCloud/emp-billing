import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

import { getDB } from "../../db/adapters/index";
import { globalSearch } from "./search.service";

const mockedGetDB = vi.mocked(getDB);

function makeMockDB() {
  return {
    findMany: vi.fn(),
  };
}

const ORG_ID = "org-001";

describe("SearchService", () => {
  let mockDb: ReturnType<typeof makeMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDB();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── globalSearch ───────────────────────────────────────────────────────

  describe("globalSearch", () => {
    it("returns results from multiple entity types", async () => {
      // Each findMany call corresponds to one category: clients, invoices, quotes, expenses, products, vendors
      mockDb.findMany
        // clients
        .mockResolvedValueOnce([
          { id: "c1", name: "Acme Corp", email: "acme@example.com", display_name: "Acme" },
        ])
        // invoices
        .mockResolvedValueOnce([
          { id: "i1", invoice_number: "INV-2026-0001", status: "paid", total: 5000000, currency: "INR" },
        ])
        // quotes
        .mockResolvedValueOnce([])
        // expenses
        .mockResolvedValueOnce([])
        // products
        .mockResolvedValueOnce([
          { id: "p1", name: "Acme Widget", sku: "ACM-001", type: "goods", rate: 150000 },
        ])
        // vendors
        .mockResolvedValueOnce([]);

      const result = await globalSearch(ORG_ID, "acme");

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0]).toEqual({
        id: "c1",
        type: "client",
        title: "Acme Corp",
        subtitle: "acme@example.com",
      });
      expect(result.invoices).toHaveLength(0); // "acme" doesn't match invoice_number
      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe("Acme Widget");
    });

    it("respects max 5 results per category", async () => {
      // Generate 8 matching clients
      const manyClients = Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`,
        name: `Test Client ${i}`,
        email: `test${i}@example.com`,
        display_name: `Test ${i}`,
      }));

      mockDb.findMany
        .mockResolvedValueOnce(manyClients) // clients
        .mockResolvedValueOnce([])          // invoices
        .mockResolvedValueOnce([])          // quotes
        .mockResolvedValueOnce([])          // expenses
        .mockResolvedValueOnce([])          // products
        .mockResolvedValueOnce([]);         // vendors

      const result = await globalSearch(ORG_ID, "test");

      expect(result.clients).toHaveLength(5);
      expect(result.clients[0].id).toBe("c0");
      expect(result.clients[4].id).toBe("c4");
    });

    it("returns empty results when no matches found", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([{ id: "c1", name: "Alpha LLC", email: "alpha@test.com", display_name: "" }])
        .mockResolvedValueOnce([{ id: "i1", invoice_number: "INV-2026-0001", status: "sent", total: 100000, currency: "USD" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "p1", name: "Gadget", sku: "GDG-001", type: "goods", rate: 50000 }])
        .mockResolvedValueOnce([]);

      const result = await globalSearch(ORG_ID, "zzz-no-match");

      expect(result.clients).toHaveLength(0);
      expect(result.invoices).toHaveLength(0);
      expect(result.quotes).toHaveLength(0);
      expect(result.expenses).toHaveLength(0);
      expect(result.products).toHaveLength(0);
      expect(result.vendors).toHaveLength(0);
    });

    it("returns all-empty categories for empty query string", async () => {
      const result = await globalSearch(ORG_ID, "");

      expect(result).toEqual({
        clients: [],
        invoices: [],
        quotes: [],
        expenses: [],
        products: [],
        vendors: [],
      });
      // No DB calls should be made
      expect(mockDb.findMany).not.toHaveBeenCalled();
    });

    it("returns all-empty categories for whitespace-only query", async () => {
      const result = await globalSearch(ORG_ID, "   ");

      expect(result).toEqual({
        clients: [],
        invoices: [],
        quotes: [],
        expenses: [],
        products: [],
        vendors: [],
      });
      expect(mockDb.findMany).not.toHaveBeenCalled();
    });

    it("scopes all queries by orgId", async () => {
      mockDb.findMany.mockResolvedValue([]);

      await globalSearch(ORG_ID, "test");

      // All 6 entity searches should be scoped to orgId
      expect(mockDb.findMany).toHaveBeenCalledTimes(6);
      for (const call of mockDb.findMany.mock.calls) {
        expect(call[1].where).toEqual(expect.objectContaining({ org_id: ORG_ID }));
      }
    });

    it("performs case-insensitive matching", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([
          { id: "c1", name: "UPPERCASE Corp", email: "upper@test.com", display_name: "" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await globalSearch(ORG_ID, "uppercase");

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].title).toBe("UPPERCASE Corp");
    });

    it("searches vendors by name, email, and company", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([]) // clients
        .mockResolvedValueOnce([]) // invoices
        .mockResolvedValueOnce([]) // quotes
        .mockResolvedValueOnce([]) // expenses
        .mockResolvedValueOnce([]) // products
        .mockResolvedValueOnce([   // vendors
          { id: "v1", name: "John Doe", email: "john@vendor.com", company: "VendorCo Inc" },
          { id: "v2", name: "Jane Smith", email: "jane@vendorco.com", company: "VendorCo Inc" },
        ]);

      const result = await globalSearch(ORG_ID, "vendorco");

      expect(result.vendors).toHaveLength(2);
      expect(result.vendors[0].subtitle).toBe("VendorCo Inc");
    });

    it("maps invoice result with status and formatted total", async () => {
      mockDb.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: "i1", invoice_number: "INV-2026-0042", status: "paid", total: 1234500, currency: "INR" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await globalSearch(ORG_ID, "inv-2026-0042");

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0]).toEqual({
        id: "i1",
        type: "invoice",
        title: "INV-2026-0042",
        subtitle: "paid - INR 12345",
      });
    });
  });
});
