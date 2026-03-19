import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB adapter
vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

// Mock number generator
vi.mock("../../utils/number-generator", () => ({
  nextQuoteNumber: vi.fn(),
  nextInvoiceNumber: vi.fn(),
}));

// Mock PDF generator (not under test)
vi.mock("../../utils/pdf", () => ({
  generateQuotePdf: vi.fn(),
}));

// Mock uuid to return deterministic ids
vi.mock("uuid", () => ({
  v4: vi.fn(() => "generated-uuid"),
}));

import { getDB } from "../../db/adapters/index";
import { nextQuoteNumber, nextInvoiceNumber } from "../../utils/number-generator";
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  sendQuote,
  convertToInvoice,
} from "./quote.service";
import { QuoteStatus, InvoiceStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const mockedNextQuoteNumber = vi.mocked(nextQuoteNumber);
const mockedNextInvoiceNumber = vi.mocked(nextInvoiceNumber);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-100";
const USER_ID = "user-300";
const QUOTE_ID = "quote-400";
const CLIENT_ID = "client-200";

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: QUOTE_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    quoteNumber: "QTE-2025-0001",
    status: QuoteStatus.DRAFT,
    issueDate: "2025-03-01",
    expiryDate: "2025-04-01",
    currency: "INR",
    subtotal: 200000,
    discountType: null,
    discountValue: null,
    discountAmount: 0,
    taxAmount: 36000,
    total: 236000,
    notes: null,
    terms: null,
    version: 1,
    createdBy: USER_ID,
    createdAt: new Date("2025-03-01"),
    updatedAt: new Date("2025-03-01"),
    ...overrides,
  };
}

function makeQuoteItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    quoteId: QUOTE_ID,
    orgId: ORG_ID,
    name: "Web Development",
    description: "Frontend work",
    quantity: 10,
    rate: 20000, // 200.00 per unit in paise
    discountType: null,
    discountValue: null,
    discountAmount: 0,
    taxRateId: null,
    taxRate: 18,
    taxAmount: 36000,
    taxComponents: null,
    amount: 236000,
    sortOrder: 0,
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

