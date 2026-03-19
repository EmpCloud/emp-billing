import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceStatus, PaymentMethod, CreditNoteStatus } from "@emp-billing/shared";
import type { Payment, Invoice, CreditNote } from "@emp-billing/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

vi.mock("../../utils/pdf", () => ({
  generateReceiptPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "00000000-0000-0000-0000-000000000099"),
}));

import { getDB } from "../../db/adapters/index";
import {
  listPayments,
  getPayment,
  recordPayment,
  refundPayment,
  deletePayment,
} from "./payment.service";

const mockedGetDB = vi.mocked(getDB);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-11111111-1111-1111-1111-111111111111";
const USER_ID = "usr-22222222-2222-2222-2222-222222222222";
const CLIENT_ID = "cli-33333333-3333-3333-3333-333333333333";
const INVOICE_ID = "inv-44444444-4444-4444-4444-444444444444";
const PAYMENT_ID = "pay-55555555-5555-5555-5555-555555555555";

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

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    orgId: ORG_ID,
    clientId: CLIENT_ID,
    paymentNumber: "PAY-2026-0001",
    date: new Date("2026-02-01"),
    amount: 118000,
    method: PaymentMethod.BANK_TRANSFER,
    isRefund: false,
    refundedAmount: 0,
    createdBy: USER_ID,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
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

