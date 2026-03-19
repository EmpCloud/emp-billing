import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import { getDB } from "../../db/adapters/index";

// ============================================================================
// SMS SERVICE
// ============================================================================

// ── Provider interface ──────────────────────────────────────────────────────

export interface SMSSendResult {
  messageId: string;
  status: "queued" | "sent" | "failed";
}

export interface ISMSProvider {
  sendSMS(to: string, message: string): Promise<SMSSendResult>;
}

// ── SMS Templates ───────────────────────────────────────────────────────────

export type SMSTemplateName =
  | "invoice_sent"
  | "payment_received"
  | "payment_reminder";

interface SMSTemplateData {
  orgName?: string;
  invoiceNumber?: string;
  amount?: string;
  currency?: string;
  dueDate?: string;
  paymentId?: string;
  clientName?: string;
  daysOverdue?: number;
  portalUrl?: string;
}

const SMS_TEMPLATES: Record<SMSTemplateName, (data: SMSTemplateData) => string> = {
  invoice_sent: (data) =>
    `[${data.orgName}] Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} has been sent to you. Due: ${data.dueDate}. View at: ${data.portalUrl}`,

  payment_received: (data) =>
    `[${data.orgName}] Payment of ${data.currency} ${data.amount} received for Invoice ${data.invoiceNumber}. Thank you!`,

  payment_reminder: (data) => {
    const overdue = data.daysOverdue && data.daysOverdue > 0;
    return overdue
      ? `[${data.orgName}] Reminder: Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} is ${data.daysOverdue} day(s) overdue. Please pay at: ${data.portalUrl}`
      : `[${data.orgName}] Reminder: Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} is due on ${data.dueDate}. Pay at: ${data.portalUrl}`;
  },
};

export function renderSMSTemplate(
  templateName: SMSTemplateName,
  data: SMSTemplateData,
): string {
  const templateFn = SMS_TEMPLATES[templateName];
  return templateFn(data);
}

// ── Twilio SMS Provider ─────────────────────────────────────────────────────

export class TwilioSMSProvider implements ISMSProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly baseUrl: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
  }

  async sendSMS(to: string, message: string): Promise<SMSSendResult> {
    const url = `${this.baseUrl}/Messages.json`;

    const body = new URLSearchParams({
      To: to,
      From: this.fromNumber,
      Body: message,
    });

    const authHeader = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("Twilio SMS send failed", {
        status: response.status,
        body: errorBody,
        to,
      });
      return { messageId: "", status: "failed" };
    }

    const result = (await response.json()) as { sid: string; status: string };
    logger.info("Twilio SMS sent", { to, messageId: result.sid, status: result.status });

    return {
      messageId: result.sid,
      status: result.status === "failed" || result.status === "undelivered" ? "failed" : "queued",
    };
  }
}

// ── Provider factory ────────────────────────────────────────────────────────

let smsProvider: ISMSProvider | null = null;

export function getSMSProvider(): ISMSProvider {
  if (smsProvider) return smsProvider;

  const accountSid = config.sms.twilioAccountSid;
  const authToken = config.sms.twilioAuthToken;
  const fromNumber = config.sms.twilioFromNumber;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("SMS provider (Twilio) is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
  }

  smsProvider = new TwilioSMSProvider(accountSid, authToken, fromNumber);
  return smsProvider;
}

/** Allow injecting a custom provider (useful for testing or alternative providers) */
export function setSMSProvider(provider: ISMSProvider): void {
  smsProvider = provider;
}

// ── High-level send functions ───────────────────────────────────────────────

export async function sendSMS(to: string, message: string): Promise<SMSSendResult> {
  const provider = getSMSProvider();
  try {
    const result = await provider.sendSMS(to, message);
    logger.info("SMS sent", { to, status: result.status, messageId: result.messageId });
    return result;
  } catch (err) {
    logger.error("SMS send failed", { to, err });
    throw err;
  }
}

export async function sendInvoiceSMS(
  orgId: string,
  invoiceId: string,
  phoneNumber: string,
): Promise<SMSSendResult> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendInvoiceSMS: invoice not found", { orgId, invoiceId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendInvoiceSMS: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const inv = invoice as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  const message = renderSMSTemplate("invoice_sent", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
    amount: formatAmount(inv.total ?? inv.total_amount),
    currency: String(inv.currency ?? "INR"),
    dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
    portalUrl: config.corsOrigin,
  });

  return sendSMS(phoneNumber, message);
}

export async function sendPaymentReceivedSMS(
  orgId: string,
  paymentId: string,
  phoneNumber: string,
): Promise<SMSSendResult> {
  const db = await getDB();

  const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
  if (!payment) {
    logger.warn("sendPaymentReceivedSMS: payment not found", { orgId, paymentId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReceivedSMS: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const pay = payment as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  // Resolve invoice number if available
  let invoiceNumber = "N/A";
  const invoiceId = pay.invoiceId ?? pay.invoice_id;
  if (invoiceId) {
    const invoice = await db.findOne("invoices", { id: invoiceId as string, org_id: orgId });
    if (invoice) {
      const inv = invoice as Record<string, unknown>;
      invoiceNumber = String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId);
    }
  }

  const message = renderSMSTemplate("payment_received", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber,
    amount: formatAmount(pay.amount),
    currency: String(pay.currency ?? "INR"),
  });

  return sendSMS(phoneNumber, message);
}

export async function sendPaymentReminderSMS(
  orgId: string,
  invoiceId: string,
  phoneNumber: string,
): Promise<SMSSendResult> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendPaymentReminderSMS: invoice not found", { orgId, invoiceId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReminderSMS: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const inv = invoice as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  const dueDate = new Date(String(inv.dueDate ?? inv.due_date));
  const now = new Date();
  const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

  const message = renderSMSTemplate("payment_reminder", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
    amount: formatAmount(inv.total ?? inv.total_amount),
    currency: String(inv.currency ?? "INR"),
    dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
    daysOverdue,
    portalUrl: config.corsOrigin,
  });

  return sendSMS(phoneNumber, message);
}

// ── Utility helpers ─────────────────────────────────────────────────────────

function formatAmount(value: unknown): string {
  const num = typeof value === "number" ? value / 100 : parseFloat(String(value)) / 100 || 0;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateShort(dateStr: unknown): string {
  if (!dateStr) return "";
  const d = new Date(String(dateStr));
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
