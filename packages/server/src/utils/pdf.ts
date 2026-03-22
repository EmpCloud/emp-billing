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

/**
 * Resolve the templates directory.
 * In dev: __dirname = src/utils → ../templates = src/templates
 * In prod: __dirname = dist/utils → ../templates = dist/templates (may not exist)
 * Fallback: look relative to process.cwd() in packages/server/src/templates
 */
function getTemplatesDir(): string {
  const candidates = [
    path.join(__dirname, "../templates"),
    path.join(process.cwd(), "src/templates"),
    path.join(process.cwd(), "packages/server/src/templates"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]; // fallback, will error on read
}

const TEMPLATES_DIR = getTemplatesDir();

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  if (templateCache.has(name)) return templateCache.get(name)!;
  const templatePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
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

// ── Org branding helper ───────────────────────────────────────────────────

/**
 * Extract a normalised branding context from the raw org record so templates
 * can reference `orgBrand.*` without deeply-nested `{{org.address.line1}}`.
 * Falls back to sensible defaults when fields are missing.
 */
function buildOrgBranding(org: Record<string, unknown>) {
  const colors = (org.brandColors ?? org.brand_colors ?? {}) as Record<string, string>;
  const addr = (org.address ?? {}) as Record<string, string>;

  // Build a single formatted address string for templates that want it
  const addressParts: string[] = [];
  if (addr.line1) addressParts.push(addr.line1);
  if (addr.line2) addressParts.push(addr.line2);
  const cityState = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
  if (cityState) addressParts.push(cityState);
  if (addr.country) addressParts.push(addr.country);

  return {
    name: (org.name as string) ?? "",
    email: (org.email as string) ?? "",
    phone: (org.phone as string) ?? "",
    website: (org.website as string) ?? "",
    logo: (org.logo as string) ?? "",
    taxId: (org.taxId as string) ?? (org.tax_id as string) ?? "",
    gstin: (org.gstin as string) ?? (org.taxId as string) ?? (org.tax_id as string) ?? "",
    address: addr,
    formattedAddress: addressParts.join(", "),
    brandPrimary: colors.primary ?? "#4f46e5",
  };
}

// ── Main PDF generation ────────────────────────────────────────────────────

export interface InvoicePdfData {
  invoice: Record<string, unknown>;
  items: Record<string, unknown>[];
  org: Record<string, unknown>;
  client: Record<string, unknown>;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const template = loadTemplate("invoice");
  const orgBrand = buildOrgBranding(data.org);

  const html = template({
    ...data,
    orgBrand,
    statusClass: STATUS_CLASS[(data.invoice.status as string)] ?? "draft",
    statusLabel: STATUS_LABEL[(data.invoice.status as string)] ?? String(data.invoice.status),
    brandPrimary: orgBrand.brandPrimary,
    hasFooter: !!(data.invoice.notes || data.invoice.terms),
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Block all outbound network requests from the rendered page
    await page.setRequestInterception(true);
    page.on("request", (req) => req.abort());
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
  const orgBrand = buildOrgBranding(data.org);

  const html = template({
    ...data,
    orgBrand,
    statusClass: QUOTE_STATUS_CLASS[(data.quote.status as string)] ?? "draft",
    statusLabel: QUOTE_STATUS_LABEL[(data.quote.status as string)] ?? String(data.quote.status),
    brandPrimary: orgBrand.brandPrimary,
    hasFooter: !!(data.quote.notes || data.quote.terms),
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Block all outbound network requests from the rendered page
    await page.setRequestInterception(true);
    page.on("request", (req) => req.abort());
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
  const orgBrand = buildOrgBranding(data.org);

  const html = template({
    ...data,
    orgBrand,
    statusClass: CREDIT_NOTE_STATUS_CLASS[(data.creditNote.status as string)] ?? "draft",
    statusLabel: CREDIT_NOTE_STATUS_LABEL[(data.creditNote.status as string)] ?? String(data.creditNote.status),
    brandPrimary: orgBrand.brandPrimary,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Block all outbound network requests from the rendered page
    await page.setRequestInterception(true);
    page.on("request", (req) => req.abort());
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
  const orgBrand = buildOrgBranding(data.org);

  const html = template({
    ...data,
    orgBrand,
    brandPrimary: orgBrand.brandPrimary,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Block all outbound network requests from the rendered page
    await page.setRequestInterception(true);
    page.on("request", (req) => req.abort());
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