describe("payment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listPayments ───────────────────────────────────────────────────────

  describe("listPayments", () => {
    it("returns paginated list of payments", async () => {
      const payments = [makePayment(), makePayment({ id: "pay-2", paymentNumber: "PAY-2026-0002" })];
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({
          data: payments,
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await listPayments(ORG_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockDb.findPaginated).toHaveBeenCalledWith("payments", expect.objectContaining({
        where: expect.objectContaining({ org_id: ORG_ID, is_refund: false }),
      }));
    });

    it("applies client filter", async () => {
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await listPayments(ORG_ID, { page: 1, limit: 20, clientId: CLIENT_ID });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("payments", expect.objectContaining({
        where: expect.objectContaining({ client_id: CLIENT_ID }),
      }));
    });

    it("applies method filter", async () => {
      const mockDb = makeMockDb({
        findPaginated: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await listPayments(ORG_ID, { page: 1, limit: 20, method: PaymentMethod.UPI });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("payments", expect.objectContaining({
        where: expect.objectContaining({ method: PaymentMethod.UPI }),
      }));
    });

    it("filters by date range", async () => {
      const jan = makePayment({ date: new Date("2026-01-10") });
      const mar = makePayment({ id: "pay-mar", date: new Date("2026-03-10") });
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

      const result = await listPayments(ORG_ID, {
        page: 1,
        limit: 20,
        from: new Date("2026-02-01"),
        to: new Date("2026-04-01"),
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("pay-mar");
    });
  });

  // ── getPayment ─────────────────────────────────────────────────────────

  describe("getPayment", () => {
    it("returns payment by id", async () => {
      const payment = makePayment();
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(payment) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await getPayment(ORG_ID, PAYMENT_ID);

      expect(result.id).toBe(PAYMENT_ID);
      expect(result.amount).toBe(118000);
      expect(mockDb.findById).toHaveBeenCalledWith("payments", PAYMENT_ID, ORG_ID);
    });

    it("throws NotFoundError when payment does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(getPayment(ORG_ID, "nonexistent")).rejects.toThrow("Payment not found");
    });
  });

  // ── recordPayment ──────────────────────────────────────────────────────

  describe("recordPayment", () => {
    it("creates payment and allocates full amount to invoice", async () => {
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const createdPayment = makePayment({ amount: 118000 });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }) // client
          .mockResolvedValueOnce(invoice), // invoice
        create: vi.fn().mockResolvedValue(createdPayment),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await recordPayment(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        invoiceId: INVOICE_ID,
        date: new Date("2026-02-01"),
        amount: 118000,
        method: PaymentMethod.BANK_TRANSFER,
      } as any);

      expect(result.amount).toBe(118000);
      // Should create payment
      expect(mockDb.create).toHaveBeenCalledWith("payments", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        amount: 118000,
        method: PaymentMethod.BANK_TRANSFER,
        isRefund: false,
      }));
      // Should create allocation
      expect(mockDb.create).toHaveBeenCalledWith("payment_allocations", expect.objectContaining({
        invoiceId: INVOICE_ID,
        amount: 118000,
      }));
      // Should update invoice to PAID
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 118000,
        amountDue: 0,
        status: InvoiceStatus.PAID,
        paidAt: expect.any(Date),
      }), ORG_ID);
    });

    it("partial payment updates amountPaid and amountDue correctly", async () => {
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const createdPayment = makePayment({ amount: 50000 });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(invoice),
        create: vi.fn().mockResolvedValue(createdPayment),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await recordPayment(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        invoiceId: INVOICE_ID,
        date: new Date("2026-02-01"),
        amount: 50000,
        method: PaymentMethod.BANK_TRANSFER,
      } as any);

      expect(result.amount).toBe(50000);
      // Invoice should be partially paid
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 50000,
        amountDue: 68000,
        status: InvoiceStatus.PARTIALLY_PAID,
        paidAt: null, // not fully paid
      }), ORG_ID);
    });

    it("overpayment creates credit note for excess amount", async () => {
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const createdPayment = makePayment({ amount: 150000 });
      const creditNote = {
        id: "00000000-0000-0000-0000-000000000099",
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        creditNoteNumber: "CN-2026-0001",
        status: CreditNoteStatus.OPEN,
        total: 32000,
        balance: 32000,
      };

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(invoice),
        create: vi.fn()
          .mockResolvedValueOnce(createdPayment) // payment
          .mockResolvedValueOnce(undefined) // allocation
          .mockResolvedValueOnce(creditNote) // credit note
          .mockResolvedValueOnce(undefined), // credit note item
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn()
          .mockResolvedValueOnce(0) // payment number
          .mockResolvedValueOnce(0), // credit note number
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await recordPayment(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        invoiceId: INVOICE_ID,
        date: new Date("2026-02-01"),
        amount: 150000,
        method: PaymentMethod.BANK_TRANSFER,
      } as any);

      // Overpayment = 150000 - 118000 = 32000
      // Invoice should be fully paid (allocated = 118000)
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 118000,
        amountDue: 0,
        status: InvoiceStatus.PAID,
      }), ORG_ID);

      // Credit note should be created for excess
      expect(mockDb.create).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        status: CreditNoteStatus.OPEN,
        total: 32000,
        balance: 32000,
      }));

      // Credit note item should be created
      expect(mockDb.create).toHaveBeenCalledWith("credit_note_items", expect.objectContaining({
        name: "Overpayment credit",
        amount: 32000,
        rate: 32000,
        quantity: 1,
      }));

      // Result should contain the credit note
      expect(result.creditNote).toBeDefined();
    });

    it("throws NotFoundError when invoice does not exist", async () => {
      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }) // client found
          .mockResolvedValueOnce(null), // invoice not found
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        recordPayment(ORG_ID, USER_ID, {
          clientId: CLIENT_ID,
          invoiceId: "nonexistent-invoice",
          date: new Date(),
          amount: 50000,
          method: PaymentMethod.BANK_TRANSFER,
        } as any)
      ).rejects.toThrow("Invoice not found");
    });

    it("throws NotFoundError when client does not exist", async () => {
      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(null),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        recordPayment(ORG_ID, USER_ID, {
          clientId: "nonexistent-client",
          date: new Date(),
          amount: 50000,
          method: PaymentMethod.BANK_TRANSFER,
        } as any)
      ).rejects.toThrow("Client not found");
    });

    it("throws BadRequestError for voided invoice", async () => {
      const voidedInvoice = makeInvoice({ status: InvoiceStatus.VOID });
      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(voidedInvoice),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        recordPayment(ORG_ID, USER_ID, {
          clientId: CLIENT_ID,
          invoiceId: INVOICE_ID,
          date: new Date(),
          amount: 50000,
          method: PaymentMethod.BANK_TRANSFER,
        } as any)
      ).rejects.toThrow("Cannot record payment against a voided or written-off invoice");
    });

    it("throws BadRequestError for written-off invoice", async () => {
      const writtenOff = makeInvoice({ status: InvoiceStatus.WRITTEN_OFF });
      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(writtenOff),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        recordPayment(ORG_ID, USER_ID, {
          clientId: CLIENT_ID,
          invoiceId: INVOICE_ID,
          date: new Date(),
          amount: 50000,
          method: PaymentMethod.BANK_TRANSFER,
        } as any)
      ).rejects.toThrow("Cannot record payment against a voided or written-off invoice");
    });

    it("records payment without invoice allocation when no invoiceId", async () => {
      const createdPayment = makePayment({ amount: 75000 });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID }), // client
        create: vi.fn().mockResolvedValue(createdPayment),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await recordPayment(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        date: new Date("2026-02-01"),
        amount: 75000,
        method: PaymentMethod.CASH,
      } as any);

      expect(result.amount).toBe(75000);
      // Should create payment but NOT allocation
      expect(mockDb.create).toHaveBeenCalledTimes(1); // only payment
      // Invoice update should NOT happen
      const invoiceUpdateCalls = mockDb.update.mock.calls.filter(
        (c: any[]) => c[0] === "invoices"
      );
      expect(invoiceUpdateCalls).toHaveLength(0);
      // Client balance should still be updated
      expect(mockDb.update).toHaveBeenCalledWith("clients", CLIENT_ID, expect.any(Object), ORG_ID);
    });

    it("updates client balances: totalPaid and outstandingBalance", async () => {
      const invoice = makeInvoice({ total: 118000, amountPaid: 0, amountDue: 118000 });
      const createdPayment = makePayment({ amount: 118000 });

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce({ id: CLIENT_ID, orgId: ORG_ID })
          .mockResolvedValueOnce(invoice),
        create: vi.fn().mockResolvedValue(createdPayment),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await recordPayment(ORG_ID, USER_ID, {
        clientId: CLIENT_ID,
        invoiceId: INVOICE_ID,
        date: new Date("2026-02-01"),
        amount: 118000,
        method: PaymentMethod.BANK_TRANSFER,
      } as any);

      // Client should be updated with payment amount
      expect(mockDb.update).toHaveBeenCalledWith("clients", CLIENT_ID, expect.objectContaining({
        updatedAt: expect.any(Date),
      }), ORG_ID);
      // Increment should be called for totalPaid and outstandingBalance
      expect(mockDb.increment).toHaveBeenCalledWith("clients", CLIENT_ID, "total_paid", 118000);
      expect(mockDb.increment).toHaveBeenCalledWith("clients", CLIENT_ID, "outstanding_balance", -118000);
    });
  });

  // ── refundPayment ──────────────────────────────────────────────────────

  describe("refundPayment", () => {
    it("creates refund record and reverses client balances", async () => {
      const originalPayment = makePayment({ amount: 118000, refundedAmount: 0 });
      const refundRecord = makePayment({
        id: "00000000-0000-0000-0000-000000000099",
        amount: 118000,
        isRefund: true,
      });

      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(originalPayment),
        create: vi.fn().mockResolvedValue(refundRecord),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await refundPayment(ORG_ID, PAYMENT_ID, USER_ID, {
        amount: 118000,
        reason: "Customer requested refund",
      } as any);

      expect(result.isRefund).toBe(true);
      expect(result.amount).toBe(118000);

      // Refund payment should be created
      expect(mockDb.create).toHaveBeenCalledWith("payments", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        amount: 118000,
        isRefund: true,
      }));

      // Original payment refundedAmount should be updated
      expect(mockDb.update).toHaveBeenCalledWith("payments", PAYMENT_ID, expect.objectContaining({
        refundedAmount: 118000,
      }), ORG_ID);

      // Client balances should be reversed
      expect(mockDb.increment).toHaveBeenCalledWith("clients", CLIENT_ID, "total_paid", -118000);
      expect(mockDb.increment).toHaveBeenCalledWith("clients", CLIENT_ID, "outstanding_balance", 118000);
    });

    it("allows partial refund", async () => {
      const originalPayment = makePayment({ amount: 118000, refundedAmount: 0 });
      const refundRecord = makePayment({
        id: "00000000-0000-0000-0000-000000000099",
        amount: 50000,
        isRefund: true,
      });

      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(originalPayment),
        create: vi.fn().mockResolvedValue(refundRecord),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      const result = await refundPayment(ORG_ID, PAYMENT_ID, USER_ID, {
        amount: 50000,
      } as any);

      expect(result.amount).toBe(50000);
      expect(mockDb.update).toHaveBeenCalledWith("payments", PAYMENT_ID, expect.objectContaining({
        refundedAmount: 50000,
      }), ORG_ID);
    });

    it("throws when refund amount exceeds refundable balance", async () => {
      const partiallyRefunded = makePayment({ amount: 118000, refundedAmount: 100000 });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(partiallyRefunded) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      // maxRefund = 118000 - 100000 = 18000
      await expect(
        refundPayment(ORG_ID, PAYMENT_ID, USER_ID, { amount: 50000 } as any)
      ).rejects.toThrow("Refund amount exceeds refundable balance of 18000");
    });

    it("throws NotFoundError when payment does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        refundPayment(ORG_ID, "nonexistent", USER_ID, { amount: 50000 } as any)
      ).rejects.toThrow("Payment not found");
    });

    it("throws BadRequestError when trying to refund a refund", async () => {
      const refund = makePayment({ isRefund: true });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(refund) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(
        refundPayment(ORG_ID, PAYMENT_ID, USER_ID, { amount: 50000 } as any)
      ).rejects.toThrow("Cannot refund a refund");
    });

    it("accumulates refundedAmount across multiple partial refunds", async () => {
      const previouslyRefunded = makePayment({ amount: 118000, refundedAmount: 30000 });
      const refundRecord = makePayment({
        id: "00000000-0000-0000-0000-000000000099",
        amount: 40000,
        isRefund: true,
      });

      const mockDb = makeMockDb({
        findById: vi.fn().mockResolvedValue(previouslyRefunded),
        create: vi.fn().mockResolvedValue(refundRecord),
        update: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(2),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await refundPayment(ORG_ID, PAYMENT_ID, USER_ID, { amount: 40000 } as any);

      // Should accumulate: 30000 + 40000 = 70000
      expect(mockDb.update).toHaveBeenCalledWith("payments", PAYMENT_ID, expect.objectContaining({
        refundedAmount: 70000,
      }), ORG_ID);
    });
  });

  // ── deletePayment ──────────────────────────────────────────────────────

  describe("deletePayment", () => {
    it("deletes payment and reverses invoice allocations", async () => {
      const payment = makePayment({ amount: 50000 });
      const invoice = makeInvoice({ amountPaid: 50000, amountDue: 68000 });
      const allocations = [{ invoiceId: INVOICE_ID, amount: 50000 }];

      const mockDb = makeMockDb({
        findById: vi.fn()
          .mockResolvedValueOnce(payment) // payment
          .mockResolvedValueOnce(invoice), // invoice for allocation reversal
        findMany: vi.fn().mockResolvedValue(allocations),
        update: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        increment: vi.fn().mockResolvedValue(0),
      });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await deletePayment(ORG_ID, PAYMENT_ID);

      // Should reverse allocation on invoice
      expect(mockDb.update).toHaveBeenCalledWith("invoices", INVOICE_ID, expect.objectContaining({
        amountPaid: 0,
        amountDue: 118000,
        status: InvoiceStatus.SENT,
        paidAt: null,
      }), ORG_ID);
      // Should delete allocations
      expect(mockDb.deleteMany).toHaveBeenCalledWith("payment_allocations", { payment_id: PAYMENT_ID });
      // Should delete the payment
      expect(mockDb.delete).toHaveBeenCalledWith("payments", PAYMENT_ID, ORG_ID);
    });

    it("throws NotFoundError when payment does not exist", async () => {
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(null) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deletePayment(ORG_ID, "nonexistent")).rejects.toThrow("Payment not found");
    });

    it("throws BadRequestError when deleting a refund record", async () => {
      const refund = makePayment({ isRefund: true });
      const mockDb = makeMockDb({ findById: vi.fn().mockResolvedValue(refund) });
      mockedGetDB.mockResolvedValue(mockDb as any);

      await expect(deletePayment(ORG_ID, PAYMENT_ID)).rejects.toThrow(
        "Cannot delete a refund record directly"
      );
    });
  });
});
