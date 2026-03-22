"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExpenses = listExpenses;
exports.getExpense = getExpense;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.deleteExpense = deleteExpense;
exports.approveExpense = approveExpense;
exports.rejectExpense = rejectExpense;
exports.billExpenseToClient = billExpenseToClient;
exports.listCategories = listCategories;
exports.createCategory = createCategory;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const number_generator_1 = require("../../utils/number-generator");
// ============================================================================
// EXPENSE SERVICE
// ============================================================================
async function listExpenses(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.categoryId)
        where.category_id = opts.categoryId;
    if (opts.clientId)
        where.client_id = opts.clientId;
    if (opts.status)
        where.status = opts.status;
    if (opts.isBillable !== undefined)
        where.is_billable = opts.isBillable;
    const result = await db.findPaginated("expenses", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "date", direction: "desc" }],
    });
    let data = result.data;
    // Date-range filtering
    if (opts.from || opts.to) {
        data = data.filter((e) => {
            const d = new Date(e.date);
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    // Text search filtering on description and vendor name
    if (opts.search) {
        const q = opts.search.toLowerCase();
        data = data.filter((e) => e.description?.toLowerCase().includes(q) ||
            e.vendorName?.toLowerCase().includes(q));
    }
    return { ...result, data };
}
async function getExpense(orgId, id) {
    const db = await (0, index_1.getDB)();
    const expense = await db.findById("expenses", id, orgId);
    if (!expense)
        throw (0, AppError_1.NotFoundError)("Expense");
    return expense;
}
async function createExpense(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    // Validate category exists
    const category = await db.findById("expense_categories", input.categoryId, orgId);
    if (!category)
        throw (0, AppError_1.NotFoundError)("Expense category");
    const expenseId = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("expenses", {
        id: expenseId,
        orgId,
        categoryId: input.categoryId,
        vendorName: input.vendorName ?? null,
        date: input.date,
        amount: input.amount,
        currency: input.currency ?? "INR",
        taxAmount: input.taxAmount ?? 0,
        description: input.description,
        isBillable: input.isBillable ?? false,
        clientId: input.clientId ?? null,
        invoiceId: null,
        status: shared_1.ExpenseStatus.PENDING,
        approvedBy: null,
        tags: JSON.stringify(input.tags ?? []),
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    return getExpense(orgId, expenseId);
}
async function updateExpense(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("expenses", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Expense");
    if (existing.status !== shared_1.ExpenseStatus.PENDING) {
        throw (0, AppError_1.BadRequestError)("Only expenses with PENDING status can be updated");
    }
    // If changing category, validate it exists
    if (input.categoryId && input.categoryId !== existing.categoryId) {
        const category = await db.findById("expense_categories", input.categoryId, orgId);
        if (!category)
            throw (0, AppError_1.NotFoundError)("Expense category");
    }
    const updateData = { ...input, updatedAt: new Date() };
    if (input.tags)
        updateData.tags = JSON.stringify(input.tags);
    await db.update("expenses", id, updateData, orgId);
    return getExpense(orgId, id);
}
async function deleteExpense(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("expenses", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Expense");
    if (existing.status !== shared_1.ExpenseStatus.PENDING) {
        throw (0, AppError_1.BadRequestError)("Only expenses with PENDING status can be deleted");
    }
    await db.delete("expenses", id, orgId);
}
async function approveExpense(orgId, id, userId) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("expenses", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Expense");
    if (existing.status !== shared_1.ExpenseStatus.PENDING) {
        throw (0, AppError_1.BadRequestError)("Only expenses with PENDING status can be approved");
    }
    await db.update("expenses", id, {
        status: shared_1.ExpenseStatus.APPROVED,
        approvedBy: userId,
        updatedAt: new Date(),
    }, orgId);
    return getExpense(orgId, id);
}
async function rejectExpense(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("expenses", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Expense");
    if (existing.status !== shared_1.ExpenseStatus.PENDING) {
        throw (0, AppError_1.BadRequestError)("Only expenses with PENDING status can be rejected");
    }
    await db.update("expenses", id, {
        status: shared_1.ExpenseStatus.REJECTED,
        updatedAt: new Date(),
    }, orgId);
    return getExpense(orgId, id);
}
async function billExpenseToClient(orgId, id, userId) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("expenses", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Expense");
    if (existing.status !== shared_1.ExpenseStatus.APPROVED) {
        throw (0, AppError_1.BadRequestError)("Only APPROVED expenses can be billed to a client");
    }
    if (!existing.isBillable) {
        throw (0, AppError_1.BadRequestError)("Expense is not marked as billable");
    }
    if (!existing.clientId) {
        throw (0, AppError_1.BadRequestError)("Expense has no client assigned");
    }
    // Validate client exists
    const client = await db.findById("clients", existing.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Create invoice from the expense
    const invoiceId = (0, uuid_1.v4)();
    const itemId = (0, uuid_1.v4)();
    const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
    const now = new Date();
    const issueDate = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const dueDate = (0, dayjs_1.default)().add(30, "day").format("YYYY-MM-DD");
    const lineAmount = existing.amount;
    const taxAmount = existing.taxAmount ?? 0;
    const total = lineAmount + taxAmount;
    await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId: existing.clientId,
        invoiceNumber,
        referenceNumber: null,
        status: shared_1.InvoiceStatus.DRAFT,
        issueDate,
        dueDate,
        currency: existing.currency,
        exchangeRate: 1,
        subtotal: lineAmount,
        discountType: null,
        discountValue: null,
        discountAmount: 0,
        taxAmount,
        total,
        amountPaid: 0,
        amountDue: total,
        notes: `Billed from expense: ${existing.description}`,
        terms: null,
        customFields: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    // Create single line item from the expense
    await db.create("invoice_items", {
        id: itemId,
        invoiceId,
        orgId,
        productId: null,
        name: existing.description,
        description: existing.vendorName ? `Vendor: ${existing.vendorName}` : null,
        hsnCode: null,
        quantity: 1,
        unit: null,
        rate: lineAmount,
        discountType: null,
        discountValue: null,
        discountAmount: 0,
        taxRateId: null,
        taxRate: lineAmount > 0 ? Math.round((taxAmount / lineAmount) * 10000) / 100 : 0,
        taxAmount,
        taxComponents: null,
        amount: total,
        sortOrder: 0,
    });
    // Update client totals
    await db.update("clients", existing.clientId, {
        totalBilled: db.increment("clients", existing.clientId, "total_billed", total),
        outstandingBalance: db.increment("clients", existing.clientId, "outstanding_balance", total),
        updatedAt: now,
    }, orgId);
    // Update expense status to BILLED and link the invoice
    await db.update("expenses", id, {
        status: shared_1.ExpenseStatus.BILLED,
        invoiceId,
        updatedAt: now,
    }, orgId);
    const expense = await getExpense(orgId, id);
    // Fetch the created invoice with items
    const invoice = await db.findById("invoices", invoiceId, orgId);
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: invoiceId },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    return { expense, invoice: { ...invoice, items } };
}
// ── Categories ──────────────────────────────────────────────────────────────
async function listCategories(orgId) {
    const db = await (0, index_1.getDB)();
    return db.findMany("expense_categories", {
        where: { org_id: orgId, is_active: true },
        orderBy: [{ column: "name", direction: "asc" }],
    });
}
async function createCategory(orgId, input) {
    const db = await (0, index_1.getDB)();
    const categoryId = (0, uuid_1.v4)();
    await db.create("expense_categories", {
        id: categoryId,
        orgId,
        name: input.name,
        description: input.description ?? null,
        isActive: true,
    });
    const created = await db.findById("expense_categories", categoryId, orgId);
    if (!created)
        throw (0, AppError_1.NotFoundError)("Expense category");
    return created;
}
//# sourceMappingURL=expense.service.js.map