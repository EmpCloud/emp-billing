"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCreditNotes = listCreditNotes;
exports.getCreditNote = getCreditNote;
exports.createCreditNote = createCreditNote;
exports.applyCreditNote = applyCreditNote;
exports.voidCreditNote = voidCreditNote;
exports.deleteCreditNote = deleteCreditNote;
exports.getCreditNotePdf = getCreditNotePdf;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const invoice_calculator_1 = require("../invoice/invoice.calculator");
const pdf_1 = require("../../utils/pdf");
// ── List ─────────────────────────────────────────────────────────────────────
async function listCreditNotes(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("credit_notes", {
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
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    if (opts.search) {
        const q = opts.search.toLowerCase();
        data = data.filter((cn) => cn.creditNoteNumber.toLowerCase().includes(q) ||
            cn.reason?.toLowerCase().includes(q));
    }
    return { ...result, data };
}
// ── Get ───────────────────────────────────────────────────────────────────────
async function getCreditNote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const creditNote = await db.findById("credit_notes", id, orgId);
    if (!creditNote)
        throw (0, AppError_1.NotFoundError)("Credit note");
    const items = await db.findMany("credit_note_items", {
        where: { credit_note_id: id },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    return { ...creditNote, items };
}
// ── Create ────────────────────────────────────────────────────────────────────
async function createCreditNote(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    // Validate client exists
    const client = await db.findById("clients", input.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Resolve tax rates for items
    const taxRates = new Map();
    for (const item of input.items) {
        if (item.taxRateId && !taxRates.has(item.taxRateId)) {
            const tr = await db.findById("tax_rates", item.taxRateId, orgId);
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
        const computed = (0, invoice_calculator_1.computeLineItem)({
            quantity: item.quantity,
            rate: item.rate,
            discountType: item.discountType,
            discountValue: item.discountValue,
            taxRate: taxInfo?.rate ?? 0,
            taxComponents: taxInfo?.components,
        });
        return { ...item, ...computed, sortOrder: item.sortOrder ?? idx };
    });
    const totals = (0, invoice_calculator_1.computeInvoiceTotals)(computedItems);
    // Auto-generate credit note number: CN-{YYYY}-{NNN:04}
    const creditNoteNumber = await generateCreditNoteNumber(orgId);
    const creditNoteId = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("credit_notes", {
        id: creditNoteId,
        orgId,
        clientId: input.clientId,
        creditNoteNumber,
        status: shared_1.CreditNoteStatus.OPEN,
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
    await db.createMany("credit_note_items", computedItems.map((item, idx) => ({
        id: (0, uuid_1.v4)(),
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
    })));
    return getCreditNote(orgId, creditNoteId);
}
// ── Apply ─────────────────────────────────────────────────────────────────────
async function applyCreditNote(orgId, creditNoteId, input) {
    const db = await (0, index_1.getDB)();
    const creditNote = await db.findById("credit_notes", creditNoteId, orgId);
    if (!creditNote)
        throw (0, AppError_1.NotFoundError)("Credit note");
    if (creditNote.status !== shared_1.CreditNoteStatus.OPEN) {
        throw (0, AppError_1.BadRequestError)("Only open credit notes can be applied");
    }
    if (input.amount > creditNote.balance) {
        throw (0, AppError_1.BadRequestError)(`Amount exceeds credit note balance. Available balance: ${creditNote.balance}`);
    }
    // Validate target invoice
    const invoice = await db.findById("invoices", input.invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF, shared_1.InvoiceStatus.PAID].includes(invoice.status)) {
        throw (0, AppError_1.BadRequestError)("Cannot apply credit to a voided, written-off, or fully paid invoice");
    }
    if (input.amount > invoice.amountDue) {
        throw (0, AppError_1.BadRequestError)(`Amount exceeds invoice balance. Invoice amount due: ${invoice.amountDue}`);
    }
    const now = new Date();
    // Reduce credit note balance
    const newBalance = creditNote.balance - input.amount;
    const newCreditNoteStatus = newBalance === 0 ? shared_1.CreditNoteStatus.APPLIED : shared_1.CreditNoteStatus.OPEN;
    await db.update("credit_notes", creditNoteId, {
        balance: newBalance,
        status: newCreditNoteStatus,
        updatedAt: now,
    }, orgId);
    // Reduce invoice amount_due and update status
    const newAmountPaid = invoice.amountPaid + input.amount;
    const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
    const newInvoiceStatus = newAmountDue === 0
        ? shared_1.InvoiceStatus.PAID
        : shared_1.InvoiceStatus.PARTIALLY_PAID;
    await db.update("invoices", input.invoiceId, {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newInvoiceStatus,
        paidAt: newInvoiceStatus === shared_1.InvoiceStatus.PAID ? now : null,
        updatedAt: now,
    }, orgId);
    return getCreditNote(orgId, creditNoteId);
}
// ── Void ──────────────────────────────────────────────────────────────────────
async function voidCreditNote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const creditNote = await db.findById("credit_notes", id, orgId);
    if (!creditNote)
        throw (0, AppError_1.NotFoundError)("Credit note");
    if (![shared_1.CreditNoteStatus.OPEN, shared_1.CreditNoteStatus.DRAFT].includes(creditNote.status)) {
        throw (0, AppError_1.BadRequestError)("Only open or draft credit notes can be voided");
    }
    const now = new Date();
    return db.update("credit_notes", id, {
        status: shared_1.CreditNoteStatus.VOID,
        updatedAt: now,
    }, orgId);
}
// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteCreditNote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const creditNote = await db.findById("credit_notes", id, orgId);
    if (!creditNote)
        throw (0, AppError_1.NotFoundError)("Credit note");
    if (creditNote.status !== shared_1.CreditNoteStatus.DRAFT) {
        throw (0, AppError_1.BadRequestError)("Only draft credit notes can be deleted");
    }
    await db.deleteMany("credit_note_items", { credit_note_id: id });
    await db.delete("credit_notes", id, orgId);
}
// ── Helpers ───────────────────────────────────────────────────────────────────
async function generateCreditNoteNumber(orgId) {
    const db = await (0, index_1.getDB)();
    const count = await db.count("credit_notes", { org_id: orgId });
    const year = new Date().getFullYear();
    return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}
// ── PDF ───────────────────────────────────────────────────────────────────────
async function getCreditNotePdf(orgId, id) {
    const db = await (0, index_1.getDB)();
    const creditNote = await getCreditNote(orgId, id);
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const client = await db.findById("clients", creditNote.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Parse JSON fields
    if (typeof org.address === "string")
        org.address = JSON.parse(org.address);
    if (typeof client.billingAddress === "string")
        client.billingAddress = JSON.parse(client.billingAddress);
    if (typeof org.brandColors === "string")
        org.brandColors = JSON.parse(org.brandColors);
    const items = creditNote.items.map((item) => ({
        ...item,
    }));
    return (0, pdf_1.generateCreditNotePdf)({ creditNote: creditNote, items: items, org, client });
}
//# sourceMappingURL=credit-note.service.js.map