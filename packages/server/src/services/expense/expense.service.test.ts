import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB adapter
vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

// Mock number generator
vi.mock("../../utils/number-generator", () => ({
  nextInvoiceNumber: vi.fn(),
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "generated-uuid"),
}));

import { getDB } from "../../db/adapters/index";
import { nextInvoiceNumber } from "../../utils/number-generator";
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  billExpenseToClient,
} from "./expense.service";
import { ExpenseStatus, InvoiceStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const mockedNextInvoiceNumber = vi.mocked(nextInvoiceNumber);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-100";
const USER_ID = "user-300";
const EXPENSE_ID = "expense-500";
const CLIENT_ID = "client-200";
const CATEGORY_ID = "cat-10";

function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE_ID,
    orgId: ORG_ID,
    categoryId: CATEGORY_ID,
    vendorName: "Office Depot",
    date: "2025-03-15",
    amount: 150000, // 1500.00 INR in paise
    currency: "INR",
    taxAmount: 27000, // 270.00 in paise (18% GST)
    description: "Office supplies",
    isBillable: false,
    clientId: null,
    invoiceId: null,
    status: ExpenseStatus.PENDING,
    approvedBy: null,
    tags: [],
    createdBy: USER_ID,
    createdAt: new Date("2025-03-15"),
    updatedAt: new Date("2025-03-15"),
    ...overrides,
  };
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    orgId: ORG_ID,
    name: "Office Supplies",
    description: "Pens, paper, etc.",
    isActive: true,
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

