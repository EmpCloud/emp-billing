import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import type { Expense, ExpenseCategory, ExpenseStatus, Invoice, InvoiceItem } from "@emp-billing/shared";
import { ExpenseStatus as Status, InvoiceStatus } from "@emp-billing/shared";
import { nextInvoiceNumber } from "../../utils/number-generator";
import type { z } from "zod";
import type {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseFilterSchema,
  CreateExpenseCategorySchema,
} from "@emp-billing/shared";

// ============================================================================
// EXPENSE SERVICE
// ============================================================================

export async function listExpenses(
  orgId: string,
  opts: z.infer<typeof ExpenseFilterSchema>
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };

  if (opts.categoryId) where.category_id = opts.categoryId;
  if (opts.clientId) where.client_id = opts.clientId;
  if (opts.status) where.status = opts.status;
  if (opts.isBillable !== undefined) where.is_billable = opts.isBillable;

  const result = await db.findPaginated<Expense>("expenses", {
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
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  return { ...result, data };
}

export async function getExpense(orgId: string, id: string): Promise<Expense> {
  const db = await getDB();
  const expense = await db.findById<Expense>("expenses", id, orgId);
  if (!expense) throw NotFoundError("Expense");
  return expense;
}

export async function createExpense(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateExpenseSchema>
): Promise<Expense> {
  const db = await getDB();

  // Validate category exists
  const category = await db.findById<ExpenseCategory>("expense_categories", input.categoryId, orgId);
  if (!category) throw NotFoundError("Expense category");

  const expenseId = uuid();
  const now = new Date();

  await db.create<Expense>("expenses", {
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
    status: Status.PENDING,
    approvedBy: null,
    tags: JSON.stringify(input.tags ?? []),
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return getExpense(orgId, expenseId);
}

export async function updateExpense(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateExpenseSchema>
): Promise<Expense> {
  const db = await getDB();
  const existing = await db.findById<Expense>("expenses", id, orgId);
  if (!existing) throw NotFoundError("Expense");

  if (existing.status !== Status.PENDING) {
    throw BadRequestError("Only expenses with PENDING status can be updated");
  }

  // If changing category, validate it exists
  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const category = await db.findById<ExpenseCategory>("expense_categories", input.categoryId, orgId);
    if (!category) throw NotFoundError("Expense category");
  }

  const updateData: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.tags) updateData.tags = JSON.stringify(input.tags);

  await db.update("expenses", id, updateData, orgId);
  return getExpense(orgId, id);
}

export async function deleteExpense(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById<Expense>("expenses", id, orgId);
  if (!existing) throw NotFoundError("Expense");

  if (existing.status !== Status.PENDING) {
    throw BadRequestError("Only expenses with PENDING status can be deleted");
  }

  await db.softDelete("expenses", id, orgId);
}

export async function approveExpense(
  orgId: string,
  id: string,
  userId: string
): Promise<Expense> {
  const db = await getDB();
  const existing = await db.findById<Expense>("expenses", id, orgId);
  if (!existing) throw NotFoundError("Expense");

  if (existing.status !== Status.PENDING) {
    throw BadRequestError("Only expenses with PENDING status can be approved");
  }

  await db.update(
    "expenses",
    id,
    {
      status: Status.APPROVED,
      approvedBy: userId,
      updatedAt: new Date(),
    },
    orgId
  );

  return getExpense(orgId, id);
}

export async function rejectExpense(
  orgId: string,
  id: string
): Promise<Expense> {
  const db = await getDB();
  const existing = await db.findById<Expense>("expenses", id, orgId);
  if (!existing) throw NotFoundError("Expense");

  if (existing.status !== Status.PENDING) {
    throw BadRequestError("Only expenses with PENDING status can be rejected");
  }

  await db.update(
    "expenses",
    id,
    {
      status: Status.REJECTED,
      updatedAt: new Date(),
    },
    orgId
  );

  return getExpense(orgId, id);
}

export async function billExpenseToClient(
  orgId: string,
  id: string,
  userId: string
): Promise<{ expense: Expense; invoice: Invoice & { items: InvoiceItem[] } }> {
  const db = await getDB();
  const existing = await db.findById<Expense>("expenses", id, orgId);
  if (!existing) throw NotFoundError("Expense");

  if (existing.status !== Status.APPROVED) {
    throw BadRequestError("Only APPROVED expenses can be billed to a client");
  }

  if (!existing.isBillable) {
    throw BadRequestError("Expense is not marked as billable");
  }

  if (!existing.clientId) {
    throw BadRequestError("Expense has no client assigned");
  }

  // Validate client exists
  const client = await db.findById<{ id: string }>("clients", existing.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Create invoice from the expense
  const invoiceId = uuid();
  const itemId = uuid();
  const invoiceNumber = await nextInvoiceNumber(orgId);
  const now = new Date();
  const issueDate = dayjs().format("YYYY-MM-DD");
  const dueDate = dayjs().add(30, "day").format("YYYY-MM-DD");

  const lineAmount = existing.amount;
  const taxAmount = existing.taxAmount ?? 0;
  const total = lineAmount + taxAmount;

  await db.create("invoices", {
    id: invoiceId,
    orgId,
    clientId: existing.clientId,
    invoiceNumber,
    referenceNumber: null,
    status: InvoiceStatus.DRAFT,
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
  await db.update(
    "expenses",
    id,
    {
      status: Status.BILLED,
      invoiceId,
      updatedAt: now,
    },
    orgId
  );

  const expense = await getExpense(orgId, id);

  // Fetch the created invoice with items
  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  const items = await db.findMany<InvoiceItem>("invoice_items", {
    where: { invoice_id: invoiceId },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  return { expense, invoice: { ...invoice!, items } };
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(orgId: string): Promise<ExpenseCategory[]> {
  const db = await getDB();
  return db.findMany<ExpenseCategory>("expense_categories", {
    where: { org_id: orgId, is_active: true },
    orderBy: [{ column: "name", direction: "asc" }],
  });
}

export async function createCategory(
  orgId: string,
  input: z.infer<typeof CreateExpenseCategorySchema>
): Promise<ExpenseCategory> {
  const db = await getDB();
  const categoryId = uuid();

  await db.create<ExpenseCategory>("expense_categories", {
    id: categoryId,
    orgId,
    name: input.name,
    description: input.description ?? null,
    isActive: true,
  });

  const created = await db.findById<ExpenseCategory>("expense_categories", categoryId, orgId);
  if (!created) throw NotFoundError("Expense category");
  return created;
}
