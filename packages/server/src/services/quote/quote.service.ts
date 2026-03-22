import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { QuoteStatus, DiscountType, InvoiceStatus } from "@emp-billing/shared";
import { computeLineItem, computeInvoiceTotals } from "../invoice/invoice.calculator";
import { nextQuoteNumber } from "../../utils/number-generator";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { generateQuotePdf } from "../../utils/pdf";
import type { Quote, InvoiceItem } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateQuoteSchema, UpdateQuoteSchema, QuoteFilterSchema } from "@emp-billing/shared";

// ============================================================================
// QUOTE SERVICE
// ============================================================================

// -- List --------------------------------------------------------------------

export async function listQuotes(orgId: string, opts: z.infer<typeof QuoteFilterSchema>) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<Quote>("quotes", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "issue_date", direction: "desc" }],
  });

  // Date range filter
  if (opts.from || opts.to) {
    result.data = result.data.filter((q) => {
      const d = new Date(q.issueDate);
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  if (opts.search) {
    const s = opts.search.toLowerCase();
    result.data = result.data.filter(
      (q) => q.quoteNumber.toLowerCase().includes(s)
    );
  }

  return result;
}

// -- Get ---------------------------------------------------------------------

export async function getQuote(orgId: string, id: string): Promise<Quote & { items: InvoiceItem[] }> {
  const db = await getDB();
  const quote = await db.findById<Quote>("quotes", id, orgId);
  if (!quote) throw NotFoundError("Quote");

  const items = await db.findMany<InvoiceItem>("quote_items", {
    where: { quote_id: id },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  return { ...quote, items };
}

// -- Create ------------------------------------------------------------------

export async function createQuote(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateQuoteSchema>
): Promise<Quote & { items: InvoiceItem[] }> {
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

  const quoteNumber = await nextQuoteNumber(orgId);
  const quoteId = uuid();
  const now = new Date();

  await db.create("quotes", {
    id: quoteId,
    orgId,
    clientId: input.clientId,
    quoteNumber,
    status: QuoteStatus.DRAFT,
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
  await db.createMany(
    "quote_items",
    computedItems.map((item, idx) => ({
      id: uuid(),
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
    }))
  );

  return getQuote(orgId, quoteId);
}

// -- Update ------------------------------------------------------------------

export async function updateQuote(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateQuoteSchema>
): Promise<Quote & { items: InvoiceItem[] }> {
  const db = await getDB();
  const existing = await db.findById<Quote>("quotes", id, orgId);
  if (!existing) throw NotFoundError("Quote");

  if ([QuoteStatus.CONVERTED, QuoteStatus.DECLINED].includes(existing.status)) {
    throw BadRequestError("Cannot edit a converted or declined quote");
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.items) {
    // Resolve tax rates
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

    // Replace items
    await db.deleteMany("quote_items", { quote_id: id });
    await db.createMany(
      "quote_items",
      computedItems.map((item, idx) => ({
        id: uuid(),
        quoteId: id,
        orgId,
        name: input.items![idx].name!,
        description: input.items![idx].description ?? null,
        hsnCode: input.items![idx].hsnCode ?? null,
        productId: input.items![idx].productId ?? null,
        quantity: item.quantity,
        unit: input.items![idx].unit ?? null,
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
  if (input.issueDate !== undefined) updateData.issueDate = input.issueDate;
  if (input.expiryDate !== undefined) updateData.expiryDate = input.expiryDate;
  if (input.clientId !== undefined) updateData.clientId = input.clientId;
  if (input.currency !== undefined) updateData.currency = input.currency;

  // Increment version
  updateData.version = (existing.version ?? 1) + 1;

  await db.update("quotes", id, updateData, orgId);
  return getQuote(orgId, id);
}

// -- Delete ------------------------------------------------------------------

export async function deleteQuote(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const quote = await db.findById<Quote>("quotes", id, orgId);
  if (!quote) throw NotFoundError("Quote");

  if (quote.status !== QuoteStatus.DRAFT) {
    throw BadRequestError("Only draft quotes can be deleted");
  }

  await db.deleteMany("quote_items", { quote_id: id });
  await db.delete("quotes", id, orgId);
}

// -- Send --------------------------------------------------------------------

export async function sendQuote(orgId: string, id: string): Promise<Quote> {
  const db = await getDB();
  const quote = await db.findById<Quote>("quotes", id, orgId);
  if (!quote) throw NotFoundError("Quote");

  if ([QuoteStatus.CONVERTED, QuoteStatus.DECLINED].includes(quote.status)) {
    throw BadRequestError("Cannot send a converted or declined quote");
  }

  const now = new Date();
  return db.update<Quote>("quotes", id, {
    status: QuoteStatus.SENT,
    updatedAt: now,
  }, orgId);
}

// -- Convert to Invoice ------------------------------------------------------

export async function convertToInvoice(orgId: string, id: string, userId: string) {
  const db = await getDB();
  const quote = await getQuote(orgId, id);

  if (quote.status === QuoteStatus.CONVERTED) {
    throw BadRequestError("Quote has already been converted to an invoice");
  }
  if (quote.status === QuoteStatus.DECLINED) {
    throw BadRequestError("Cannot convert a declined quote");
  }

  const invoiceNumber = await nextInvoiceNumber(orgId);
  const invoiceId = uuid();
  const now = new Date();
  const dueDate = dayjs().add(30, "day").format("YYYY-MM-DD");

  await db.create("invoices", {
    id: invoiceId,
    orgId,
    clientId: quote.clientId,
    invoiceNumber,
    referenceNumber: quote.quoteNumber,
    status: InvoiceStatus.DRAFT,
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
  await db.createMany(
    "invoice_items",
    quote.items.map((item) => ({
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
      taxComponents: item.taxComponents ? JSON.stringify(item.taxComponents) : null,
      amount: item.amount,
      sortOrder: item.sortOrder,
    }))
  );

  // Update client totals
  await db.update("clients", quote.clientId, {
    totalBilled: db.increment("clients", quote.clientId, "total_billed", quote.total),
    outstandingBalance: db.increment("clients", quote.clientId, "outstanding_balance", quote.total),
    updatedAt: now,
  }, orgId);

  // Mark quote as converted
  await db.update("quotes", id, {
    status: QuoteStatus.CONVERTED,
    convertedInvoiceId: invoiceId,
    updatedAt: now,
  }, orgId);

  return { quote: await getQuote(orgId, id), invoiceId };
}

// -- Accept (portal use) -----------------------------------------------------

export async function acceptQuote(orgId: string, id: string): Promise<Quote> {
  const db = await getDB();
  const quote = await db.findById<Quote>("quotes", id, orgId);
  if (!quote) throw NotFoundError("Quote");

  if (quote.status === QuoteStatus.CONVERTED) {
    throw BadRequestError("Quote has already been converted");
  }
  if (quote.status === QuoteStatus.DECLINED) {
    throw BadRequestError("Quote has already been declined");
  }
  if (quote.status === QuoteStatus.ACCEPTED) {
    throw BadRequestError("Quote has already been accepted");
  }

  const now = new Date();
  return db.update<Quote>("quotes", id, {
    status: QuoteStatus.ACCEPTED,
    acceptedAt: now,
    updatedAt: now,
  }, orgId);
}

// -- Decline (portal use) ----------------------------------------------------

export async function declineQuote(orgId: string, id: string): Promise<Quote> {
  const db = await getDB();
  const quote = await db.findById<Quote>("quotes", id, orgId);
  if (!quote) throw NotFoundError("Quote");

  if (quote.status === QuoteStatus.CONVERTED) {
    throw BadRequestError("Quote has already been converted");
  }
  if (quote.status === QuoteStatus.DECLINED) {
    throw BadRequestError("Quote has already been declined");
  }

  const now = new Date();
  return db.update<Quote>("quotes", id, {
    status: QuoteStatus.DECLINED,
    updatedAt: now,
  }, orgId);
}

// -- PDF -----------------------------------------------------------------------

export async function getQuotePdf(orgId: string, id: string): Promise<Buffer> {
  const db = await getDB();
  const quote = await getQuote(orgId, id);
  const org = await db.findById<Record<string, unknown>>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");
  const client = await db.findById<Record<string, unknown>>("clients", quote.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON fields
  if (typeof org.address === "string") org.address = JSON.parse(org.address);
  if (typeof client.billingAddress === "string") client.billingAddress = JSON.parse(client.billingAddress);
  if (typeof org.brandColors === "string") org.brandColors = JSON.parse(org.brandColors);

  const items = quote.items.map((item) => ({
    ...item,
    taxBreakdown: typeof item.taxComponents === "string"
      ? JSON.parse(item.taxComponents as unknown as string)
      : (item.taxComponents ?? []),
  }));

  return generateQuotePdf({ quote: quote as unknown as Record<string, unknown>, items: items as unknown as Record<string, unknown>[], org, client });
}
