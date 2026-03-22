"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePdf = generateInvoicePdf;
exports.generateQuotePdf = generateQuotePdf;
exports.generateCreditNotePdf = generateCreditNotePdf;
exports.generateReceiptPdf = generateReceiptPdf;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("@emp-billing/shared");
const shared_2 = require("@emp-billing/shared");
const dayjs_1 = __importDefault(require("dayjs"));
// ============================================================================
// PDF GENERATOR — Handlebars → HTML → Puppeteer → PDF Buffer
// ============================================================================
// Register helpers once
handlebars_1.default.registerHelper("formatMoney", (amount, currency) => (0, shared_1.formatMoney)(amount, currency));
handlebars_1.default.registerHelper("formatDate", (date) => (0, dayjs_1.default)(date).format("DD MMM YYYY"));
handlebars_1.default.registerHelper("inc", (index) => index + 1);
handlebars_1.default.registerHelper("subtract", (a, b) => (a ?? 0) - (b ?? 0));
// Cache compiled templates
const templateCache = new Map();
/**
 * Resolve the templates directory.
 * In dev: __dirname = src/utils → ../templates = src/templates
 * In prod: __dirname = dist/utils → ../templates = dist/templates (may not exist)
 * Fallback: look relative to process.cwd() in packages/server/src/templates
 */
function getTemplatesDir() {
    const candidates = [
        path_1.default.join(__dirname, "../templates"),
        path_1.default.join(process.cwd(), "src/templates"),
        path_1.default.join(process.cwd(), "packages/server/src/templates"),
    ];
    for (const dir of candidates) {
        if (fs_1.default.existsSync(dir))
            return dir;
    }
    return candidates[0]; // fallback, will error on read
}
const TEMPLATES_DIR = getTemplatesDir();
function loadTemplate(name) {
    if (templateCache.has(name))
        return templateCache.get(name);
    const templatePath = path_1.default.join(TEMPLATES_DIR, `${name}.hbs`);
    const source = fs_1.default.readFileSync(templatePath, "utf-8");
    const compiled = handlebars_1.default.compile(source);
    templateCache.set(name, compiled);
    return compiled;
}
// ── Status helpers ─────────────────────────────────────────────────────────
const STATUS_CLASS = {
    [shared_2.InvoiceStatus.PAID]: "paid",
    [shared_2.InvoiceStatus.OVERDUE]: "overdue",
    [shared_2.InvoiceStatus.DRAFT]: "draft",
    [shared_2.InvoiceStatus.SENT]: "sent",
    [shared_2.InvoiceStatus.VIEWED]: "sent",
    [shared_2.InvoiceStatus.PARTIALLY_PAID]: "partial",
    [shared_2.InvoiceStatus.VOID]: "draft",
    [shared_2.InvoiceStatus.WRITTEN_OFF]: "draft",
};
const STATUS_LABEL = {
    [shared_2.InvoiceStatus.PAID]: "Paid",
    [shared_2.InvoiceStatus.OVERDUE]: "Overdue",
    [shared_2.InvoiceStatus.DRAFT]: "Draft",
    [shared_2.InvoiceStatus.SENT]: "Sent",
    [shared_2.InvoiceStatus.VIEWED]: "Viewed",
    [shared_2.InvoiceStatus.PARTIALLY_PAID]: "Partially Paid",
    [shared_2.InvoiceStatus.VOID]: "Void",
    [shared_2.InvoiceStatus.WRITTEN_OFF]: "Written Off",
};
// ── Quote status helpers ──────────────────────────────────────────────────
const QUOTE_STATUS_CLASS = {
    [shared_2.QuoteStatus.DRAFT]: "draft",
    [shared_2.QuoteStatus.SENT]: "sent",
    [shared_2.QuoteStatus.VIEWED]: "sent",
    [shared_2.QuoteStatus.ACCEPTED]: "paid",
    [shared_2.QuoteStatus.DECLINED]: "overdue",
    [shared_2.QuoteStatus.EXPIRED]: "overdue",
    [shared_2.QuoteStatus.CONVERTED]: "paid",
};
const QUOTE_STATUS_LABEL = {
    [shared_2.QuoteStatus.DRAFT]: "Draft",
    [shared_2.QuoteStatus.SENT]: "Sent",
    [shared_2.QuoteStatus.VIEWED]: "Viewed",
    [shared_2.QuoteStatus.ACCEPTED]: "Accepted",
    [shared_2.QuoteStatus.DECLINED]: "Declined",
    [shared_2.QuoteStatus.EXPIRED]: "Expired",
    [shared_2.QuoteStatus.CONVERTED]: "Converted",
};
// ── Credit note status helpers ───────────────────────────────────────────
const CREDIT_NOTE_STATUS_CLASS = {
    [shared_2.CreditNoteStatus.DRAFT]: "draft",
    [shared_2.CreditNoteStatus.OPEN]: "sent",
    [shared_2.CreditNoteStatus.APPLIED]: "paid",
    [shared_2.CreditNoteStatus.REFUNDED]: "partial",
    [shared_2.CreditNoteStatus.VOID]: "draft",
};
const CREDIT_NOTE_STATUS_LABEL = {
    [shared_2.CreditNoteStatus.DRAFT]: "Draft",
    [shared_2.CreditNoteStatus.OPEN]: "Issued",
    [shared_2.CreditNoteStatus.APPLIED]: "Applied",
    [shared_2.CreditNoteStatus.REFUNDED]: "Refunded",
    [shared_2.CreditNoteStatus.VOID]: "Void",
};
async function generateInvoicePdf(data) {
    const template = loadTemplate("invoice");
    const html = template({
        ...data,
        statusClass: STATUS_CLASS[data.invoice.status] ?? "draft",
        statusLabel: STATUS_LABEL[data.invoice.status] ?? String(data.invoice.status),
        brandPrimary: (data.org.brandColors?.primary) ?? "#4f46e5",
        hasFooter: !!(data.invoice.notes || data.invoice.terms),
    });
    const browser = await puppeteer_1.default.launch({
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
    }
    finally {
        await browser.close();
    }
}
async function generateQuotePdf(data) {
    const template = loadTemplate("quote");
    const html = template({
        ...data,
        statusClass: QUOTE_STATUS_CLASS[data.quote.status] ?? "draft",
        statusLabel: QUOTE_STATUS_LABEL[data.quote.status] ?? String(data.quote.status),
        brandPrimary: (data.org.brandColors?.primary) ?? "#4f46e5",
        hasFooter: !!(data.quote.notes || data.quote.terms),
    });
    const browser = await puppeteer_1.default.launch({
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
    }
    finally {
        await browser.close();
    }
}
async function generateCreditNotePdf(data) {
    const template = loadTemplate("credit-note");
    const html = template({
        ...data,
        statusClass: CREDIT_NOTE_STATUS_CLASS[data.creditNote.status] ?? "draft",
        statusLabel: CREDIT_NOTE_STATUS_LABEL[data.creditNote.status] ?? String(data.creditNote.status),
        brandPrimary: (data.org.brandColors?.primary) ?? "#4f46e5",
    });
    const browser = await puppeteer_1.default.launch({
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
    }
    finally {
        await browser.close();
    }
}
async function generateReceiptPdf(data) {
    const template = loadTemplate("receipt");
    const html = template({
        ...data,
        brandPrimary: (data.org.brandColors?.primary) ?? "#4f46e5",
    });
    const browser = await puppeteer_1.default.launch({
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
    }
    finally {
        await browser.close();
    }
}
//# sourceMappingURL=pdf.js.map