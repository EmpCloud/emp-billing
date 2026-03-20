"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuotes = listQuotes;
exports.getQuote = getQuote;
exports.createQuote = createQuote;
exports.updateQuote = updateQuote;
exports.deleteQuote = deleteQuote;
exports.sendQuote = sendQuote;
exports.convertToInvoice = convertToInvoice;
exports.acceptQuote = acceptQuote;
exports.declineQuote = declineQuote;
exports.getQuotePdf = getQuotePdf;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const invoice_calculator_1 = require("../invoice/invoice.calculator");
const number_generator_1 = require("../../utils/number-generator");
const number_generator_2 = require("../../utils/number-generator");
const pdf_1 = require("../../utils/pdf");
// ============================================================================
// QUOTE SERVICE
// ============================================================================
// -- List --------------------------------------------------------------------
async function listQuotes(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("quotes", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "issue_date", direction: "desc" }],
    });
    // Date range filter
    if (opts.from || opts.to) {
        result.data = result.data.filter((q) => {
            const d = new Date(q.issueDate);
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    if (opts.search) {
        const s = opts.search.toLowerCase();
        result.data = result.data.filter((q) => q.quoteNumber.toLowerCase().includes(s));
    }
    return result;
}
// -- Get ---------------------------------------------------------------------
async function getQuote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", id, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    const items = await db.findMany("quote_items", {
        where: { quote_id: id },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    return { ...quote, items };
}
// -- Create ------------------------------------------------------------------
async function createQuote(orgId, userId, input) {
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
    const quoteNumber = await (0, number_generator_1.nextQuoteNumber)(orgId);
    const quoteId = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("quotes", {
        id: quoteId,
        orgId,
        clientId: input.clientId,
        quoteNumber,
        status: shared_1.QuoteStatus.DRAFT,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        currency: input.currency,
        subtotal: totals.subtotal,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        version: 1,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    // Create items
    await db.createMany("quote_items", computedItems.map((item, idx) => ({
        id: (0, uuid_1.v4)(),
        quoteId,
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
    return getQuote(orgId, quoteId);
}
// -- Update ------------------------------------------------------------------
async function updateQuote(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("quotes", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Quote");
    if ([shared_1.QuoteStatus.CONVERTED, shared_1.QuoteStatus.DECLINED].includes(existing.status)) {
        throw (0, AppError_1.BadRequestError)("Cannot edit a converted or declined quote");
    }
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.items) {
        // Resolve tax rates
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
        // Replace items
        await db.deleteMany("quote_items", { quote_id: id });
        await db.createMany("quote_items", computedItems.map((item, idx) => ({
            id: (0, uuid_1.v4)(),
            quoteId: id,
            orgId,
            name: input.items[idx].name,
            description: input.items[idx].description ?? null,
            hsnCode: input.items[idx].hsnCode ?? null,
            productId: input.items[idx].productId ?? null,
            quantity: item.quantity,
            unit: input.items[idx].unit ?? null,
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
    if (input.expiryDate)
        updateData.expiryDate = input.expiryDate;
    if (input.clientId)
        updateData.clientId = input.clientId;
    if (input.currency)
        updateData.currency = input.currency;
    // Increment version
    updateData.version = (existing.version ?? 1) + 1;
    await db.update("quotes", id, updateData, orgId);
    return getQuote(orgId, id);
}
// -- Delete ------------------------------------------------------------------
async function deleteQuote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", id, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if (quote.status !== shared_1.QuoteStatus.DRAFT) {
        throw (0, AppError_1.BadRequestError)("Only draft quotes can be deleted");
    }
    await db.deleteMany("quote_items", { quote_id: id });
    await db.delete("quotes", id, orgId);
}
// -- Send --------------------------------------------------------------------
async function sendQuote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", id, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if ([shared_1.QuoteStatus.CONVERTED, shared_1.QuoteStatus.DECLINED].includes(quote.status)) {
        throw (0, AppError_1.BadRequestError)("Cannot send a converted or declined quote");
    }
    const now = new Date();
    return db.update("quotes", id, {
        status: shared_1.QuoteStatus.SENT,
        updatedAt: now,
    }, orgId);
}
// -- Convert to Invoice ------------------------------------------------------
async function convertToInvoice(orgId, id, userId) {
    const db = await (0, index_1.getDB)();
    const quote = await getQuote(orgId, id);
    if (quote.status === shared_1.QuoteStatus.CONVERTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been converted to an invoice");
    }
    if (quote.status === shared_1.QuoteStatus.DECLINED) {
        throw (0, AppError_1.BadRequestError)("Cannot convert a declined quote");
    }
    const invoiceNumber = await (0, number_generator_2.nextInvoiceNumber)(orgId);
    const invoiceId = (0, uuid_1.v4)();
    const now = new Date();
    const dueDate = (0, dayjs_1.default)().add(30, "day").format("YYYY-MM-DD");
    await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId: quote.clientId,
        invoiceNumber,
        referenceNumber: quote.quoteNumber,
        status: shared_1.InvoiceStatus.DRAFT,
        issueDate: now,
        dueDate,
        currency: quote.currency,
        exchangeRate: 1,
        subtotal: quote.subtotal,
        discountType: quote.discountType ?? null,
        discountValue: quote.discountValue ?? null,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        total: quote.total,
        amountPaid: 0,
        amountDue: quote.total,
        notes: quote.notes ?? null,
        terms: quote.terms ?? null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    // Copy quote items to invoice items
    await db.createMany("invoice_items", quote.items.map((item) => ({
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
        taxComponents: item.taxComponents ? JSON.stringify(item.taxComponents) : null,
        amount: item.amount,
        sortOrder: item.sortOrder,
    })));
    // Update client totals
    await db.update("clients", quote.clientId, {
        totalBilled: db.increment("clients", quote.clientId, "total_billed", quote.total),
        outstandingBalance: db.increment("clients", quote.clientId, "outstanding_balance", quote.total),
        updatedAt: now,
    }, orgId);
    // Mark quote as converted
    await db.update("quotes", id, {
        status: shared_1.QuoteStatus.CONVERTED,
        convertedInvoiceId: invoiceId,
        updatedAt: now,
    }, orgId);
    return { quote: await getQuote(orgId, id), invoiceId };
}
// -- Accept (portal use) -----------------------------------------------------
async function acceptQuote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", id, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if (quote.status === shared_1.QuoteStatus.CONVERTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been converted");
    }
    if (quote.status === shared_1.QuoteStatus.DECLINED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been declined");
    }
    if (quote.status === shared_1.QuoteStatus.ACCEPTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been accepted");
    }
    const now = new Date();
    return db.update("quotes", id, {
        status: shared_1.QuoteStatus.ACCEPTED,
        acceptedAt: now,
        updatedAt: now,
    }, orgId);
}
// -- Decline (portal use) ----------------------------------------------------
async function declineQuote(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", id, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if (quote.status === shared_1.QuoteStatus.CONVERTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been converted");
    }
    if (quote.status === shared_1.QuoteStatus.DECLINED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been declined");
    }
    const now = new Date();
    return db.update("quotes", id, {
        status: shared_1.QuoteStatus.DECLINED,
        updatedAt: now,
    }, orgId);
}
// -- PDF -----------------------------------------------------------------------
async function getQuotePdf(orgId, id) {
    const db = await (0, index_1.getDB)();
    const quote = await getQuote(orgId, id);
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const client = await db.findById("clients", quote.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Parse JSON fields
    if (typeof org.address === "string")
        org.address = JSON.parse(org.address);
    if (typeof client.billingAddress === "string")
        client.billingAddress = JSON.parse(client.billingAddress);
    if (typeof org.brandColors === "string")
        org.brandColors = JSON.parse(org.brandColors);
    const items = quote.items.map((item) => ({
        ...item,
        taxBreakdown: typeof item.taxComponents === "string"
            ? JSON.parse(item.taxComponents)
            : (item.taxComponents ?? []),
    }));
    return (0, pdf_1.generateQuotePdf)({ quote: quote, items: items, org, client });
}
//# sourceMappingURL=quote.service.js.map