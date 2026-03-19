import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { formatMoney } from "@emp-billing/shared";
import { InvoiceStatus, QuoteStatus, CreditNoteStatus } from "@emp-billing/shared";
import dayjs from "dayjs";

// ============================================================================
// PDF GENERATOR — Handlebars → HTML → Puppeteer → PDF Buffer
// ============================================================================

// Register helpers once
Handlebars.registerHelper("formatMoney", (amount: number, currency: string) =>
  formatMoney(amount, currency)
);
Handlebars.registerHelper("formatDate", (date: Date | string) =>
  dayjs(date).format("DD MMM YYYY")
);
Handlebars.registerHelper("inc", (index: number) => index + 1);
Handlebars.registerHelper("subtract", (a: number, b: number) => (a ?? 0) - (b ?? 0));

// Cache compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  if (templateCache.has(name)) return templateCache.get(name)!;
  const templatePath = path.join(__dirname, "../templates", `${name}.hbs`);
  const source = fs.readFileSync(templatePath, "utf-8");
  const compiled = Handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  [InvoiceStatus.PAID]: "paid",
  [InvoiceStatus.OVERDUE]: "overdue",
  [InvoiceStatus.DRAFT]: "draft",
  [InvoiceStatus.SENT]: "sent",
  [InvoiceStatus.VIEWED]: "sent",
  [InvoiceStatus.PARTIALLY_PAID]: "partial",
  [InvoiceStatus.VOID]: "draft",
  [InvoiceStatus.WRITTEN_OFF]: "draft",
};

const STATUS_LABEL: Record<string, string> = {
  [InvoiceStatus.PAID]: "Paid",
  [InvoiceStatus.OVERDUE]: "Overdue",
  [InvoiceStatus.DRAFT]: "Draft",
  [InvoiceStatus.SENT]: "Sent",
  [InvoiceStatus.VIEWED]: "Viewed",
  [InvoiceStatus.PARTIALLY_PAID]: "Partially Paid",
  [InvoiceStatus.VOID]: "Void",
  [InvoiceStatus.WRITTEN_OFF]: "Written Off",
};

// ── Quote status helpers ──────────────────────────────────────────────────

const QUOTE_STATUS_CLASS: Record<string, string> = {
  [QuoteStatus.DRAFT]: "draft",
  [QuoteStatus.SENT]: "sent",
  [QuoteStatus.VIEWED]: "sent",
  [QuoteStatus.ACCEPTED]: "paid",
  [QuoteStatus.DECLINED]: "overdue",
  [QuoteStatus.EXPIRED]: "overdue",
  [QuoteStatus.CONVERTED]: "paid",
};

const QUOTE_STATUS_LABEL: Record<string, string> = {
  [QuoteStatus.DRAFT]: "Draft",
  [QuoteStatus.SENT]: "Sent",
  [QuoteStatus.VIEWED]: "Viewed",
  [QuoteStatus.ACCEPTED]: "Accepted",
  [QuoteStatus.DECLINED]: "Declined",
  [QuoteStatus.EXPIRED]: "Expired",
  [QuoteStatus.CONVERTED]: "Converted",
};

// ── Credit note status helpers ───────────────────────────────────────────

const CREDIT_NOTE_STATUS_CLASS: Record<string, string> = {
  [CreditNoteStatus.DRAFT]: "draft",
  [CreditNoteStatus.OPEN]: "sent",
  [CreditNoteStatus.APPLIED]: "paid",
  [CreditNoteStatus.REFUNDED]: "partial",
  [CreditNoteStatus.VOID]: "draft",
};

const CREDIT_NOTE_STATUS_LABEL: Record<string, string> = {
  [CreditNoteStatus.DRAFT]: "Draft",
  [CreditNoteStatus.OPEN]: "Issued",
  [CreditNoteStatus.APPLIED]: "Applied",
  [CreditNoteStatus.REFUNDED]: "Refunded",
  [CreditNoteStatus.VOID]: "Void",
};

// ── Main PDF generation ────────────────────────────────────────────────────

export interface InvoicePdfData {
  invoice: Record<string, unknown>;
  items: Record<string, unknown>[];
  org: Record<string, unknown>;
  client: Record<string, unknown>;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const template = loadTemplate("invoice");

  const html = template({
    ...data,
    statusClass: STATUS_CLASS[(data.invoice.status as string)] ?? "draft",
    statusLabel: STATUS_LABEL[(data.invoice.status as string)] ?? String(data.invoice.status),
    brandPrimary: ((data.org.brandColors as Record<string, string>)?.primary) ?? "#4f46e5",
    hasFooter: !!(data.invoice.notes || data.invoice.terms),
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Quote PDF generation ─────────────────────────────────────────────────

export interface QuotePdfData {
  quote: Record<string, unknown>;
  items: Record<string, unknown>[];
  org: Record<string, unknown>;
  client: Record<string, unknown>;
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const template = loadTemplate("quote");

  const html = template({
    ...data,
    statusClass: QUOTE_STATUS_CLASS[(data.quote.status as string)] ?? "draft",
    statusLabel: QUOTE_STATUS_LABEL[(data.quote.status as string)] ?? String(data.quote.status),
    brandPrimary: ((data.org.brandColors as Record<string, string>)?.primary) ?? "#4f46e5",
    hasFooter: !!(data.quote.notes || data.quote.terms),
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Credit Note PDF generation ───────────────────────────────────────────

export interface CreditNotePdfData {
  creditNote: Record<string, unknown>;
  items: Record<string, unknown>[];
  org: Record<string, unknown>;
  client: Record<string, unknown>;
}

export async function generateCreditNotePdf(data: CreditNotePdfData): Promise<Buffer> {
  const template = loadTemplate("credit-note");

  const html = template({
    ...data,
    statusClass: CREDIT_NOTE_STATUS_CLASS[(data.creditNote.status as string)] ?? "draft",
    statusLabel: CREDIT_NOTE_STATUS_LABEL[(data.creditNote.status as string)] ?? String(data.creditNote.status),
    brandPrimary: ((data.org.brandColors as Record<string, string>)?.primary) ?? "#4f46e5",
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Payment Receipt PDF generation ───────────────────────────────────────

export interface ReceiptPdfData {
  payment: Record<string, unknown>;
  org: Record<string, unknown>;
  client: Record<string, unknown>;
  invoice?: Record<string, unknown>;
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const template = loadTemplate("receipt");

  const html = template({
    ...data,
    brandPrimary: ((data.org.brandColors as Record<string, string>)?.primary) ?? "#4f46e5",
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
