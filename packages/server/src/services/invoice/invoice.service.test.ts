import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceStatus, DiscountType, CreditNoteStatus } from "@emp-billing/shared";
import type { Invoice, InvoiceItem } from "@emp-billing/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("../../utils/number-generator", () => ({
  nextInvoiceNumber: vi.fn(),
}));

vi.mock("../../utils/pdf", () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "00000000-0000-0000-0000-000000000099"),
}));

import { getDB } from "../../db/adapters/index";
import { nextInvoiceNumber } from "../../utils/number-generator";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  voidInvoice,
  duplicateInvoice,
} from "./invoice.service";

const mockedGetDB = vi.mocked(getDB);
const mockedNextInvoiceNumber = vi.mocked(nextInvoiceNumber);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-11111111-1111-1111-1111-111111111111";
const USER_ID = "usr-22222222-2222-2222-2222-222222222222";
const CLIENT_ID = "cli-33333333-3333-3333-3333-333333333333";
const INVOICE_ID = "inv-44444444-4444-4444-4444-444444444444";

function makeMockDb(overrides: Record<string, unknown> = {}) {
  return {
    findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((_table: string, data: Record<string, unknown>) => Promise.resolve(data)),
    createMany: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockImplementation((_table: string, _id: string, data: Record<string, unknown>) => Promise.resolve(data)),
    updateMany: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    increment: vi.fn().mockResolvedValue(0),
    raw: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    invoiceNumber: "INV-2026-0001",
    status: InvoiceStatus.DRAFT,
    issueDate: new Date("2026-01-15"),
    dueDate: new Date("2026-02-14"),
    currency: "INR",
    exchangeRate: 1,
    items: [],
    subtotal: 100000,
    discountAmount: 0,
    taxAmount: 18000,
    total: 118000,
    amountPaid: 0,
    amountDue: 118000,
    tdsAmount: 0,
    notes: "Test invoice",
    terms: "Net 30",
    createdBy: USER_ID,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

function makeInvoiceItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: "item-55555555-5555-5555-5555-555555555555",
    name: "Web Development",
    quantity: 1,
    rate: 100000,
    discountAmount: 0,
    taxRate: 18,
    taxAmount: 18000,
    amount: 118000,
    sortOrder: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("invoice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listInvoices ─────────────────────────────────────────────────────────

  describe("listInvoices", () => {
    it("returns paginated list of invoices", async () => {
      const invoices = [makeInvoice(), makeInvoice({ id: "inv-2", invoiceNumber: "INV-2026-0002" })];
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: invoices,
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listInvoices(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("invoices", expect.objectContaining({
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
      }));
    });

    it("applies status filter", async () => {
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await listInvoices(ORG_ID, { page: 1, limit: 20, status: InvoiceStatus.SENT });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("invoices", expect.objectContaining({
        where: { org_id: ORG_ID, status: InvoiceStatus.SENT },
      }));
    });

    it("applies client filter", async () => {
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await listInvoices(ORG_ID, { page: 1, limit: 20, clientId: CLIENT_ID });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("invoices", expect.objectContaining({
        where: { org_id: ORG_ID, client_id: CLIENT_ID },
      }));
    });

    it("filters overdue invoices in-memory", async () => {
      const pastDue = makeInvoice({
        status: InvoiceStatus.SENT,
        dueDate: new Date("2020-01-01"),
      });
      const notDue = makeInvoice({
        id: "inv-future",
        status: InvoiceStatus.SENT,
        dueDate: new Date("2099-12-31"),
      });
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: [pastDue, notDue],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listInvoices(ORG_ID, { page: 1, limit: 20, overdue: true });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].dueDate).toEqual(new Date("2020-01-01"));
    });

    it("filters by search term on invoiceNumber", async () => {
      const inv1 = makeInvoice({ invoiceNumber: "INV-2026-0042" });
      const inv2 = makeInvoice({ id: "inv-2", invoiceNumber: "INV-2026-0099" });
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: [inv1, inv2],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listInvoices(ORG_ID, { page: 1, limit: 20, search: "0042" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].invoiceNumber).toBe("INV-2026-0042");
    });

    it("filters by date range", async () => {
      const jan = makeInvoice({ issueDate: new Date("2026-01-15") });
      const mar = makeInvoice({ id: "inv-mar", issueDate: new Date("2026-03-15") });
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: [jan, mar],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listInvoices(ORG_ID, {
        page: 1,
        limit: 20,
        from: new Date("2026-02-01"),
        to: new Date("2026-04-01"),
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("inv-mar");
    });
  });

  // ── getInvoice ───────────────────────────────────────────────────────────

  describe("getInvoice", () => {
    it("returns invoice with items", async () => {
      const invoice = makeInvoice();
      const items = [makeInvoiceItem()];
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(invoice),
        findMany: vi.fn().mockResolvedValue(items),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await getInvoice(ORG_ID, INVOICE_ID);

      expect(result.id).toBe(INVOICE_ID);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Web Development");
      expect(mockDb.findById).toHaveBeenCalledWith("invoices", INVOICE_ID, ORG_ID);
      expect(mockDb.findMany).toHaveBeenCalledWith("invoice_items", expect.objectContaining({
        where: { invoice_id: INVOICE_ID },
      }));
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(getInvoice(ORG_ID, "nonexistent")).rejects.toThrow("Invoice not found");
    });
  });

  // ── createInvoice ──────────────────────────────────────────────────────

  describe("createInvoice", () => {
    it("creates invoice with items, computes totals, and updates client balance", async () => {
      const createdInvoice = makeInvoice({ total: 118000, amountDue: 118000 });
      const items = [makeInvoiceItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          // First call: validate client
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          // Second call: get org for base currency
          .mockResolvedValueOnce({ id: ORG_ID, defaultCurrency: "INR" })
          // getInvoice call at end: return invoice
          .mockResolvedValueOnce(createdInvoice),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        increment: vi.fn().mockResolvedValue(118000),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0001");

      const result = await createInvoice(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        issueDate: new Date("2026-01-15"),
        dueDate: new Date("2026-02-14"),
        currency: "INR",
        exchangeRate: 1,
        items: [
          { name: "Web Development", quantity: 1, rate: 100000, taxRate: 18 },
        ],
      } as any);

      expect(result.id).toBe(INVOICE_ID);
      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        invoiceNumber: "INV-2026-0001",
        status: InvoiceStatus.DRAFT,
        amountPaid: 0,
      }));
      expect(mockDb.createMany).toHaveBeenCalledWith("invoice_items", expect.any(Array));
      // Should update client balance via increment
      expect(mockDb.increment).toHaveBeenCalledWith(
        "clients",
        CLIENT_ID,
        "total_billed",
        expect.any(Number)
      );
      expect(mockDb.increment).toHaveBeenCalledWith(
        "clients",
        CLIENT_ID,
        "outstanding_balance",
        expect.any(Number)
      );
    });

    it("throws NotFoundError when client does not exist", async () => {
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(null),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        createInvoice(ORG_ID, USER_ID, {
          clientId: "nonexistent-client",
          issueDate: new Date(),
          dueDate: new Date(),
          currency: "INR",
          exchangeRate: 1,
          items: [{ name: "Item", quantity: 1, rate: 10000 }],
        } as any)
      ).rejects.toThrow("Client not found");
    });

    it("computes TDS amount correctly", async () => {
      // TDS = (subtotal - itemDiscounts - discountAmount) * tdsRate / 100
      // For simple: subtotal=100000, no discounts, tdsRate=10 => tdsAmount=10000
      const createdInvoice = makeInvoice({ tdsRate: 10, tdsAmount: 10000 });
      const items = [makeInvoiceItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce({ id: ORG_ID, defaultCurrency: "INR" })
          .mockResolvedValueOnce(createdInvoice),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0005");

      await createInvoice(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        issueDate: new Date("2026-01-15"),
        dueDate: new Date("2026-02-14"),
        currency: "INR",
        exchangeRate: 1,
        tdsRate: 10,
        tdsSection: "194C",
        items: [
          { name: "Consulting", quantity: 1, rate: 100000 },
        ],
      } as any);

      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        tdsRate: 10,
        tdsSection: "194C",
        tdsAmount: expect.any(Number),
      }));

      // Verify the TDS amount passed to create
      const createCall = mockDb.create.mock.calls.find(
        (c: any[]) => c[0] === "invoices"
      );
      expect(createCall).toBeDefined();
      const invoiceData = createCall![1] as Record<string, unknown>;
      // tdsBase = subtotal(100000) - itemDiscounts(0) - discountAmount(0) = 100000
      // tdsAmount = Math.round(100000 * 10 / 100) = 10000
      expect(invoiceData.tdsAmount).toBe(10000);
    });

    it("reduces product inventory when trackInventory is enabled", async () => {
      const product = {
        id: "prod-001",
        orgId: ORG_ID,
        trackInventory: true,
        stockOnHand: 50,
      };
      const createdInvoice = makeInvoice();
      const items = [makeInvoiceItem({ productId: "prod-001" })];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }) // client
          .mockResolvedValueOnce({ id: ORG_ID, defaultCurrency: "INR" }) // org
          .mockResolvedValueOnce(product) // product lookup
          .mockResolvedValueOnce(createdInvoice), // getInvoice
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0010");

      await createInvoice(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        issueDate: new Date("2026-01-15"),
        dueDate: new Date("2026-02-14"),
        currency: "INR",
        exchangeRate: 1,
        items: [
          { name: "Widget", quantity: 5, rate: 10000, productId: "prod-001" },
        ],
      } as any);

      // Should update product stock: 50 - 5 = 45
      expect(mockDb.update).toHaveBeenCalledWith(
        "products",
        "prod-001",
        expect.objectContaining({ stockOnHand: 45 }),
        ORG_ID
      );
    });

    it("creates invoice with multiple items and invoice-level discount", async () => {
      const createdInvoice = makeInvoice({ discountType: DiscountType.PERCENTAGE, discountValue: 10 });
      const items = [
        makeInvoiceItem({ name: "Item A" }),
        makeInvoiceItem({ id: "item-2", name: "Item B" }),
      ];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce({ id: ORG_ID, defaultCurrency: "INR" })
          .mockResolvedValueOnce(createdInvoice),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0020");

      const result = await createInvoice(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        issueDate: new Date("2026-01-15"),
        dueDate: new Date("2026-02-14"),
        currency: "INR",
        exchangeRate: 1,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        items: [
          { name: "Item A", quantity: 2, rate: 50000 },
          { name: "Item B", quantity: 1, rate: 30000 },
        ],
      } as any);

      expect(result).toBeDefined();
      expect(mockDb.createMany).toHaveBeenCalledWith("invoice_items", expect.any(Array));
      const itemsArg = mockDb.createMany.mock.calls[0][1] as any[];
      expect(itemsArg).toHaveLength(2);
    });
  });

  // ── updateInvoice ──────────────────────────────────────────────────────

  describe("updateInvoice", () => {
    it("updates invoice data and recomputes totals when items change", async () => {
      const existing = makeInvoice({ status: InvoiceStatus.DRAFT });
      const updatedInvoice = makeInvoice({ notes: "Updated notes", total: 59000 });
      const newItems = [makeInvoiceItem({ name: "Updated item", rate: 50000 })];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(existing) // existing lookup
          .mockResolvedValueOnce(updatedInvoice), // getInvoice after update
        findMany: vi.fn().mockResolvedValue(newItems),
        update: vi.fn().mockResolvedValue(updatedInvoice),
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await updateInvoice(ORG_ID, INVOICE_ID, {
        notes: "Updated notes",
        items: [
          { name: "Updated item", quantity: 1, rate: 50000 },
        ],
      } as any);

      expect(result).toBeDefined();
      // Old items should be deleted
      expect(mockDb.deleteMany).toHaveBeenCalledWith("invoice_items", { invoice_id: INVOICE_ID });
      // New items should be created
      expect(mockDb.createMany).toHaveBeenCalledWith("invoice_items", expect.any(Array));
      // Invoice should be updated
      expect(mockDb.update).toHaveBeenCalledWith(
        "invoices",
        INVOICE_ID,
        expect.objectContaining({ notes: "Updated notes" }),
        ORG_ID
      );
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        updateInvoice(ORG_ID, "nonexistent", { notes: "test" } as any)
      ).rejects.toThrow("Invoice not found");
    });

    it("throws BadRequestError for voided invoice", async () => {
      const voided = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(voided) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        updateInvoice(ORG_ID, INVOICE_ID, { notes: "test" } as any)
      ).rejects.toThrow("Cannot edit a voided or written-off invoice");
    });

    it("throws BadRequestError for fully paid invoice", async () => {
      const paid = makeInvoice({ status: InvoiceStatus.PAID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(paid) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        updateInvoice(ORG_ID, INVOICE_ID, { notes: "test" } as any)
      ).rejects.toThrow("Cannot edit a fully paid invoice");
    });

    it("updates only scalar fields when items are not provided", async () => {
      const existing = makeInvoice({ status: InvoiceStatus.DRAFT });
      const updatedInvoice = makeInvoice({ notes: "New notes", terms: "Net 45" });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(updatedInvoice),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(updatedInvoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await updateInvoice(ORG_ID, INVOICE_ID, {
        notes: "New notes",
        terms: "Net 45",
      } as any);

      expect(result).toBeDefined();
      // Should NOT delete items since items were not provided
      expect(mockDb.deleteMany).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledWith(
        "invoices",
        INVOICE_ID,
        expect.objectContaining({ notes: "New notes", terms: "Net 45" }),
        ORG_ID
      );
    });
  });

  // ── deleteInvoice ──────────────────────────────────────────────────────

  describe("deleteInvoice", () => {
    it("deletes a DRAFT invoice and its items", async () => {
      const draft = makeInvoice({ status: InvoiceStatus.DRAFT });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(draft),
        deleteMany: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await deleteInvoice(ORG_ID, INVOICE_ID);

      expect(mockDb.deleteMany).toHaveBeenCalledWith("invoice_items", { invoice_id: INVOICE_ID });
      expect(mockDb.delete).toHaveBeenCalledWith("invoices", INVOICE_ID, ORG_ID);
    });

    it("throws BadRequestError when deleting a SENT invoice", async () => {
      const sent = makeInvoice({ status: InvoiceStatus.SENT });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(sent) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deleteInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Only draft invoices can be deleted"
      );
    });

    it("throws BadRequestError when deleting a PAID invoice", async () => {
      const paid = makeInvoice({ status: InvoiceStatus.PAID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(paid) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deleteInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Only draft invoices can be deleted"
      );
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deleteInvoice(ORG_ID, "nonexistent")).rejects.toThrow(
        "Invoice not found"
      );
    });
  });

  // ── sendInvoice ────────────────────────────────────────────────────────

  describe("sendInvoice", () => {
    it("updates status to SENT and sets sentAt", async () => {
      const draft = makeInvoice({ status: InvoiceStatus.DRAFT });
      const sentInvoice = makeInvoice({ status: InvoiceStatus.SENT, sentAt: new Date() });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(draft),
        update: vi.fn().mockResolvedValue(sentInvoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await sendInvoice(ORG_ID, INVOICE_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        "invoices",
        INVOICE_ID,
        expect.objectContaining({
          status: InvoiceStatus.SENT,
          sentAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
        ORG_ID
      );
      expect(result.status).toBe(InvoiceStatus.SENT);
    });

    it("throws BadRequestError when sending a voided invoice", async () => {
      const voided = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(voided) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(sendInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Cannot send a voided invoice"
      );
    });

    it("throws BadRequestError when sending a paid invoice", async () => {
      const paid = makeInvoice({ status: InvoiceStatus.PAID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(paid) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(sendInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Invoice is already paid"
      );
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(sendInvoice(ORG_ID, "nonexistent")).rejects.toThrow(
        "Invoice not found"
      );
    });
  });

  // ── voidInvoice ────────────────────────────────────────────────────────

  describe("voidInvoice", () => {
    it("updates status to VOID and reverses client outstanding balance", async () => {
      const sentInvoice = makeInvoice({
        status: InvoiceStatus.SENT,
        total: 118000,
        amountPaid: 0,
      });
      const voidedInvoice = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(sentInvoice),
        update: vi.fn().mockResolvedValue(voidedInvoice),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await voidInvoice(ORG_ID, INVOICE_ID);

      // Should reverse client outstanding balance via increment
      expect(mockDb.increment).toHaveBeenCalledWith(
        "clients",
        CLIENT_ID,
        "outstanding_balance",
        -118000
      );
      // Should void the invoice
      expect(mockDb.update).toHaveBeenCalledWith(
        "invoices",
        INVOICE_ID,
        expect.objectContaining({ status: InvoiceStatus.VOID }),
        ORG_ID
      );
    });

    it("throws BadRequestError when voiding an already voided invoice", async () => {
      const voided = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(voided) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(voidInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Invoice is already voided or written off"
      );
    });

    it("throws BadRequestError when voiding a paid invoice", async () => {
      const paid = makeInvoice({ status: InvoiceStatus.PAID });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(paid) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(voidInvoice(ORG_ID, INVOICE_ID)).rejects.toThrow(
        "Cannot void a fully paid invoice"
      );
    });

    it("does not reverse client balance when invoice is fully paid (amountPaid == total)", async () => {
      // A partially-paid invoice being voided should only reverse the outstanding portion
      const partiallyPaid = makeInvoice({
        status: InvoiceStatus.PARTIALLY_PAID,
        total: 118000,
        amountPaid: 118000, // edge: paid == total but status glitch
      });
      const voidedInvoice = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(partiallyPaid),
        update: vi.fn().mockResolvedValue(voidedInvoice),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await voidInvoice(ORG_ID, INVOICE_ID);

      // outstanding = total - amountPaid = 0, so client update should NOT happen for balance
      // Only the invoice void update should be called
      const clientUpdateCalls = mockDb.update.mock.calls.filter(
        (c: any[]) => c[0] === "clients"
      );
      expect(clientUpdateCalls).toHaveLength(0);
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(voidInvoice(ORG_ID, "nonexistent")).rejects.toThrow(
        "Invoice not found"
      );
    });
  });

  // ── duplicateInvoice ───────────────────────────────────────────────────

  describe("duplicateInvoice", () => {
    it("creates a copy of the invoice with new number and DRAFT status", async () => {
      const sourceInvoice = {
        ...makeInvoice({ status: InvoiceStatus.PAID }),
        items: [makeInvoiceItem()],
      };
      const newInvoice = makeInvoice({
        id: "00000000-0000-0000-0000-000000000099",
        invoiceNumber: "INV-2026-0050",
        status: InvoiceStatus.DRAFT,
      });

      const mockDb = makeMockDb({
        findById: vi.fn()
          // getInvoice (source): findById for invoice
          .mockResolvedValueOnce(sourceInvoice)
          // getInvoice (new): findById for newly created invoice
          .mockResolvedValueOnce(newInvoice),
        findMany: vi.fn()
          // getInvoice (source): items
          .mockResolvedValueOnce(sourceInvoice.items)
          // getInvoice (new): items
          .mockResolvedValueOnce(sourceInvoice.items),
        create: vi.fn().mockResolvedValue(newInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0050");

      const result = await duplicateInvoice(ORG_ID, INVOICE_ID, USER_ID);

      expect(result.status).toBe(InvoiceStatus.DRAFT);
      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        orgId: ORG_ID,
        invoiceNumber: "INV-2026-0050",
        status: InvoiceStatus.DRAFT,
        amountPaid: 0,
        createdBy: USER_ID,
      }));
      expect(mockDb.createMany).toHaveBeenCalledWith("invoice_items", expect.any(Array));
    });

    it("copies amountDue equal to total (not from source)", async () => {
      const sourceInvoice = {
        ...makeInvoice({
          status: InvoiceStatus.PARTIALLY_PAID,
          total: 118000,
          amountPaid: 50000,
          amountDue: 68000,
        }),
        items: [makeInvoiceItem()],
      };
      const newInvoice = makeInvoice({
        id: "00000000-0000-0000-0000-000000000099",
        invoiceNumber: "INV-2026-0051",
        status: InvoiceStatus.DRAFT,
        total: 118000,
        amountPaid: 0,
        amountDue: 118000,
      });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(sourceInvoice)
          .mockResolvedValueOnce(newInvoice),
        findMany: vi.fn()
          .mockResolvedValueOnce(sourceInvoice.items)
          .mockResolvedValueOnce(sourceInvoice.items),
        create: vi.fn().mockResolvedValue(newInvoice),
        createMany: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);
      mockedNextInvoiceNumber.mockResolvedValue("INV-2026-0051");

      await duplicateInvoice(ORG_ID, INVOICE_ID, USER_ID);

      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        amountPaid: 0,
        amountDue: 118000, // should be total, not source's amountDue
      }));
    });

    it("throws NotFoundError when source invoice does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(duplicateInvoice(ORG_ID, "nonexistent", USER_ID)).rejects.toThrow(
        "Invoice not found"
      );
    });
  });
});
