"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.createInvoice = createInvoice;
exports.updateInvoice = updateInvoice;
exports.sendInvoice = sendInvoice;
exports.duplicateInvoice = duplicateInvoice;
exports.voidInvoice = voidInvoice;
exports.writeOffInvoice = writeOffInvoice;
exports.deleteInvoice = deleteInvoice;
exports.getInvoicePdf = getInvoicePdf;
exports.getInvoicePayments = getInvoicePayments;
exports.bulkGeneratePdfZip = bulkGeneratePdfZip;
exports.markOverdueInvoices = markOverdueInvoices;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const archiver_1 = __importDefault(require("archiver"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const invoice_calculator_1 = require("./invoice.calculator");
const number_generator_1 = require("../../utils/number-generator");
const pdf_1 = require("../../utils/pdf");
// ============================================================================
// INVOICE SERVICE
// ============================================================================
// ── List ─────────────────────────────────────────────────────────────────────
async function listInvoices(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("invoices", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "issue_date", direction: "desc" }],
    });
    // Filter overdue in-memory (status is still "sent" but due_date passed)
    if (opts.overdue) {
        const today = new Date();
        result.data = result.data.filter((inv) => [shared_1.InvoiceStatus.SENT, shared_1.InvoiceStatus.VIEWED, shared_1.InvoiceStatus.PARTIALLY_PAID].includes(inv.status) &&
            new Date(inv.dueDate) < today);
    }
    // Date range filter
    if (opts.from || opts.to) {
        result.data = result.data.filter((inv) => {
            const d = new Date(inv.issueDate);
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    if (opts.search) {
        const q = opts.search.toLowerCase();
        result.data = result.data.filter((inv) => inv.invoiceNumber.toLowerCase().includes(q) ||
            inv.referenceNumber?.toLowerCase().includes(q));
    }
    return result;
}
// ── Get ───────────────────────────────────────────────────────────────────────
async function getInvoice(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", id, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: id },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    return { ...invoice, items };
}
// ── Create ────────────────────────────────────────────────────────────────────
async function createInvoice(orgId, userId, input) {
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
    const totals = (0, invoice_calculator_1.computeInvoiceTotals)(computedItems, input.discountType, input.discountValue);
    // Compute TDS / withholding tax if rate is provided
    // TDS is calculated on (subtotal - discount) i.e. the taxable base before GST
    let tdsAmount = 0;
    if (input.tdsRate && input.tdsRate > 0) {
        const tdsBase = totals.subtotal - totals.itemDiscounts - totals.discountAmount;
        tdsAmount = Math.round(tdsBase * input.tdsRate / 100);
    }
    const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
    const invoiceId = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId: input.clientId,
        invoiceNumber,
        referenceNumber: input.referenceNumber ?? null,
        status: shared_1.InvoiceStatus.DRAFT,
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
    await db.createMany("invoice_items", computedItems.map((item, idx) => ({
        id: (0, uuid_1.v4)(),
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
    })));
    // Update client totals
    await db.update("clients", input.clientId, {
        totalBilled: db.increment("clients", input.clientId, "total_billed", totals.total),
        outstandingBalance: db.increment("clients", input.clientId, "outstanding_balance", totals.total),
        updatedAt: now,
    }, orgId);
    // Reduce inventory for products with trackInventory enabled
    for (const item of computedItems) {
        if (item.productId) {
            const product = await db.findById("products", item.productId, orgId);
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
async function autoApplyCredits(orgId, invoiceId, clientId) {
    const db = await (0, index_1.getDB)();
    // Fetch all OPEN credit notes for this client, oldest first
    const openCredits = await db.findMany("credit_notes", {
        where: { org_id: orgId, client_id: clientId, status: shared_1.CreditNoteStatus.OPEN },
        orderBy: [{ column: "date", direction: "asc" }],
    });
    if (openCredits.length === 0)
        return;
    // Re-fetch the invoice to get current amountDue
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice || invoice.amountDue <= 0)
        return;
    let remainingDue = invoice.amountDue;
    const now = new Date();
    for (const credit of openCredits) {
        if (remainingDue <= 0)
            break;
        if (credit.balance <= 0)
            continue;
        const applyAmount = Math.min(credit.balance, remainingDue);
        const newCreditBalance = credit.balance - applyAmount;
        const newCreditStatus = newCreditBalance === 0 ? shared_1.CreditNoteStatus.APPLIED : shared_1.CreditNoteStatus.OPEN;
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
        const newStatus = newAmountDue === 0 ? shared_1.InvoiceStatus.PAID : shared_1.InvoiceStatus.PARTIALLY_PAID;
        await db.update("invoices", invoiceId, {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            paidAt: newStatus === shared_1.InvoiceStatus.PAID ? now : null,
            updatedAt: now,
        }, orgId);
    }
}
// ── Update ────────────────────────────────────────────────────────────────────
async function updateInvoice(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("invoices", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF].includes(existing.status)) {
        throw (0, AppError_1.BadRequestError)("Cannot edit a voided or written-off invoice");
    }
    if (existing.status === shared_1.InvoiceStatus.PAID) {
        throw (0, AppError_1.BadRequestError)("Cannot edit a fully paid invoice");
    }
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.items) {
        // Recompute if items changed
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
        const computedItems = input.items.map((item) => {
            const taxInfo = item.taxRateId ? taxRates.get(item.taxRateId) : undefined;
            return (0, invoice_calculator_1.computeLineItem)({
                quantity: item.quantity,
                rate: item.rate,
                discountType: item.discountType,
                discountValue: item.discountValue,
                taxRate: taxInfo?.rate ?? 0,
                taxComponents: taxInfo?.components,
            });
        });
        const discountType = input.discountType ?? existing.discountType;
        const discountValue = input.discountValue ?? existing.discountValue;
        const totals = (0, invoice_calculator_1.computeInvoiceTotals)(computedItems, discountType, discountValue);
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
        }
        else {
            updateData.tdsAmount = 0;
        }
        // Replace items
        await db.deleteMany("invoice_items", { invoice_id: id });
        await db.createMany("invoice_items", computedItems.map((item, idx) => ({
            id: (0, uuid_1.v4)(),
            invoiceId: id,
            orgId,
            name: input.items[idx].name,
            quantity: item.quantity,
            rate: item.rate,
            discountType: item.discountType ?? null,
            discountValue: item.discountValue ?? null,
            discountAmount: item.discountAmount,
            taxRateId: input.items[idx].taxRateId ?? null,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            taxComponents: item.taxBreakdown ? JSON.stringify(item.taxBreakdown) : null,
            amount: item.amount,
            sortOrder: idx,
        })));
    }
    if (input.notes !== undefined)
        updateData.notes = input.notes;
    if (input.terms !== undefined)
        updateData.terms = input.terms;
    if (input.dueDate)
        updateData.dueDate = input.dueDate;
    if (input.referenceNumber !== undefined)
        updateData.referenceNumber = input.referenceNumber;
    // TDS field updates (when items did NOT change, but TDS fields did)
    if (input.tdsRate !== undefined)
        updateData.tdsRate = input.tdsRate || null;
    if (input.tdsSection !== undefined)
        updateData.tdsSection = input.tdsSection || null;
    if (input.tdsRate !== undefined && !input.items) {
        // Recalculate TDS based on existing totals
        const tdsRate = input.tdsRate ?? 0;
        if (tdsRate > 0) {
            const tdsBase = existing.subtotal - existing.discountAmount;
            updateData.tdsAmount = Math.round(tdsBase * tdsRate / 100);
        }
        else {
            updateData.tdsAmount = 0;
        }
    }
    await db.update("invoices", id, updateData, orgId);
    return getInvoice(orgId, id);
}
// ── Send ──────────────────────────────────────────────────────────────────────
async function sendInvoice(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", id, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if (invoice.status === shared_1.InvoiceStatus.VOID)
        throw (0, AppError_1.BadRequestError)("Cannot send a voided invoice");
    if (invoice.status === shared_1.InvoiceStatus.PAID)
        throw (0, AppError_1.BadRequestError)("Invoice is already paid");
    const now = new Date();
    return db.update("invoices", id, {
        status: shared_1.InvoiceStatus.SENT,
        sentAt: now,
        updatedAt: now,
    }, orgId);
}
// ── Duplicate ─────────────────────────────────────────────────────────────────
async function duplicateInvoice(orgId, id, userId) {
    const db = await (0, index_1.getDB)();
    const source = await getInvoice(orgId, id);
    const newInvoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
    const newId = (0, uuid_1.v4)();
    const now = new Date();
    const today = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const dueDate = (0, dayjs_1.default)().add(30, "day").format("YYYY-MM-DD");
    await db.create("invoices", {
        id: newId,
        orgId,
        clientId: source.clientId,
        invoiceNumber: newInvoiceNumber,
        status: shared_1.InvoiceStatus.DRAFT,
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
    await db.createMany("invoice_items", source.items.map((item) => ({
        ...item,
        id: (0, uuid_1.v4)(),
        invoiceId: newId,
        orgId,
    })));
    return getInvoice(orgId, newId);
}
// ── Void ──────────────────────────────────────────────────────────────────────
async function voidInvoice(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", id, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF].includes(invoice.status)) {
        throw (0, AppError_1.BadRequestError)("Invoice is already voided or written off");
    }
    if (invoice.status === shared_1.InvoiceStatus.PAID) {
        throw (0, AppError_1.BadRequestError)("Cannot void a fully paid invoice. Issue a credit note instead.");
    }
    const now = new Date();
    // Reverse client outstanding balance (only unbilled portion)
    const outstanding = invoice.total - invoice.amountPaid;
    if (outstanding > 0) {
        await db.update("clients", invoice.clientId, {
            outstandingBalance: await db.increment("clients", invoice.clientId, "outstanding_balance", -outstanding),
            updatedAt: now,
        }, orgId);
    }
    return db.update("invoices", id, { status: shared_1.InvoiceStatus.VOID, updatedAt: now }, orgId);
}
// ── Write-off ─────────────────────────────────────────────────────────────────
async function writeOffInvoice(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", id, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if (![shared_1.InvoiceStatus.SENT, shared_1.InvoiceStatus.VIEWED, shared_1.InvoiceStatus.OVERDUE, shared_1.InvoiceStatus.PARTIALLY_PAID].includes(invoice.status)) {
        throw (0, AppError_1.BadRequestError)("Only outstanding invoices can be written off");
    }
    const now = new Date();
    const outstanding = invoice.total - invoice.amountPaid;
    if (outstanding > 0) {
        await db.update("clients", invoice.clientId, {
            outstandingBalance: await db.increment("clients", invoice.clientId, "outstanding_balance", -outstanding),
            updatedAt: now,
        }, orgId);
    }
    return db.update("invoices", id, { status: shared_1.InvoiceStatus.WRITTEN_OFF, updatedAt: now }, orgId);
}
// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteInvoice(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", id, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if (invoice.status !== shared_1.InvoiceStatus.DRAFT) {
        throw (0, AppError_1.BadRequestError)("Only draft invoices can be deleted");
    }
    await db.deleteMany("invoice_items", { invoice_id: id });
    await db.delete("invoices", id, orgId);
}
// ── PDF ───────────────────────────────────────────────────────────────────────
async function getInvoicePdf(orgId, id) {
    const db = await (0, index_1.getDB)();
    const invoice = await getInvoice(orgId, id);
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const client = await db.findById("clients", invoice.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Parse JSON fields
    if (typeof org.address === "string")
        org.address = JSON.parse(org.address);
    if (typeof client.billingAddress === "string")
        client.billingAddress = JSON.parse(client.billingAddress);
    if (typeof org.brandColors === "string")
        org.brandColors = JSON.parse(org.brandColors);
    const items = invoice.items.map((item) => ({
        ...item,
        taxBreakdown: typeof item.taxComponents === "string"
            ? JSON.parse(item.taxComponents)
            : (item.taxComponents ?? []),
    }));
    return (0, pdf_1.generateInvoicePdf)({ invoice: invoice, items: items, org, client });
}
// ── Invoice payments ──────────────────────────────────────────────────────────
async function getInvoicePayments(orgId, invoiceId) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    return db.raw(`SELECT p.*, pa.amount as allocated_amount
     FROM payments p
     JOIN payment_allocations pa ON pa.payment_id = p.id
     WHERE pa.invoice_id = ? AND p.org_id = ?
     ORDER BY p.date DESC`, [invoiceId, orgId]);
}
// ── Bulk PDF Zip ─────────────────────────────────────────────────────────────
async function bulkGeneratePdfZip(orgId, ids) {
    // Generate PDFs for all requested invoices
    const pdfEntries = [];
    for (const id of ids) {
        try {
            const invoice = await getInvoice(orgId, id);
            const pdfBuffer = await getInvoicePdf(orgId, id);
            const safeName = (invoice.invoiceNumber || id).replace(/[^a-zA-Z0-9_-]/g, "_");
            pdfEntries.push({ name: `${safeName}.pdf`, buffer: pdfBuffer });
        }
        catch {
            // Skip invoices that fail (e.g. not found) — don't abort the whole batch
            continue;
        }
    }
    if (pdfEntries.length === 0) {
        throw (0, AppError_1.BadRequestError)("No valid invoices found for the provided IDs");
    }
    // Create zip archive using archiver
    return new Promise((resolve, reject) => {
        const archive = (0, archiver_1.default)("zip", { zlib: { level: 5 } });
        const chunks = [];
        archive.on("data", (chunk) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", (err) => reject(err));
        for (const entry of pdfEntries) {
            archive.append(entry.buffer, { name: entry.name });
        }
        archive.finalize();
    });
}
// ── Mark overdue (batch job) ──────────────────────────────────────────────────
async function markOverdueInvoices(orgId) {
    const db = await (0, index_1.getDB)();
    const today = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const affected = await db.updateMany("invoices", { org_id: orgId, status: shared_1.InvoiceStatus.SENT }, { status: shared_1.InvoiceStatus.OVERDUE, updated_at: new Date() });
    return affected;
}
//# sourceMappingURL=invoice.service.js.map