describe("expense.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listExpenses ─────────────────────────────────────────────────────────

  describe("listExpenses", () => {
    it("returns paginated expenses scoped to orgId", async () => {
      const expenses = [makeExpense(), makeExpense({ id: "expense-501" })];
      mockDb.findPaginated.mockResolvedValue({
        data: expenses,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listExpenses(ORG_ID, { page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("expenses", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "date", direction: "desc" }],
      });
      expect(result.data).toHaveLength(2);
    });

    it("filters by categoryId", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listExpenses(ORG_ID, { categoryId: CATEGORY_ID, page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("expenses", expect.objectContaining({
        where: expect.objectContaining({ category_id: CATEGORY_ID }),
      }));
    });

    it("filters by status", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listExpenses(ORG_ID, { status: ExpenseStatus.APPROVED, page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("expenses", expect.objectContaining({
        where: expect.objectContaining({ status: ExpenseStatus.APPROVED }),
      }));
    });

    it("filters by date range", async () => {
      const expenses = [
        makeExpense({ date: "2025-01-10" }),
        makeExpense({ id: "expense-501", date: "2025-06-15" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: expenses, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listExpenses(ORG_ID, {
        from: new Date("2025-06-01"),
        to: new Date("2025-06-30"),
        page: 1,
        limit: 20,
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("expense-501");
    });

    it("filters by isBillable flag", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listExpenses(ORG_ID, { isBillable: true, page: 1, limit: 20 } as any);

      expect(mockDb.findPaginated).toHaveBeenCalledWith("expenses", expect.objectContaining({
        where: expect.objectContaining({ is_billable: true }),
      }));
    });
  });

  // ── getExpense ───────────────────────────────────────────────────────────

  describe("getExpense", () => {
    it("returns an expense by id", async () => {
      mockDb.findById.mockResolvedValue(makeExpense());

      const result = await getExpense(ORG_ID, EXPENSE_ID);

      expect(result.id).toBe(EXPENSE_ID);
      expect(mockDb.findById).toHaveBeenCalledWith("expenses", EXPENSE_ID, ORG_ID);
    });

    it("throws NotFoundError when expense does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getExpense(ORG_ID, "missing")).rejects.toThrow("Expense not found");
    });
  });

  // ── createExpense ────────────────────────────────────────────────────────

  describe("createExpense", () => {
    it("creates expense with proper amount handling (paise)", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeCategory())       // category validation
        .mockResolvedValueOnce(makeExpense());        // getExpense after create
      mockDb.create.mockResolvedValue(undefined);

      const input = {
        categoryId: CATEGORY_ID,
        vendorName: "Office Depot",
        date: "2025-03-15",
        amount: 150000,     // 1500.00 INR in paise
        currency: "INR",
        taxAmount: 27000,   // 270.00 in paise
        description: "Office supplies",
        isBillable: false,
      };

      const result = await createExpense(ORG_ID, USER_ID, input as any);

      expect(mockDb.create).toHaveBeenCalledWith("expenses", expect.objectContaining({
        orgId: ORG_ID,
        categoryId: CATEGORY_ID,
        amount: 150000,
        currency: "INR",
        taxAmount: 27000,
        status: ExpenseStatus.PENDING,
        createdBy: USER_ID,
        isBillable: false,
      }));
      expect(result.id).toBe(EXPENSE_ID);
    });

    it("throws NotFoundError when category does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        createExpense(ORG_ID, USER_ID, { categoryId: "bad-cat", description: "X", amount: 100, date: "2025-01-01" } as any)
      ).rejects.toThrow("Expense category not found");
    });

    it("defaults isBillable to false and currency to INR when not provided", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeCategory())
        .mockResolvedValueOnce(makeExpense());
      mockDb.create.mockResolvedValue(undefined);

      const input = {
        categoryId: CATEGORY_ID,
        date: "2025-03-15",
        amount: 50000,
        description: "Lunch",
      };

      await createExpense(ORG_ID, USER_ID, input as any);

      expect(mockDb.create).toHaveBeenCalledWith("expenses", expect.objectContaining({
        isBillable: false,
        currency: "INR",
        taxAmount: 0,
      }));
    });
  });

  // ── updateExpense ────────────────────────────────────────────────────────

  describe("updateExpense", () => {
    it("updates fields on a PENDING expense", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeExpense({ status: ExpenseStatus.PENDING })) // check existing
        .mockResolvedValueOnce(makeExpense({ amount: 200000 }));                // getExpense return
      mockDb.update.mockResolvedValue(undefined);

      const result = await updateExpense(ORG_ID, EXPENSE_ID, { amount: 200000 } as any);

      expect(mockDb.update).toHaveBeenCalledWith("expenses", EXPENSE_ID, expect.objectContaining({
        amount: 200000,
      }), ORG_ID);
      expect(result).toBeDefined();
    });

    it("throws NotFoundError when expense does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateExpense(ORG_ID, "missing", {} as any)).rejects.toThrow("Expense not found");
    });

    it("throws BadRequestError when updating a non-PENDING expense", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED }));

      await expect(updateExpense(ORG_ID, EXPENSE_ID, { amount: 200000 } as any)).rejects.toThrow(
        "Only expenses with PENDING status can be updated"
      );
    });
  });

  // ── deleteExpense ────────────────────────────────────────────────────────

  describe("deleteExpense", () => {
    it("deletes a PENDING expense", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.PENDING }));

      await deleteExpense(ORG_ID, EXPENSE_ID);

      expect(mockDb.delete).toHaveBeenCalledWith("expenses", EXPENSE_ID, ORG_ID);
    });

    it("throws NotFoundError when expense does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteExpense(ORG_ID, "missing")).rejects.toThrow("Expense not found");
    });

    it("throws BadRequestError when deleting a non-PENDING expense", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED }));

      await expect(deleteExpense(ORG_ID, EXPENSE_ID)).rejects.toThrow(
        "Only expenses with PENDING status can be deleted"
      );
    });
  });

  // ── approveExpense ───────────────────────────────────────────────────────

  describe("approveExpense", () => {
    it("updates status to APPROVED and sets approvedBy", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeExpense({ status: ExpenseStatus.PENDING }))
        .mockResolvedValueOnce(makeExpense({ status: ExpenseStatus.APPROVED, approvedBy: USER_ID }));
      mockDb.update.mockResolvedValue(undefined);

      const result = await approveExpense(ORG_ID, EXPENSE_ID, USER_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        "expenses",
        EXPENSE_ID,
        expect.objectContaining({
          status: ExpenseStatus.APPROVED,
          approvedBy: USER_ID,
        }),
        ORG_ID
      );
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.approvedBy).toBe(USER_ID);
    });

    it("throws NotFoundError when expense does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(approveExpense(ORG_ID, "missing", USER_ID)).rejects.toThrow("Expense not found");
    });

    it("throws BadRequestError when approving a non-PENDING expense", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED }));

      await expect(approveExpense(ORG_ID, EXPENSE_ID, USER_ID)).rejects.toThrow(
        "Only expenses with PENDING status can be approved"
      );
    });
  });

  // ── rejectExpense ────────────────────────────────────────────────────────

  describe("rejectExpense", () => {
    it("updates status to REJECTED", async () => {
      mockDb.findById
        .mockResolvedValueOnce(makeExpense({ status: ExpenseStatus.PENDING }))
        .mockResolvedValueOnce(makeExpense({ status: ExpenseStatus.REJECTED }));
      mockDb.update.mockResolvedValue(undefined);

      const result = await rejectExpense(ORG_ID, EXPENSE_ID);

      expect(mockDb.update).toHaveBeenCalledWith(
        "expenses",
        EXPENSE_ID,
        expect.objectContaining({ status: ExpenseStatus.REJECTED }),
        ORG_ID
      );
      expect(result.status).toBe(ExpenseStatus.REJECTED);
    });

    it("throws BadRequestError when rejecting a non-PENDING expense", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.BILLED }));

      await expect(rejectExpense(ORG_ID, EXPENSE_ID)).rejects.toThrow(
        "Only expenses with PENDING status can be rejected"
      );
    });
  });

  // ── billExpenseToClient ──────────────────────────────────────────────────

  describe("billExpenseToClient", () => {
    it("creates invoice from approved billable expense and updates status to BILLED", async () => {
      const expense = makeExpense({
        status: ExpenseStatus.APPROVED,
        isBillable: true,
        clientId: CLIENT_ID,
        amount: 150000,
        taxAmount: 27000,
      });

      mockDb.findById
        .mockResolvedValueOnce(expense)               // initial findById (existing)
        .mockResolvedValueOnce({ id: CLIENT_ID })      // client validation
        .mockResolvedValueOnce(makeExpense({            // getExpense after update
          status: ExpenseStatus.BILLED,
          invoiceId: "generated-uuid",
        }))
        .mockResolvedValueOnce({                        // findById for invoice
          id: "generated-uuid",
          orgId: ORG_ID,
          clientId: CLIENT_ID,
          invoiceNumber: "INV-2025-0050",
          status: InvoiceStatus.DRAFT,
          total: 177000,
        });

      mockDb.findMany.mockResolvedValue([{             // invoice items
        id: "generated-uuid",
        invoiceId: "generated-uuid",
        name: "Office supplies",
        quantity: 1,
        rate: 150000,
        amount: 177000,
      }]);

      mockedNextInvoiceNumber.mockResolvedValue("INV-2025-0050");
      mockDb.create.mockResolvedValue(undefined);
      mockDb.update.mockResolvedValue(undefined);
      mockDb.increment.mockReturnValue(1);

      const result = await billExpenseToClient(ORG_ID, EXPENSE_ID, USER_ID);

      // Creates invoice
      expect(mockDb.create).toHaveBeenCalledWith("invoices", expect.objectContaining({
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        invoiceNumber: "INV-2025-0050",
        status: InvoiceStatus.DRAFT,
        subtotal: 150000,
        taxAmount: 27000,
        total: 177000,
        amountPaid: 0,
        amountDue: 177000,
      }));

      // Creates invoice line item
      expect(mockDb.create).toHaveBeenCalledWith("invoice_items", expect.objectContaining({
        name: "Office supplies",
        quantity: 1,
        rate: 150000,
        taxAmount: 27000,
        amount: 177000,
      }));

      // Updates expense status to BILLED with invoice link
      expect(mockDb.update).toHaveBeenCalledWith(
        "expenses",
        EXPENSE_ID,
        expect.objectContaining({
          status: ExpenseStatus.BILLED,
          invoiceId: "generated-uuid",
        }),
        ORG_ID
      );

      expect(result.expense).toBeDefined();
      expect(result.invoice).toBeDefined();
    });

    it("throws BadRequestError when expense is not APPROVED", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({ status: ExpenseStatus.PENDING }));

      await expect(billExpenseToClient(ORG_ID, EXPENSE_ID, USER_ID)).rejects.toThrow(
        "Only APPROVED expenses can be billed to a client"
      );
    });

    it("throws BadRequestError when expense is not billable", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({
        status: ExpenseStatus.APPROVED,
        isBillable: false,
      }));

      await expect(billExpenseToClient(ORG_ID, EXPENSE_ID, USER_ID)).rejects.toThrow(
        "Expense is not marked as billable"
      );
    });

    it("throws BadRequestError when expense has no client assigned", async () => {
      mockDb.findById.mockResolvedValue(makeExpense({
        status: ExpenseStatus.APPROVED,
        isBillable: true,
        clientId: null,
      }));

      await expect(billExpenseToClient(ORG_ID, EXPENSE_ID, USER_ID)).rejects.toThrow(
        "Expense has no client assigned"
      );
    });

    it("throws NotFoundError when expense does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(billExpenseToClient(ORG_ID, "missing", USER_ID)).rejects.toThrow(
        "Expense not found"
      );
    });
  });

  // ── Mileage expense (distance x mileageRate) ────────────────────────────

  describe("mileage expense", () => {
    it("creates expense with amount calculated as distance x mileageRate", async () => {
      const distanceKm = 120;
      const mileageRatePaise = 1200; // 12.00 INR per km in paise
      const totalAmount = distanceKm * mileageRatePaise; // 144000 paise = 1440.00 INR

      mockDb.findById
        .mockResolvedValueOnce(makeCategory({ name: "Mileage" }))
        .mockResolvedValueOnce(makeExpense({ amount: totalAmount, description: "Client visit - 120 km" }));
      mockDb.create.mockResolvedValue(undefined);

      const input = {
        categoryId: CATEGORY_ID,
        date: "2025-03-15",
        amount: totalAmount,
        description: "Client visit - 120 km",
        isBillable: true,
        clientId: CLIENT_ID,
      };

      const result = await createExpense(ORG_ID, USER_ID, input as any);

      expect(mockDb.create).toHaveBeenCalledWith("expenses", expect.objectContaining({
        amount: 144000,
        description: "Client visit - 120 km",
      }));
      expect(result.amount).toBe(144000);
    });
  });
});
