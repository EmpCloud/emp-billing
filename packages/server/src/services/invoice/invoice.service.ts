import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import archiver from "archiver";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError, ConflictError } from "../../utils/AppError";
import { InvoiceStatus, DiscountType, CreditNoteStatus } from "@emp-billing/shared";
import { computeLineItem, computeInvoiceTotals } from "./invoice.calculator";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { generateInvoicePdf } from "../../utils/pdf";
import type { Invoice, InvoiceItem, CreditNote, Product } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateInvoiceSchema, UpdateInvoiceSchema, InvoiceFilterSchema } from "@emp-billing/shared";

// ============================================================================
// INVOICE SERVICE
// ============================================================================

// ── List ─────────────────────────────────────────────────────────────────────

export async function listInvoices(orgId: string, opts: z.infer<typeof InvoiceFilterSchema>) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<Invoice>("invoices", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "issue_date", direction: "desc" }],
  });

  // Filter overdue in-memory (status is still "sent" but due_date passed)
  if (opts.overdue) {
    const today = new Date();
    result.data = result.data.filter(
      (inv) =>
        [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIALLY_PAID].includes(inv.status) &&
        new Date(inv.dueDate) < today
    );
  }

  // Date range filter
  if (opts.from || opts.to) {
    result.data = result.data.filter((inv) => {
      const d = new Date(inv.issueDate);
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    result.data = result.data.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.referenceNumber?.toLowerCase().includes(q)
    );
  }

  return result;
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getInvoice(orgId: string, id: string): Promise<Invoice & { items: InvoiceItem[] }> {
  const db = await getDB();
  const invoice = await db.findById<Invoice>("invoices", id, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  const items = await db.findMany<InvoiceItem>("invoice_items", {
    where: { invoice_id: id },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  return { ...invoice, items };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createInvoice(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateInvoiceSchema>
): Promise<Invoice & { items: InvoiceItem[] }> {
  const db = await getDB();

  // Validate client exists
  const client = await db.findById<{ id: string; orgId: string }>("clients", input.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Resolve tax rates for items
  const taxRates = new Map<string, { rate: number; components?: { name: string; rate: number }[] }>();
  for (const item of input.items) {
    if (item.taxRateId && !taxRates.has(item.taxRateId)) {
      const tr = await db.findById<{ rate: number; components: string }>("tax_rates", item.taxRateId, orgId);
      if (tr) {
        const components = tr.components
          ? (typeof tr.components === "string" ? JSON.parse(tr.components) : tr.components)
          : undefined;
        taxRates.set(item.taxRateId, { rate: tr.rate, components });
      }
    }
  }

  // Compute items
  const computedItems = input.items.map((item, idx) => {
    const taxInfo = item.taxRateId ? taxRates.get(item.taxRateId) : undefined;
    const computed = computeLineItem({
      quantity: item.quantity,
      rate: item.rate,
      discountType: item.discountType,
      discountValue: item.discountValue,
      taxRate: taxInfo?.rate ?? 0,
      taxComponents: taxInfo?.components,
    });
    return { ...item, ...computed, sortOrder: item.sortOrder ?? idx };
  });

  const totals = computeInvoiceTotals(
    computedItems,
    input.discountType,
    input.discountValue
  );

  // Compute TDS / withholding tax if rate is provided
  // TDS is calculated on (subtotal - discount) i.e. the taxable base before GST
  let tdsAmount = 0;
  if (input.tdsRate && input.tdsRate > 0) {
    const tdsBase = totals.subtotal - totals.itemDiscounts - totals.discountAmount;
    tdsAmount = Math.round(tdsBase * input.tdsRate / 100);
  }

  const invoiceNumber = await nextInvoiceNumber(orgId);
  const invoiceId = uuid();
  const now = new Date();

  await db.create("invoices", {
    id: invoiceId,
    orgId,
    clientId: input.clientId,
    invoiceNumber,
    referenceNumber: input.referenceNumber ?? null,
    status: InvoiceStatus.DRAFT,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    subtotal: totals.subtotal,
    discountType: input.discountType ?? null,
    discountValue: input.discountValue ?? null,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
    amountPaid: 0,
    amountDue: totals.total,
    tdsRate: input.tdsRate ?? null,
    tdsAmount,
    tdsSection: input.tdsSection ?? null,
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    customFields: input.customFields ? JSON.stringify(input.customFields) : null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Create items
  await db.createMany(
    "invoice_items",
    computedItems.map((item, idx) => ({
      id: uuid(),
      invoiceId,
      orgId,
      productId: item.productId ?? null,
      name: item.name,
      description: item.description ?? null,
      hsnCode: item.hsnCode ?? null,
      quantity: item.quantity,
      unit: item.unit ?? null,
      rate: item.rate,
      discountType: item.discountType ?? null,
      discountValue: item.discountValue ?? null,
      discountAmount: item.discountAmount,
      taxRateId: item.taxRateId ?? null,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      taxComponents: item.taxBreakdown ? JSON.stringify(item.taxBreakdown) : null,
      amount: item.amount,
      sortOrder: idx,
    }))
  );

  // Update client totals
  await db.increment("clients", input.clientId, "total_billed", totals.total);
  await db.increment("clients", input.clientId, "outstanding_balance", totals.total);

  // Reduce inventory for products with trackInventory enabled
  for (const item of computedItems) {
    if (item.productId) {
      const product = await db.findById<Product>("products", item.productId, orgId);
      if (product && product.trackInventory && product.stockOnHand != null) {
        const newStock = Math.max(0, product.stockOnHand - item.quantity);
        await db.update("products", item.productId, {
          stockOnHand: newStock,
          updatedAt: now,
        }, orgId);
      }
    }
  }

  // Auto-apply available credits if requested
  if (input.autoApplyCredits) {
    await autoApplyCredits(orgId, invoiceId, input.clientId);
  }

  return getInvoice(orgId, invoiceId);
}

// ── Auto-apply credits ────────────────────────────────────────────────────────

async function autoApplyCredits(
  orgId: string,
  invoiceId: string,
  clientId: string
): Promise<void> {
  const db = await getDB();

  // Fetch all OPEN credit notes for this client, oldest first
  const openCredits = await db.findMany<CreditNote>("credit_notes", {
    where: { org_id: orgId, client_id: clientId, status: CreditNoteStatus.OPEN },
    orderBy: [{ column: "date", direction: "asc" }],
  });

  if (openCredits.length === 0) return;

  // Re-fetch the invoice to get current amountDue
  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice || invoice.amountDue <= 0) return;

  let remainingDue = invoice.amountDue;
  const now = new Date();

  for (const credit of openCredits) {
    if (remainingDue <= 0) break;
    if (credit.balance <= 0) continue;

    const applyAmount = Math.min(credit.balance, remainingDue);
    const newCreditBalance = credit.balance - applyAmount;
    const newCreditStatus = newCreditBalance === 0 ? CreditNoteStatus.APPLIED : CreditNoteStatus.OPEN;

    await db.update("credit_notes", credit.id, {
      balance: newCreditBalance,
      status: newCreditStatus,
      updatedAt: now,
    }, orgId);

    remainingDue -= applyAmount;
  }

  // Update the invoice with the total credits applied
  const totalApplied = invoice.amountDue - remainingDue;
  if (totalApplied > 0) {
    const newAmountPaid = invoice.amountPaid + totalApplied;
    const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newAmountDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    await db.update("invoices", invoiceId, {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newStatus,
      paidAt: newStatus === InvoiceStatus.PAID ? now : null,
      updatedAt: now,
    }, orgId);
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateInvoice(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateInvoiceSchema>
): Promise<Invoice & { items: InvoiceItem[] }> {
  const db = await getDB();
  const existing = await db.findById<Invoice>("invoices", id, orgId);
  if (!existing) throw NotFoundError("Invoice");

  if ([InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF].includes(existing.status)) {
    throw BadRequestError("Cannot edit a voided or written-off invoice");
  }
  if (existing.status === InvoiceStatus.PAID) {
    throw BadRequestError("Cannot edit a fully paid invoice");
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.items) {
    // Recompute if items changed
    const taxRates = new Map<string, { rate: number; components?: { name: string; rate: number }[] }>();
    for (const item of input.items) {
      if (item.taxRateId && !taxRates.has(item.taxRateId)) {
        const tr = await db.findById<{ rate: number; components: string }>("tax_rates", item.taxRateId, orgId);
        if (tr) {
          const components = tr.components
            ? (typeof tr.components === "string" ? JSON.parse(tr.components) : tr.components)
            : undefined;
          taxRates.set(item.taxRateId, { rate: tr.rate, components });
        }
      }
    }

    const computedItems = input.items.map((item) => {
      const taxInfo = item.taxRateId ? taxRates.get(item.taxRateId) : undefined;
      return computeLineItem({
        quantity: item.quantity!,
        rate: item.rate!,
        discountType: item.discountType,
        discountValue: item.discountValue,
        taxRate: taxInfo?.rate ?? 0,
        taxComponents: taxInfo?.components,
      });
    });

    const discountType = input.discountType ?? existing.discountType;
    const discountValue = input.discountValue ?? existing.discountValue;
    const totals = computeInvoiceTotals(computedItems, discountType as DiscountType, discountValue);

    updateData.subtotal = totals.subtotal;
    updateData.discountType = input.discountType ?? existing.discountType;
    updateData.discountValue = input.discountValue ?? existing.discountValue;
    updateData.discountAmount = totals.discountAmount;
    updateData.taxAmount = totals.taxAmount;
    updateData.total = totals.total;
    updateData.amountDue = Math.max(0, totals.total - (existing.amountPaid ?? 0));

    // Recompute TDS if rate changed or items changed
    const effectiveTdsRate = input.tdsRate !== undefined ? input.tdsRate : existing.tdsRate;
    if (effectiveTdsRate && effectiveTdsRate > 0) {
      const tdsBase = totals.subtotal - totals.itemDiscounts - totals.discountAmount;
      updateData.tdsAmount = Math.round(tdsBase * effectiveTdsRate / 100);
    } else {
      updateData.tdsAmount = 0;
    }

    // Replace items
    await db.deleteMany("invoice_items", { invoice_id: id });
    await db.createMany(
      "invoice_items",
      computedItems.map((item, idx) => ({
        id: uuid(),
        invoiceId: id,
        orgId,
        name: input.items![idx].name!,
        quantity: item.quantity,
        rate: item.rate,
        discountType: item.discountType ?? null,
        discountValue: item.discountValue ?? null,
        discountAmount: item.discountAmount,
        taxRateId: input.items![idx].taxRateId ?? null,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        taxComponents: item.taxBreakdown ? JSON.stringify(item.taxBreakdown) : null,
        amount: item.amount,
        sortOrder: idx,
      }))
    );
  }

  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.terms !== undefined) updateData.terms = input.terms;
  if (input.dueDate) updateData.dueDate = input.dueDate;
  if (input.referenceNumber !== undefined) updateData.referenceNumber = input.referenceNumber;

  // TDS field updates (when items did NOT change, but TDS fields did)
  if (input.tdsRate !== undefined) updateData.tdsRate = input.tdsRate || null;
  if (input.tdsSection !== undefined) updateData.tdsSection = input.tdsSection || null;
  if (input.tdsRate !== undefined && !input.items) {
    // Recalculate TDS based on existing totals
    const tdsRate = input.tdsRate ?? 0;
    if (tdsRate > 0) {
      const tdsBase = existing.subtotal - existing.discountAmount;
      updateData.tdsAmount = Math.round(tdsBase * tdsRate / 100);
    } else {
      updateData.tdsAmount = 0;
    }
  }

  await db.update("invoices", id, updateData, orgId);
  return getInvoice(orgId, id);
}

// ── Send ──────────────────────────────────────────────────────────────────────

export async function sendInvoice(orgId: string, id: string): Promise<Invoice> {
  const db = await getDB();
  const invoice = await db.findById<Invoice>("invoices", id, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if (invoice.status === InvoiceStatus.VOID) throw BadRequestError("Cannot send a voided invoice");
  if (invoice.status === InvoiceStatus.PAID) throw BadRequestError("Invoice is already paid");

  const now = new Date();
  return db.update<Invoice>("invoices", id, {
    status: InvoiceStatus.SENT,
    sentAt: now,
    updatedAt: now,
  }, orgId);
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateInvoice(orgId: string, id: string, userId: string) {
  const db = await getDB();
  const source = await getInvoice(orgId, id);

  const newInvoiceNumber = await nextInvoiceNumber(orgId);
  const newId = uuid();
  const now = new Date();
  const today = dayjs().format("YYYY-MM-DD");
  const dueDate = dayjs().add(30, "day").format("YYYY-MM-DD");

  await db.create("invoices", {
    id: newId,
    orgId,
    clientId: source.clientId,
    invoiceNumber: newInvoiceNumber,
    status: InvoiceStatus.DRAFT,
    issueDate: today,
    dueDate,
    currency: source.currency,
    exchangeRate: source.exchangeRate,
    subtotal: source.subtotal,
    discountType: source.discountType,
    discountValue: source.discountValue,
    discountAmount: source.discountAmount,
    taxAmount: source.taxAmount,
    total: source.total,
    amountPaid: 0,
    amountDue: source.total,
    tdsRate: source.tdsRate ?? null,
    tdsAmount: source.tdsAmount ?? 0,
    tdsSection: source.tdsSection ?? null,
    notes: source.notes,
    terms: source.terms,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.createMany(
    "invoice_items",
    source.items.map((item) => ({
      ...item,
      id: uuid(),
      invoiceId: newId,
      orgId,
      taxComponents: item.taxComponents
        ? (typeof item.taxComponents === "string" ? item.taxComponents : JSON.stringify(item.taxComponents))
        : null,
    }))
  );

  return getInvoice(orgId, newId);
}

// ── Void ──────────────────────────────────────────────────────────────────────

export async function voidInvoice(orgId: string, id: string): Promise<Invoice> {
  const db = await getDB();
  const invoice = await db.findById<Invoice>("invoices", id, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if ([InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF].includes(invoice.status)) {
    throw BadRequestError("Invoice is already voided or written off");
  }
  if (invoice.status === InvoiceStatus.PAID) {
    throw BadRequestError("Cannot void a fully paid invoice. Issue a credit note instead.");
  }

  const now = new Date();
  // Reverse client outstanding balance (only unbilled portion)
  const outstanding = invoice.total - invoice.amountPaid;
  if (outstanding > 0) {
    await db.increment("clients", invoice.clientId, "outstanding_balance", -outstanding);
  }

  return db.update<Invoice>("invoices", id, { status: InvoiceStatus.VOID, updatedAt: now }, orgId);
}

// ── Write-off ─────────────────────────────────────────────────────────────────

export async function writeOffInvoice(orgId: string, id: string): Promise<Invoice> {
  const db = await getDB();
  const invoice = await db.findById<Invoice>("invoices", id, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if (![InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID].includes(invoice.status)) {
    throw BadRequestError("Only outstanding invoices can be written off");
  }

  const now = new Date();
  const outstanding = invoice.total - invoice.amountPaid;
  if (outstanding > 0) {
    await db.increment("clients", invoice.clientId, "outstanding_balance", -outstanding);
  }

  return db.update<Invoice>("invoices", id, { status: InvoiceStatus.WRITTEN_OFF, updatedAt: now }, orgId);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteInvoice(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const invoice = await db.findById<Invoice>("invoices", id, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw BadRequestError("Only draft invoices can be deleted");
  }

  await db.deleteMany("invoice_items", { invoice_id: id });
  await db.delete("invoices", id, orgId);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function getInvoicePdf(orgId: string, id: string): Promise<Buffer> {
  const db = await getDB();
  const invoice = await getInvoice(orgId, id);
  const org = await db.findById<Record<string, unknown>>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");
  const client = await db.findById<Record<string, unknown>>("clients", invoice.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON fields
  if (typeof org.address === "string") org.address = JSON.parse(org.address);
  if (typeof client.billingAddress === "string") client.billingAddress = JSON.parse(client.billingAddress);
  if (typeof org.brandColors === "string") org.brandColors = JSON.parse(org.brandColors);

  const items = invoice.items.map((item) => ({
    ...item,
    taxBreakdown: typeof item.taxComponents === "string"
      ? JSON.parse(item.taxComponents as unknown as string)
      : (item.taxComponents ?? []),
  }));

  return generateInvoicePdf({ invoice: invoice as unknown as Record<string, unknown>, items: items as unknown as Record<string, unknown>[], org, client });
}

// ── Invoice payments ──────────────────────────────────────────────────────────

export async function getInvoicePayments(orgId: string, invoiceId: string) {
  const db = await getDB();
  const invoice = await db.findById("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  return db.raw<unknown[]>(
    `SELECT p.*, pa.amount as allocated_amount
     FROM payments p
     JOIN payment_allocations pa ON pa.payment_id = p.id
     WHERE pa.invoice_id = ? AND p.org_id = ?
     ORDER BY p.date DESC`,
    [invoiceId, orgId]
  );
}

// ── Bulk PDF Zip ─────────────────────────────────────────────────────────────

export async function bulkGeneratePdfZip(orgId: string, ids: string[]): Promise<Buffer> {
  // Generate PDFs for all requested invoices
  const pdfEntries: { name: string; buffer: Buffer }[] = [];

  for (const id of ids) {
    try {
      const invoice = await getInvoice(orgId, id);
      const pdfBuffer = await getInvoicePdf(orgId, id);
      const safeName = (invoice.invoiceNumber || id).replace(/[^a-zA-Z0-9_-]/g, "_");
      pdfEntries.push({ name: `${safeName}.pdf`, buffer: pdfBuffer });
    } catch {
      // Skip invoices that fail (e.g. not found) — don't abort the whole batch
      continue;
    }
  }

  if (pdfEntries.length === 0) {
    throw BadRequestError("No valid invoices found for the provided IDs");
  }

  // Create zip archive using archiver
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err: Error) => reject(err));

    for (const entry of pdfEntries) {
      archive.append(entry.buffer, { name: entry.name });
    }

    archive.finalize();
  });
}

// ── Mark overdue (batch job) ──────────────────────────────────────────────────

export async function markOverdueInvoices(orgId: string): Promise<number> {
  const db = await getDB();
  const today = dayjs().format("YYYY-MM-DD");

  const affected = await db.updateMany(
    "invoices",
    { org_id: orgId, status: InvoiceStatus.SENT },
    { status: InvoiceStatus.OVERDUE, updated_at: new Date() }
  );

  return affected;
}