describe("quote.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listQuotes ───────────────────────────────────────────────────────────

  describe("listQuotes", () => {
    it("returns paginated quotes scoped to orgId", async () => {
      const quotes = [makeQuote(), makeQuote({ id: "quote-401", quoteNumber: "QTE-2025-0002" })];
      mockDb.findPaginated.mockResolvedValue({
        data: quotes,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listQuotes(ORG_ID, { page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("quotes", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "issue_date", direction: "desc" }],
      });
      expect(result.data).toHaveLength(2);
    });

    it("filters by status", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listQuotes(ORG_ID, { status: QuoteStatus.SENT, page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("quotes", expect.objectContaining({
        where: { org_id: ORG_ID, status: QuoteStatus.SENT },
      }));
    });

    it("filters by clientId", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listQuotes(ORG_ID, { clientId: CLIENT_ID, page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("quotes", expect.objectContaining({
        where: { org_id: ORG_ID, client_id: CLIENT_ID },
      }));
    });

    it("filters by date range", async () => {
      const quotes = [
        makeQuote({ issueDate: "2025-01-15" }),
        makeQuote({ id: "q2", issueDate: "2025-06-15", quoteNumber: "Q2" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: quotes, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listQuotes(ORG_ID, {
        from: new Date("2025-06-01"),
        to: new Date("2025-06-30"),
        page: 1,
        limit: 20,
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("q2");
    });
  });

  // ── getQuote ─────────────────────────────────────────────────────────────

  describe("getQuote", () => {
    it("returns quote with items", async () => {
      mockDb.findById.mockResolvedValue(makeQuote());
      mockDb.findMany.mockResolvedValue([makeQuoteItem()]);

      const result = await getQuote(ORG_ID, QUOTE_ID);

      expect(result.id).toBe(QUOTE_ID);
      expect(result.items).toHaveLength(1);
      expect(mockDb.findById).toHaveBeenCalledWith("quotes", QUOTE_ID, ORG_ID);
      expect(mockDb.findMany).toHaveBeenCalledWith("quote_items", {
        where: { quote_id: QUOTE_ID },
        orderBy: [{ column: "sort_order", direction: "asc" }],
      });
    });

    it("throws NotFoundError when quote does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getQuote(ORG_ID, "missing")).rejects.toThrow("Quote not found");
    });
  });

  // ── createQuote ──────────────────────────────────────────────────────────

  describe("createQuote", () => {
    it("creates quote with items and computes totals", async () => {
      // Client exists
      mockDb.findById
        .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }) // client lookup
        .mockResolvedValueOnce(makeQuote()) // getQuote after create (findById for quote)
      ;
      mockDb.findMany.mockResolvedValue([makeQuoteItem()]); // getQuote items

      mockedNextQuoteNumber.mockResolvedValue("QTE-2025-0010");
      mockDb.create.mockResolvedValue(undefined);
      mockDb.createMany.mockResolvedValue(undefined);

      const input = {
        clientId: CLIENT_ID,
        issueDate: "2025-03-01",
        expiryDate: "2025-04-01",
        currency: "INR",
        items: [
          { name: "Web Dev", quantity: 10, rate: 20000, taxRateId: null },
        ],
      };

      const result = await createQuote(ORG_ID, USER_ID, input as any);

      expect(mockedNextQuoteNumber).toHaveBeenCalledWith(ORG_ID);
      expect(mockDb.create).toHaveBeenCalledWith("quotes", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        quoteNumber: "QTE-2025-0010",
        status: QuoteStatus.DRAFT,
        version: 1,
        createdBy: USER_ID,
      }));
      expect(mockDb.createMany).toHaveBeenCalledWith("quote_items", expect.any(Array));
      expect(result).toBeDefined();
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        createQuote(ORG_ID, USER_ID, { clientId: "bad-client", items: [] } as any)
      ).rejects.toThrow("Client not found");
    });
  });

  // ── updateQuote ──────────────────────────────────────────────────────────

  describe("updateQuote", () => {
    it("increments version number on update", async () => {
      const existing = makeQuote({ version: 3 });
      mockDb.findById
        .mockResolvedValueOnce(existing)    // initial findById
        .mockResolvedValueOnce(makeQuote({ version: 4 })); // getQuote after update
      mockDb.update.mockResolvedValue(undefined);
      mockDb.findMany.mockResolvedValue([makeQuoteItem()]);

      await updateQuote(ORG_ID, QUOTE_ID, { notes: "Updated terms" } as any);

      expect(mockDb.update).toHaveBeenCalledWith(
        "quotes",
        QUOTE_ID,
        expect.objectContaining({ version: 4 }),
        ORG_ID
      );
    });

    it("throws NotFoundError when quote does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateQuote(ORG_ID, "missing", {} as any)).rejects.toThrow("Quote not found");
    });

    it("throws BadRequestError when editing a CONVERTED quote", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.CONVERTED }));

      await expect(updateQuote(ORG_ID, QUOTE_ID, { notes: "X" } as any)).rejects.toThrow(
        "Cannot edit a converted or declined quote"
      );
    });

    it("throws BadRequestError when editing a DECLINED quote", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.DECLINED }));

      await expect(updateQuote(ORG_ID, QUOTE_ID, { notes: "X" } as any)).rejects.toThrow(
        "Cannot edit a converted or declined quote"
      );
    });
  });

  // ── sendQuote ────────────────────────────────────────────────────────────

  describe("sendQuote", () => {
    it("updates status to SENT", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.DRAFT }));
      mockDb.update.mockResolvedValue(makeQuote({ status: QuoteStatus.SENT }));

      const result = await sendQuote(ORG_ID, QUOTE_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        "quotes",
        QUOTE_ID,
        expect.objectContaining({ status: QuoteStatus.SENT }),
        ORG_ID
      );
      expect(result.status).toBe(QuoteStatus.SENT);
    });

    it("throws NotFoundError when quote does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(sendQuote(ORG_ID, "missing")).rejects.toThrow("Quote not found");
    });

    it("throws BadRequestError when sending a CONVERTED quote", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.CONVERTED }));

      await expect(sendQuote(ORG_ID, QUOTE_ID)).rejects.toThrow(
        "Cannot send a converted or declined quote"
      );
    });
  });

  // ── convertToInvoice ─────────────────────────────────────────────────────

  describe("convertToInvoice", () => {
    it("creates an invoice from quote and marks quote as CONVERTED", async () => {
      const quote = makeQuote({ status: QuoteStatus.SENT });
      const items = [makeQuoteItem()];

      // getQuote is called first (findById + findMany)
      mockDb.findById
        .mockResolvedValueOnce(quote)  // getQuote -> findById
        .mockResolvedValueOnce(makeQuote({ status: QuoteStatus.CONVERTED, convertedInvoiceId: "generated-uuid" })); // final getQuote
      mockDb.findMany
        .mockResolvedValueOnce(items)  // getQuote -> findMany (quote_items)
        .mockResolvedValueOnce(items); // final getQuote -> findMany

      mockedNextInvoiceNumber.mockResolvedValue("INV-2025-0001");
      mockDb.create.mockResolvedValue(undefined);
      mockDb.createMany.mockResolvedValue(undefined);
      mockDb.update.mockResolvedValue(undefined);
      mockDb.increment.mockReturnValue(1); // for client totals

      const result = await convertToInvoice(ORG_ID, QUOTE_ID, USER_ID);

      expect(mockedNextInvoiceNumber).toHaveBeenCalledWith(ORG_ID);

      // Creates the invoice
      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        invoiceNumber: "INV-2025-0001",
        status: InvoiceStatus.DRAFT,
        referenceNumber: "QTE-2025-0001",
        total: 236000,
        amountPaid: 0,
        amountDue: 236000,
      }));

      // Copies items
      expect(mockDb.createMany).toHaveBeenCalledWith("invoice_items", expect.any(Array));

      // Marks quote as converted
      expect(mockDb.update).toHaveBeenCalledWith(
        "quotes",
        QUOTE_ID,
        expect.objectContaining({ status: QuoteStatus.CONVERTED, convertedInvoiceId: "generated-uuid" }),
        ORG_ID
      );

      expect(result.invoiceId).toBe("generated-uuid");
    });

    it("throws BadRequestError when quote is already CONVERTED", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.CONVERTED }));
      mockDb.findMany.mockResolvedValue([makeQuoteItem()]);

      await expect(convertToInvoice(ORG_ID, QUOTE_ID, USER_ID)).rejects.toThrow(
        "Quote has already been converted to an invoice"
      );
    });

    it("throws BadRequestError when converting a DECLINED quote", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.DECLINED }));
      mockDb.findMany.mockResolvedValue([makeQuoteItem()]);

      await expect(convertToInvoice(ORG_ID, QUOTE_ID, USER_ID)).rejects.toThrow(
        "Cannot convert a declined quote"
      );
    });
  });

  // ── deleteQuote ──────────────────────────────────────────────────────────

  describe("deleteQuote", () => {
    it("deletes a DRAFT quote and its items", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.DRAFT }));

      await deleteQuote(ORG_ID, QUOTE_ID);

      expect(mockDb.deleteMany).toHaveBeenCalledWith("quote_items", { quote_id: QUOTE_ID });
      expect(mockDb.delete).toHaveBeenCalledWith("quotes", QUOTE_ID, ORG_ID);
    });

    it("throws NotFoundError when quote does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteQuote(ORG_ID, "missing")).rejects.toThrow("Quote not found");
    });

    it("throws BadRequestError when deleting a non-DRAFT quote", async () => {
      mockDb.findById.mockResolvedValue(makeQuote({ status: QuoteStatus.SENT }));

      await expect(deleteQuote(ORG_ID, QUOTE_ID)).rejects.toThrow(
        "Only draft quotes can be deleted"
      );
    });
  });
});
