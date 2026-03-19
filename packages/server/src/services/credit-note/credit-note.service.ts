import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { CreditNoteStatus, InvoiceStatus } from "@emp-billing/shared";
import { computeLineItem, computeInvoiceTotals } from "../invoice/invoice.calculator";
import { generateCreditNotePdf } from "../../utils/pdf";
import type { CreditNote } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateCreditNoteSchema, ApplyCreditNoteSchema } from "@emp-billing/shared";

// ============================================================================
// CREDIT NOTE SERVICE
// ============================================================================

interface CreditNoteFilterOpts {
  page: number;
  limit: number;
  sortOrder: "asc" | "desc";
  clientId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

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

// ── List ─────────────────────────────────────────────────────────────────────

export async function listCreditNotes(orgId: string, opts: CreditNoteFilterOpts) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<CreditNote>("credit_notes", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "date", direction: opts.sortOrder }],
  });

  let data = result.data;

  // Date range filter
  if (opts.from || opts.to) {
    data = data.filter((cn) => {
      const d = new Date(cn.date);
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    data = data.filter(
      (cn) =>
        cn.creditNoteNumber.toLowerCase().includes(q) ||
        cn.reason?.toLowerCase().includes(q)
    );
  }

  return { ...result, data };
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getCreditNote(orgId: string, id: string): Promise<CreditNote & { items: CreditNoteItem[] }> {
  const db = await getDB();
  const creditNote = await db.findById<CreditNote>("credit_notes", id, orgId);
  if (!creditNote) throw NotFoundError("Credit note");

  const items = await db.findMany<CreditNoteItem>("credit_note_items", {
    where: { credit_note_id: id },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  return { ...creditNote, items };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCreditNote(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateCreditNoteSchema>
): Promise<CreditNote & { items: CreditNoteItem[] }> {
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

  const totals = computeInvoiceTotals(computedItems);

  // Auto-generate credit note number: CN-{YYYY}-{NNN:04}
  const creditNoteNumber = await generateCreditNoteNumber(orgId);
  const creditNoteId = uuid();
  const now = new Date();

  await db.create("credit_notes", {
    id: creditNoteId,
    orgId,
    clientId: input.clientId,
    creditNoteNumber,
    status: CreditNoteStatus.OPEN,
    date: input.date,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    balance: totals.total,
    reason: input.reason ?? null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Create items
  await db.createMany(
    "credit_note_items",
    computedItems.map((item, idx) => ({
      id: uuid(),
      creditNoteId,
      orgId,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      rate: item.rate,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      amount: item.amount,
      sortOrder: idx,
    }))
  );

  return getCreditNote(orgId, creditNoteId);
}

// ── Apply ─────────────────────────────────────────────────────────────────────

export async function applyCreditNote(
  orgId: string,
  creditNoteId: string,
  input: z.infer<typeof ApplyCreditNoteSchema>
): Promise<CreditNote & { items: CreditNoteItem[] }> {
  const db = await getDB();

  const creditNote = await db.findById<CreditNote>("credit_notes", creditNoteId, orgId);
  if (!creditNote) throw NotFoundError("Credit note");

  if (creditNote.status !== CreditNoteStatus.OPEN) {
    throw BadRequestError("Only open credit notes can be applied");
  }

  if (input.amount > creditNote.balance) {
    throw BadRequestError(
      `Amount exceeds credit note balance. Available balance: ${creditNote.balance}`
    );
  }

  // Validate target invoice
  const invoice = await db.findById<{
    id: string;
    orgId: string;
    clientId: string;
    status: string;
    total: number;
    amountPaid: number;
    amountDue: number;
  }>("invoices", input.invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if ([InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF, InvoiceStatus.PAID].includes(invoice.status as InvoiceStatus)) {
    throw BadRequestError("Cannot apply credit to a voided, written-off, or fully paid invoice");
  }

  if (input.amount > invoice.amountDue) {
    throw BadRequestError(
      `Amount exceeds invoice balance. Invoice amount due: ${invoice.amountDue}`
    );
  }

  const now = new Date();

  // Reduce credit note balance
  const newBalance = creditNote.balance - input.amount;
  const newCreditNoteStatus = newBalance === 0 ? CreditNoteStatus.APPLIED : CreditNoteStatus.OPEN;

  await db.update("credit_notes", creditNoteId, {
    balance: newBalance,
    status: newCreditNoteStatus,
    updatedAt: now,
  }, orgId);

  // Reduce invoice amount_due and update status
  const newAmountPaid = invoice.amountPaid + input.amount;
  const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
  const newInvoiceStatus =
    newAmountDue === 0
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

  await db.update("invoices", input.invoiceId, {
    amountPaid: newAmountPaid,
    amountDue: newAmountDue,
    status: newInvoiceStatus,
    paidAt: newInvoiceStatus === InvoiceStatus.PAID ? now : null,
    updatedAt: now,
  }, orgId);

  return getCreditNote(orgId, creditNoteId);
}

// ── Void ──────────────────────────────────────────────────────────────────────

export async function voidCreditNote(orgId: string, id: string): Promise<CreditNote> {
  const db = await getDB();
  const creditNote = await db.findById<CreditNote>("credit_notes", id, orgId);
  if (!creditNote) throw NotFoundError("Credit note");

  if (![CreditNoteStatus.OPEN, CreditNoteStatus.DRAFT].includes(creditNote.status)) {
    throw BadRequestError("Only open or draft credit notes can be voided");
  }

  const now = new Date();
  return db.update<CreditNote>("credit_notes", id, {
    status: CreditNoteStatus.VOID,
    updatedAt: now,
  }, orgId);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCreditNote(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const creditNote = await db.findById<CreditNote>("credit_notes", id, orgId);
  if (!creditNote) throw NotFoundError("Credit note");

  if (creditNote.status !== CreditNoteStatus.DRAFT) {
    throw BadRequestError("Only draft credit notes can be deleted");
  }

  await db.deleteMany("credit_note_items", { credit_note_id: id });
  await db.delete("credit_notes", id, orgId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateCreditNoteNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const count = await db.count("credit_notes", { org_id: orgId });
  const year = new Date().getFullYear();
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function getCreditNotePdf(orgId: string, id: string): Promise<Buffer> {
  const db = await getDB();
  const creditNote = await getCreditNote(orgId, id);
  const org = await db.findById<Record<string, unknown>>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");
  const client = await db.findById<Record<string, unknown>>("clients", creditNote.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON fields
  if (typeof org.address === "string") org.address = JSON.parse(org.address);
  if (typeof client.billingAddress === "string") client.billingAddress = JSON.parse(client.billingAddress);
  if (typeof org.brandColors === "string") org.brandColors = JSON.parse(org.brandColors);

  const items = creditNote.items.map((item) => ({
    ...item,
  }));

  return generateCreditNotePdf({ creditNote: creditNote as unknown as Record<string, unknown>, items: items as unknown as Record<string, unknown>[], org, client });
}
