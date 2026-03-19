import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditNoteStatus, InvoiceStatus } from "@emp-billing/shared";
import type { CreditNote, Invoice } from "@emp-billing/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("../../utils/pdf", () => ({
  generateCreditNotePdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "00000000-0000-0000-0000-000000000099"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listCreditNotes,
  getCreditNote,
  createCreditNote,
  applyCreditNote,
  voidCreditNote,
  deleteCreditNote,
} from "./credit-note.service";

const mockedGetDB = vi.mocked(getDB);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-11111111-1111-1111-1111-111111111111";
const USER_ID = "usr-22222222-2222-2222-2222-222222222222";
const CLIENT_ID = "cli-33333333-3333-3333-3333-333333333333";
const CREDIT_NOTE_ID = "cn-44444444-4444-4444-4444-444444444444";
const INVOICE_ID = "inv-55555555-5555-5555-5555-555555555555";

interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  orgId: string;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
  sortOrder: number;
}

function makeMockDb(overrides: Record<string, unknown> = {}) {
  return {
    findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((_table: string, data: Record<string, unknown>) => Promise.resolve(data)),
    createMany: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockImplementation((_table: string, _id: string, data: Record<string, unknown>) => Promise.resolve(data)),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    increment: vi.fn().mockResolvedValue(0),
    raw: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeCreditNote(overrides: Partial<CreditNote> = {}): CreditNote {
  return {
    id: CREDIT_NOTE_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    creditNoteNumber: "CN-2026-0001",
    status: CreditNoteStatus.OPEN,
    date: new Date("2026-02-01"),
    items: [],
    subtotal: 50000,
    taxAmount: 9000,
    total: 59000,
    balance: 59000,
    reason: "Goods returned",
    createdBy: USER_ID,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
    ...overrides,
  };
}

function makeCreditNoteItem(overrides: Partial<CreditNoteItem> = {}): CreditNoteItem {
  return {
    id: "cni-66666666-6666-6666-6666-666666666666",
    creditNoteId: CREDIT_NOTE_ID,
    orgId: ORG_ID,
    name: "Returned Widget",
    quantity: 1,
    rate: 50000,
    discountAmount: 0,
    taxRate: 18,
    taxAmount: 9000,
    amount: 59000,
    sortOrder: 0,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    invoiceNumber: "INV-2026-0001",
    status: InvoiceStatus.SENT,
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
    createdBy: USER_ID,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("credit-note.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listCreditNotes ────────────────────────────────────────────────────

  describe("listCreditNotes", () => {
    it("returns paginated list of credit notes", async () => {
      const creditNotes = [
        makeCreditNote(),
        makeCreditNote({ id: "cn-2", creditNoteNumber: "CN-2026-0002" }),
      ];
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: creditNotes,
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
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

      await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
        status: CreditNoteStatus.OPEN,
      });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
        where: { org_id: ORG_ID, status: CreditNoteStatus.OPEN },
      }));
    });

    it("applies client filter", async () => {
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
        clientId: CLIENT_ID,
      });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
        where: { org_id: ORG_ID, client_id: CLIENT_ID },
      }));
    });

    it("filters by date range", async () => {
      const jan = makeCreditNote({ date: new Date("2026-01-10") });
      const mar = makeCreditNote({ id: "cn-mar", date: new Date("2026-03-10") });
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

      const result = await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
        from: new Date("2026-02-01"),
        to: new Date("2026-04-01"),
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("cn-mar");
    });

    it("filters by search term on creditNoteNumber", async () => {
      const cn1 = makeCreditNote({ creditNoteNumber: "CN-2026-0042" });
      const cn2 = makeCreditNote({ id: "cn-2", creditNoteNumber: "CN-2026-0099" });
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: [cn1, cn2],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
        search: "0042",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].creditNoteNumber).toBe("CN-2026-0042");
    });

    it("filters by search term on reason", async () => {
      const cn1 = makeCreditNote({ reason: "Goods returned - defective" });
      const cn2 = makeCreditNote({ id: "cn-2", reason: "Pricing error adjustment" });
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: [cn1, cn2],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listCreditNotes(ORG_ID, {
        page: 1,
        limit: 20,
        sortOrder: "desc",
        search: "defective",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].reason).toContain("defective");
    });
  });

  // ── getCreditNote ──────────────────────────────────────────────────────

  describe("getCreditNote", () => {
    it("returns credit note with items", async () => {
      const creditNote = makeCreditNote();
      const items = [makeCreditNoteItem()];
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(creditNote),
        findMany: vi.fn().mockResolvedValue(items),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await getCreditNote(ORG_ID, CREDIT_NOTE_ID);

      expect(result.id).toBe(CREDIT_NOTE_ID);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Returned Widget");
      expect(mockDb.findById).toHaveBeenCalledWith("credit_notes", CREDIT_NOTE_ID, ORG_ID);
      expect(mockDb.findMany).toHaveBeenCalledWith("credit_note_items", expect.objectContaining({
        where: { credit_note_id: CREDIT_NOTE_ID },
      }));
    });

    it("throws NotFoundError when credit note does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(getCreditNote(ORG_ID, "nonexistent")).rejects.toThrow(
        "Credit note not found"
      );
    });
  });

  // ── createCreditNote ───────────────────────────────────────────────────

  describe("createCreditNote", () => {
    it("creates credit note with items and computes totals", async () => {
      const createdCreditNote = makeCreditNote();
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }) // client
          .mockResolvedValueOnce(createdCreditNote), // getCreditNote
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdCreditNote),
        createMany: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await createCreditNote(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        date: new Date("2026-02-01"),
        reason: "Goods returned",
        items: [
          { name: "Returned Widget", quantity: 1, rate: 50000 },
        ],
      } as any);

      expect(result.id).toBe(CREDIT_NOTE_ID);
      // Should create credit note record
      expect(mockDb.create).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        status: CreditNoteStatus.OPEN,
        reason: "Goods returned",
      }));
      // Should create items
      expect(mockDb.createMany).toHaveBeenCalledWith("credit_note_items", expect.any(Array));
    });

    it("throws NotFoundError when client does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        createCreditNote(ORG_ID, USER_ID, {
          clientId: "nonexistent-client",
          date: new Date(),
          items: [{ name: "Item", quantity: 1, rate: 10000 }],
        } as any)
      ).rejects.toThrow("Client not found");
    });

    it("creates credit note with multiple items", async () => {
      const createdCreditNote = makeCreditNote({ subtotal: 80000, total: 94400 });
      const items = [
        makeCreditNoteItem({ name: "Item A" }),
        makeCreditNoteItem({ id: "cni-2", name: "Item B" }),
      ];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(createdCreditNote),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdCreditNote),
        createMany: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await createCreditNote(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        date: new Date("2026-02-01"),
        items: [
          { name: "Item A", quantity: 2, rate: 25000 },
          { name: "Item B", quantity: 1, rate: 30000 },
        ],
      } as any);

      expect(result).toBeDefined();
      const itemsArg = mockDb.createMany.mock.calls[0][1] as any[];
      expect(itemsArg).toHaveLength(2);
    });

    it("sets balance equal to total on creation", async () => {
      const createdCreditNote = makeCreditNote({ total: 59000, balance: 59000 });
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(createdCreditNote),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdCreditNote),
        createMany: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await createCreditNote(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        date: new Date("2026-02-01"),
        items: [{ name: "Widget", quantity: 1, rate: 50000 }],
      } as any);

      // The create call should have balance === total
      const createCall = mockDb.create.mock.calls.find(
        (c: any[]) => c[0] === "credit_notes"
      );
      expect(createCall).toBeDefined();
      const cnData = createCall![1] as Record<string, unknown>;
      expect(cnData.balance).toBe(cnData.total);
    });

    it("generates auto-incremented credit note number", async () => {
      const createdCreditNote = makeCreditNote();
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(createdCreditNote),
        findMany: vi.fn().mockResolvedValue(items),
        create: vi.fn().mockResolvedValue(createdCreditNote),
        createMany: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(5), // 5 existing credit notes
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await createCreditNote(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        date: new Date("2026-02-01"),
        items: [{ name: "Item", quantity: 1, rate: 10000 }],
      } as any);

      const createCall = mockDb.create.mock.calls.find(
        (c: any[]) => c[0] === "credit_notes"
      );
      const cnData = createCall![1] as Record<string, unknown>;
      const year = new Date().getFullYear();
      expect(cnData.creditNoteNumber).toBe(`CN-${year}-0006`);
    });
  });

  // ── applyCreditNote ────────────────────────────────────────────────────

  describe("applyCreditNote", () => {
    it("applies full credit to invoice, reducing both balances", async () => {
      const creditNote = makeCreditNote({ total: 59000, balance: 59000 });
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const updatedCreditNote = makeCreditNote({ balance: 0, status: CreditNoteStatus.APPLIED });
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote) // credit note lookup
          .mockResolvedValueOnce(invoice) // invoice lookup
          .mockResolvedValueOnce(updatedCreditNote), // getCreditNote after update
        findMany: vi.fn().mockResolvedValue(items),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
        invoiceId: INVOICE_ID,
        amount: 59000,
      } as any);

      // Credit note balance should be reduced to 0
      expect(mockDb.update).toHaveBeenCalledWith("credit_notes", CREDIT_NOTE_ID, expect.objectContaining({
        balance: 0,
        status: CreditNoteStatus.APPLIED,
      }), ORG_ID);

      // Invoice should be partially paid
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 59000,
        amountDue: 59000,
        status: InvoiceStatus.PARTIALLY_PAID,
        paidAt: null,
      }), ORG_ID);
    });

    it("applies partial credit, keeping credit note OPEN", async () => {
      const creditNote = makeCreditNote({ total: 59000, balance: 59000 });
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const updatedCreditNote = makeCreditNote({ balance: 29000, status: CreditNoteStatus.OPEN });
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote)
          .mockResolvedValueOnce(invoice)
          .mockResolvedValueOnce(updatedCreditNote),
        findMany: vi.fn().mockResolvedValue(items),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
        invoiceId: INVOICE_ID,
        amount: 30000,
      } as any);

      // Credit note balance should be 59000 - 30000 = 29000
      expect(mockDb.update).toHaveBeenCalledWith("credit_notes", CREDIT_NOTE_ID, expect.objectContaining({
        balance: 29000,
        status: CreditNoteStatus.OPEN,
      }), ORG_ID);
    });

    it("fully pays invoice when credit covers remaining amount", async () => {
      const creditNote = makeCreditNote({ total: 100000, balance: 100000 });
      const invoice = makeInvoice({
        total: 118000,
        amountPaid: 68000,
        amountDue: 50000,
      });
      const updatedCreditNote = makeCreditNote({ balance: 50000 });
      const items = [makeCreditNoteItem()];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote)
          .mockResolvedValueOnce(invoice)
          .mockResolvedValueOnce(updatedCreditNote),
        findMany: vi.fn().mockResolvedValue(items),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
        invoiceId: INVOICE_ID,
        amount: 50000,
      } as any);

      // Invoice should be marked PAID: amountPaid = 68000 + 50000 = 118000
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 118000,
        amountDue: 0,
        status: InvoiceStatus.PAID,
        paidAt: expect.any(Date),
      }), ORG_ID);
    });

    it("throws when credit amount exceeds invoice amount due", async () => {
      const creditNote = makeCreditNote({ total: 200000, balance: 200000 });
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote)
          .mockResolvedValueOnce(invoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: INVOICE_ID,
          amount: 150000,
        } as any)
      ).rejects.toThrow("Amount exceeds invoice balance");
    });

    it("throws when credit amount exceeds credit note balance", async () => {
      const creditNote = makeCreditNote({ total: 50000, balance: 20000 });

      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValueOnce(creditNote),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: INVOICE_ID,
          amount: 30000,
        } as any)
      ).rejects.toThrow("Amount exceeds credit note balance");
    });

    it("throws when credit note is not OPEN", async () => {
      const applied = makeCreditNote({ status: CreditNoteStatus.APPLIED, balance: 0 });

      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValueOnce(applied),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: INVOICE_ID,
          amount: 10000,
        } as any)
      ).rejects.toThrow("Only open credit notes can be applied");
    });

    it("throws NotFoundError when credit note does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, "nonexistent", {
          invoiceId: INVOICE_ID,
          amount: 10000,
        } as any)
      ).rejects.toThrow("Credit note not found");
    });

    it("throws NotFoundError when target invoice does not exist", async () => {
      const creditNote = makeCreditNote();

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote) // credit note found
          .mockResolvedValueOnce(null), // invoice not found
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: "nonexistent-invoice",
          amount: 10000,
        } as any)
      ).rejects.toThrow("Invoice not found");
    });

    it("throws when applying to a voided invoice", async () => {
      const creditNote = makeCreditNote();
      const voidedInvoice = makeInvoice({ status: InvoiceStatus.VOID });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote)
          .mockResolvedValueOnce(voidedInvoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: INVOICE_ID,
          amount: 10000,
        } as any)
      ).rejects.toThrow("Cannot apply credit to a voided, written-off, or fully paid invoice");
    });

    it("throws when applying to a fully paid invoice", async () => {
      const creditNote = makeCreditNote();
      const paidInvoice = makeInvoice({
        status: InvoiceStatus.PAID,
        amountPaid: 118000,
        amountDue: 0,
      });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(creditNote)
          .mockResolvedValueOnce(paidInvoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        applyCreditNote(ORG_ID, CREDIT_NOTE_ID, {
          invoiceId: INVOICE_ID,
          amount: 10000,
        } as any)
      ).rejects.toThrow("Cannot apply credit to a voided, written-off, or fully paid invoice");
    });
  });

  // ── voidCreditNote ─────────────────────────────────────────────────────

  describe("voidCreditNote", () => {
    it("voids an OPEN credit note", async () => {
      const openCN = makeCreditNote({ status: CreditNoteStatus.OPEN });
      const voidedCN = makeCreditNote({ status: CreditNoteStatus.VOID });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(openCN),
        update: vi.fn().mockResolvedValue(voidedCN),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await voidCreditNote(ORG_ID, CREDIT_NOTE_ID);

      expect(result.status).toBe(CreditNoteStatus.VOID);
      expect(mockDb.update).toHaveBeenCalledWith("credit_notes", CREDIT_NOTE_ID, expect.objectContaining({
        status: CreditNoteStatus.VOID,
      }), ORG_ID);
    });

    it("voids a DRAFT credit note", async () => {
      const draftCN = makeCreditNote({ status: CreditNoteStatus.DRAFT });
      const voidedCN = makeCreditNote({ status: CreditNoteStatus.VOID });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(draftCN),
        update: vi.fn().mockResolvedValue(voidedCN),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await voidCreditNote(ORG_ID, CREDIT_NOTE_ID);

      expect(result.status).toBe(CreditNoteStatus.VOID);
    });

    it("throws BadRequestError when voiding an APPLIED credit note", async () => {
      const applied = makeCreditNote({ status: CreditNoteStatus.APPLIED });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(applied) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(voidCreditNote(ORG_ID, CREDIT_NOTE_ID)).rejects.toThrow(
        "Only open or draft credit notes can be voided"
      );
    });

    it("throws NotFoundError when credit note does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(voidCreditNote(ORG_ID, "nonexistent")).rejects.toThrow(
        "Credit note not found"
      );
    });
  });

  // ── deleteCreditNote ───────────────────────────────────────────────────

  describe("deleteCreditNote", () => {
    it("deletes a DRAFT credit note and its items", async () => {
      const draft = makeCreditNote({ status: CreditNoteStatus.DRAFT });
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(draft),
        deleteMany: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await deleteCreditNote(ORG_ID, CREDIT_NOTE_ID);

      expect(mockDb.deleteMany).toHaveBeenCalledWith("credit_note_items", { credit_note_id: CREDIT_NOTE_ID });
      expect(mockDb.delete).toHaveBeenCalledWith("credit_notes", CREDIT_NOTE_ID, ORG_ID);
    });

    it("throws BadRequestError when deleting a non-draft credit note", async () => {
      const open = makeCreditNote({ status: CreditNoteStatus.OPEN });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(open) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deleteCreditNote(ORG_ID, CREDIT_NOTE_ID)).rejects.toThrow(
        "Only draft credit notes can be deleted"
      );
    });

    it("throws NotFoundError when credit note does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deleteCreditNote(ORG_ID, "nonexistent")).rejects.toThrow(
        "Credit note not found"
      );
    });
  });
});
