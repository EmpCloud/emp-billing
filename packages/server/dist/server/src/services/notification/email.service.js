"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransport = createTransport;
exports.sendEmail = sendEmail;
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.sendPaymentReceiptEmail = sendPaymentReceiptEmail;
exports.sendQuoteEmail = sendQuoteEmail;
exports.sendPaymentReminderEmail = sendPaymentReminderEmail;
exports.sendTrialEndingEmail = sendTrialEndingEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
const index_2 = require("../../db/adapters/index");
// ============================================================================
// EMAIL SERVICE
// ============================================================================
let transporter = null;
// ── Transport ───────────────────────────────────────────────────────────────
function createTransport() {
    if (transporter)
        return transporter;
    transporter = nodemailer_1.default.createTransport({
        host: index_1.config.smtp.host,
        port: index_1.config.smtp.port,
        secure: index_1.config.smtp.port === 465,
        auth: {
            user: index_1.config.smtp.user,
            pass: index_1.config.smtp.password,
        },
    });
    logger_1.logger.info("Nodemailer transport created", { host: index_1.config.smtp.host, port: index_1.config.smtp.port });
    return transporter;
}
// ── Template helpers ────────────────────────────────────────────────────────
const templateCache = new Map();
const templatesDir = path_1.default.resolve(__dirname, "../../templates");
function loadTemplate(templateName) {
    if (templateCache.has(templateName)) {
        return templateCache.get(templateName);
    }
    const filePath = path_1.default.join(templatesDir, `${templateName}.hbs`);
    const source = fs_1.default.readFileSync(filePath, "utf-8");
    const compiled = handlebars_1.default.compile(source);
    templateCache.set(templateName, compiled);
    return compiled;
}
function formatMoney(amount) {
    const num = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(dateStr) {
    if (!dateStr)
        return "";
    const d = new Date(String(dateStr));
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
// Register Handlebars helpers used by email templates
handlebars_1.default.registerHelper("formatMoney", formatMoney);
handlebars_1.default.registerHelper("formatDate", formatDate);
// ── Core send ───────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
    const transport = createTransport();
    try {
        const info = await transport.sendMail({
            from: `"${index_1.config.smtp.fromName}" <${index_1.config.smtp.from}>`,
            to,
            subject,
            html,
        });
        logger_1.logger.info("Email sent", { to, subject, messageId: info.messageId });
    }
    catch (err) {
        logger_1.logger.error("Email send failed", { to, subject, err });
        throw err;
    }
}
// ── Invoice email ───────────────────────────────────────────────────────────
async function sendInvoiceEmail(orgId, invoiceId, clientEmail) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendInvoiceEmail: invoice not found", { orgId, invoiceId });
        return;
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendInvoiceEmail: organization not found", { orgId });
        return;
    }
    const template = loadTemplate("email-invoice");
    const html = template({
        org,
        invoice,
        portalUrl: index_1.config.corsOrigin,
        invoiceId,
        formatMoney,
        formatDate,
    });
    await sendEmail(clientEmail, `Invoice ${invoice.invoiceNumber ?? invoiceId} from ${org.name ?? ""}`, html);
}
// ── Payment receipt email ───────────────────────────────────────────────────
async function sendPaymentReceiptEmail(orgId, paymentId, clientEmail) {
    const db = await (0, index_2.getDB)();
    const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
    if (!payment) {
        logger_1.logger.warn("sendPaymentReceiptEmail: payment not found", { orgId, paymentId });
        return;
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReceiptEmail: organization not found", { orgId });
        return;
    }
    // If the payment references an invoice, load it
    let invoice = null;
    const invoiceId = payment.invoiceId ?? payment.invoice_id;
    if (invoiceId) {
        invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    }
    const template = loadTemplate("email-payment-receipt");
    const html = template({
        org,
        payment,
        invoice,
        portalUrl: index_1.config.corsOrigin,
    });
    await sendEmail(clientEmail, `Payment Receipt from ${org.name ?? ""}`, html);
}
// ── Quote email ─────────────────────────────────────────────────────────────
async function sendQuoteEmail(orgId, quoteId, clientEmail) {
    const db = await (0, index_2.getDB)();
    const quote = await db.findOne("quotes", { id: quoteId, org_id: orgId });
    if (!quote) {
        logger_1.logger.warn("sendQuoteEmail: quote not found", { orgId, quoteId });
        return;
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendQuoteEmail: organization not found", { orgId });
        return;
    }
    const template = loadTemplate("email-quote");
    const html = template({
        org,
        quote,
        portalUrl: index_1.config.corsOrigin,
        quoteId,
    });
    await sendEmail(clientEmail, `Quote ${quote.quoteNumber ?? quoteId} from ${org.name ?? ""}`, html);
}
// ── Payment reminder email ──────────────────────────────────────────────────
async function sendPaymentReminderEmail(orgId, invoiceId, clientEmail) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendPaymentReminderEmail: invoice not found", { orgId, invoiceId });
        return;
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReminderEmail: organization not found", { orgId });
        return;
    }
    // Calculate days overdue
    const dueDate = new Date(String(invoice.dueDate ?? invoice.due_date));
    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const template = loadTemplate("email-payment-reminder");
    const html = template({
        org,
        invoice,
        invoiceId,
        daysOverdue,
        portalUrl: index_1.config.corsOrigin,
    });
    await sendEmail(clientEmail, `Payment Reminder: Invoice ${invoice.invoiceNumber ?? invoiceId}`, html);
}
// ── Trial ending email ──────────────────────────────────────────────────
async function sendTrialEndingEmail(orgId, clientEmail, clientName, planName, planPrice, planCurrency, trialEndDate, daysLeft) {
    const db = await (0, index_2.getDB)();
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendTrialEndingEmail: organization not found", { orgId });
        return;
    }
    const template = loadTemplate("trial-ending");
    const html = template({
        org,
        clientName,
        planName,
        planPrice,
        planCurrency,
        trialEndDate,
        daysLeft,
    });
    await sendEmail(clientEmail, `Your trial for ${planName} is ending in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, html);
}
//# sourceMappingURL=email.service.js.map