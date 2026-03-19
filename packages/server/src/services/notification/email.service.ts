import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import { getDB } from "../../db/adapters/index";

// ============================================================================
// EMAIL SERVICE
// ============================================================================

let transporter: Transporter | null = null;

// ── Transport ───────────────────────────────────────────────────────────────

export function createTransport(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });

  logger.info("Nodemailer transport created", { host: config.smtp.host, port: config.smtp.port });
  return transporter;
}

// ── Template helpers ────────────────────────────────────────────────────────

const templateCache = new Map<string, HandlebarsTemplateDelegate>();
const templatesDir = path.resolve(__dirname, "../../templates");

function loadTemplate(templateName: string): HandlebarsTemplateDelegate {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const filePath = path.join(templatesDir, `${templateName}.hbs`);
  const source = fs.readFileSync(filePath, "utf-8");
  const compiled = Handlebars.compile(source);
  templateCache.set(templateName, compiled);
  return compiled;
}

function formatMoney(amount: unknown): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: unknown): string {
  if (!dateStr) return "";
  const d = new Date(String(dateStr));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Register Handlebars helpers used by email templates
Handlebars.registerHelper("formatMoney", formatMoney);
Handlebars.registerHelper("formatDate", formatDate);

// ── Core send ───────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const transport = createTransport();
  try {
    const info = await transport.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
      to,
      subject,
      html,
    });
    logger.info("Email sent", { to, subject, messageId: info.messageId });
  } catch (err) {
    logger.error("Email send failed", { to, subject, err });
    throw err;
  }
}

// ── Invoice email ───────────────────────────────────────────────────────────

export async function sendInvoiceEmail(
  orgId: string,
  invoiceId: string,
  clientEmail: string,
): Promise<void> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendInvoiceEmail: invoice not found", { orgId, invoiceId });
    return;
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendInvoiceEmail: organization not found", { orgId });
    return;
  }

  const template = loadTemplate("email-invoice");
  const html = template({
    org,
    invoice,
    portalUrl: config.corsOrigin,
    invoiceId,
    formatMoney,
    formatDate,
  });

  await sendEmail(
    clientEmail,
    `Invoice ${(invoice as Record<string, unknown>).invoiceNumber ?? invoiceId} from ${(org as Record<string, unknown>).name ?? ""}`,
    html,
  );
}

// ── Payment receipt email ───────────────────────────────────────────────────

export async function sendPaymentReceiptEmail(
  orgId: string,
  paymentId: string,
  clientEmail: string,
): Promise<void> {
  const db = await getDB();

  const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
  if (!payment) {
    logger.warn("sendPaymentReceiptEmail: payment not found", { orgId, paymentId });
    return;
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReceiptEmail: organization not found", { orgId });
    return;
  }

  // If the payment references an invoice, load it
  let invoice: unknown = null;
  const invoiceId = (payment as Record<string, unknown>).invoiceId ?? (payment as Record<string, unknown>).invoice_id;
  if (invoiceId) {
    invoice = await db.findOne("invoices", { id: invoiceId as string, org_id: orgId });
  }

  const template = loadTemplate("email-payment-receipt");
  const html = template({
    org,
    payment,
    invoice,
    portalUrl: config.corsOrigin,
  });

  await sendEmail(
    clientEmail,
    `Payment Receipt from ${(org as Record<string, unknown>).name ?? ""}`,
    html,
  );
}

// ── Quote email ─────────────────────────────────────────────────────────────

export async function sendQuoteEmail(
  orgId: string,
  quoteId: string,
  clientEmail: string,
): Promise<void> {
  const db = await getDB();

  const quote = await db.findOne("quotes", { id: quoteId, org_id: orgId });
  if (!quote) {
    logger.warn("sendQuoteEmail: quote not found", { orgId, quoteId });
    return;
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendQuoteEmail: organization not found", { orgId });
    return;
  }

  const template = loadTemplate("email-quote");
  const html = template({
    org,
    quote,
    portalUrl: config.corsOrigin,
    quoteId,
  });

  await sendEmail(
    clientEmail,
    `Quote ${(quote as Record<string, unknown>).quoteNumber ?? quoteId} from ${(org as Record<string, unknown>).name ?? ""}`,
    html,
  );
}

// ── Payment reminder email ──────────────────────────────────────────────────

export async function sendPaymentReminderEmail(
  orgId: string,
  invoiceId: string,
  clientEmail: string,
): Promise<void> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendPaymentReminderEmail: invoice not found", { orgId, invoiceId });
    return;
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReminderEmail: organization not found", { orgId });
    return;
  }

  // Calculate days overdue
  const dueDate = new Date(String((invoice as Record<string, unknown>).dueDate ?? (invoice as Record<string, unknown>).due_date));
  const now = new Date();
  const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

  const template = loadTemplate("email-payment-reminder");
  const html = template({
    org,
    invoice,
    invoiceId,
    daysOverdue,
    portalUrl: config.corsOrigin,
  });

  await sendEmail(
    clientEmail,
    `Payment Reminder: Invoice ${(invoice as Record<string, unknown>).invoiceNumber ?? invoiceId}`,
    html,
  );
}

// ── Trial ending email ──────────────────────────────────────────────────

export async function sendTrialEndingEmail(
  orgId: string,
  clientEmail: string,
  clientName: string,
  planName: string,
  planPrice: number,
  planCurrency: string,
  trialEndDate: string,
  daysLeft: number,
): Promise<void> {
  const db = await getDB();

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendTrialEndingEmail: organization not found", { orgId });
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

  await sendEmail(
    clientEmail,
    `Your trial for ${planName} is ending in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    html,
  );
}
