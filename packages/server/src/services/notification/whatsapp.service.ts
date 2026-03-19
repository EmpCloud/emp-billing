import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import { getDB } from "../../db/adapters/index";

// ============================================================================
// WHATSAPP SERVICE
// Supports two provider backends: Twilio WhatsApp and Meta Cloud API.
// ============================================================================

// ── Provider interface ──────────────────────────────────────────────────────

export interface WhatsAppSendResult {
  messageId: string;
  status: "queued" | "sent" | "failed";
}

export interface WhatsAppTemplateParams {
  [key: string]: string;
}

export interface IWhatsAppProvider {
  sendWhatsApp(
    to: string,
    templateName: string,
    templateParams: WhatsAppTemplateParams,
    language?: string,
  ): Promise<WhatsAppSendResult>;
}

// ── Template definitions ────────────────────────────────────────────────────

export type WhatsAppTemplateName =
  | "invoice_sent"
  | "payment_received"
  | "payment_reminder";

/** Maps logical template names to the parameter keys each template expects */
export const WHATSAPP_TEMPLATE_PARAM_KEYS: Record<WhatsAppTemplateName, string[]> = {
  invoice_sent: ["orgName", "invoiceNumber", "amount", "currency", "dueDate", "portalUrl"],
  payment_received: ["orgName", "invoiceNumber", "amount", "currency"],
  payment_reminder: ["orgName", "invoiceNumber", "amount", "currency", "dueDate", "daysOverdue", "portalUrl"],
};

// ── Twilio WhatsApp Provider ────────────────────────────────────────────────

export class TwilioWhatsAppProvider implements IWhatsAppProvider {
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

  async sendWhatsApp(
    to: string,
    templateName: string,
    templateParams: WhatsAppTemplateParams,
  ): Promise<WhatsAppSendResult> {
    const url = `${this.baseUrl}/Messages.json`;

    // Twilio WhatsApp uses content templates via ContentSid or freeform body.
    // For template-based messaging, we send structured body text with the
    // "whatsapp:" prefix on the From/To numbers.
    const paramValues = Object.values(templateParams);
    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: `whatsapp:${this.fromNumber}`,
      // Twilio Content Templates: pass ContentSid + ContentVariables
      // For simplicity we fall back to a text body with template params merged.
      Body: buildFallbackBody(templateName, templateParams),
    });

    // If a Twilio Content SID mapping is available, use it instead of plain body
    const contentSid = config.whatsapp.twilioContentSids?.[templateName];
    if (contentSid) {
      body.delete("Body");
      body.set("ContentSid", contentSid);
      body.set("ContentVariables", JSON.stringify(
        paramValues.reduce<Record<string, string>>((acc, val, idx) => {
          acc[String(idx + 1)] = val;
          return acc;
        }, {}),
      ));
    }

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
      logger.error("Twilio WhatsApp send failed", {
        status: response.status,
        body: errorBody,
        to,
        templateName,
      });
      return { messageId: "", status: "failed" };
    }

    const result = (await response.json()) as { sid: string; status: string };
    logger.info("Twilio WhatsApp sent", { to, messageId: result.sid, templateName });

    return {
      messageId: result.sid,
      status: result.status === "failed" || result.status === "undelivered" ? "failed" : "queued",
    };
  }
}

// ── Meta Cloud API Provider ─────────────────────────────────────────────────

export class MetaWhatsAppProvider implements IWhatsAppProvider {
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  constructor(phoneNumberId: string, accessToken: string, apiVersion = "v18.0") {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  async sendWhatsApp(
    to: string,
    templateName: string,
    templateParams: WhatsAppTemplateParams,
    language = "en",
  ): Promise<WhatsAppSendResult> {
    const url = `${this.baseUrl}/messages`;

    // Build template components — all params go into the body component
    const paramValues = Object.values(templateParams);
    const components = [
      {
        type: "body",
        parameters: paramValues.map((val) => ({
          type: "text",
          text: val,
        })),
      },
    ];

    const payload = {
      messaging_product: "whatsapp",
      to: to.replace(/[^0-9]/g, ""), // strip non-digits
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("Meta WhatsApp send failed", {
        status: response.status,
        body: errorBody,
        to,
        templateName,
      });
      return { messageId: "", status: "failed" };
    }

    const result = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };
    const messageId = result.messages?.[0]?.id ?? "";
    logger.info("Meta WhatsApp sent", { to, messageId, templateName });

    return { messageId, status: "queued" };
  }
}

// ── Provider factory ────────────────────────────────────────────────────────

let whatsappProvider: IWhatsAppProvider | null = null;

export function getWhatsAppProvider(): IWhatsAppProvider {
  if (whatsappProvider) return whatsappProvider;

  const providerType = config.whatsapp.provider;

  if (providerType === "meta") {
    const phoneNumberId = config.whatsapp.metaPhoneNumberId;
    const accessToken = config.whatsapp.metaAccessToken;
    if (!phoneNumberId || !accessToken) {
      throw new Error("Meta WhatsApp provider is not configured. Set WHATSAPP_META_PHONE_NUMBER_ID and WHATSAPP_META_ACCESS_TOKEN.");
    }
    whatsappProvider = new MetaWhatsAppProvider(phoneNumberId, accessToken, config.whatsapp.metaApiVersion);
  } else {
    // Default: Twilio
    const accountSid = config.whatsapp.twilioAccountSid || config.sms.twilioAccountSid;
    const authToken = config.whatsapp.twilioAuthToken || config.sms.twilioAuthToken;
    const fromNumber = config.whatsapp.twilioFromNumber;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio WhatsApp provider is not configured. Set WHATSAPP_TWILIO_FROM_NUMBER (and optionally WHATSAPP_TWILIO_ACCOUNT_SID / WHATSAPP_TWILIO_AUTH_TOKEN).");
    }
    whatsappProvider = new TwilioWhatsAppProvider(accountSid, authToken, fromNumber);
  }

  return whatsappProvider;
}

/** Allow injecting a custom provider (useful for testing) */
export function setWhatsAppProvider(provider: IWhatsAppProvider): void {
  whatsappProvider = provider;
}

// ── Core send ───────────────────────────────────────────────────────────────

export async function sendWhatsApp(
  to: string,
  templateName: string,
  templateParams: WhatsAppTemplateParams,
  language?: string,
): Promise<WhatsAppSendResult> {
  const provider = getWhatsAppProvider();
  try {
    const result = await provider.sendWhatsApp(to, templateName, templateParams, language);
    logger.info("WhatsApp message sent", { to, templateName, status: result.status, messageId: result.messageId });
    return result;
  } catch (err) {
    logger.error("WhatsApp send failed", { to, templateName, err });
    throw err;
  }
}

// ── High-level domain send functions ────────────────────────────────────────

export async function sendInvoiceWhatsApp(
  orgId: string,
  invoiceId: string,
  phoneNumber: string,
): Promise<WhatsAppSendResult> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendInvoiceWhatsApp: invoice not found", { orgId, invoiceId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendInvoiceWhatsApp: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const inv = invoice as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  return sendWhatsApp(phoneNumber, "invoice_sent", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
    amount: formatAmount(inv.total ?? inv.total_amount),
    currency: String(inv.currency ?? "INR"),
    dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
    portalUrl: config.corsOrigin,
  });
}

export async function sendPaymentReceivedWhatsApp(
  orgId: string,
  paymentId: string,
  phoneNumber: string,
): Promise<WhatsAppSendResult> {
  const db = await getDB();

  const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
  if (!payment) {
    logger.warn("sendPaymentReceivedWhatsApp: payment not found", { orgId, paymentId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReceivedWhatsApp: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const pay = payment as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  let invoiceNumber = "N/A";
  const invoiceId = pay.invoiceId ?? pay.invoice_id;
  if (invoiceId) {
    const invoice = await db.findOne("invoices", { id: invoiceId as string, org_id: orgId });
    if (invoice) {
      const inv = invoice as Record<string, unknown>;
      invoiceNumber = String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId);
    }
  }

  return sendWhatsApp(phoneNumber, "payment_received", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber,
    amount: formatAmount(pay.amount),
    currency: String(pay.currency ?? "INR"),
  });
}

export async function sendPaymentReminderWhatsApp(
  orgId: string,
  invoiceId: string,
  phoneNumber: string,
): Promise<WhatsAppSendResult> {
  const db = await getDB();

  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("sendPaymentReminderWhatsApp: invoice not found", { orgId, invoiceId });
    return { messageId: "", status: "failed" };
  }

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) {
    logger.warn("sendPaymentReminderWhatsApp: organization not found", { orgId });
    return { messageId: "", status: "failed" };
  }

  const inv = invoice as Record<string, unknown>;
  const orgData = org as Record<string, unknown>;

  const dueDate = new Date(String(inv.dueDate ?? inv.due_date));
  const now = new Date();
  const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

  return sendWhatsApp(phoneNumber, "payment_reminder", {
    orgName: String(orgData.name ?? ""),
    invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
    amount: formatAmount(inv.total ?? inv.total_amount),
    currency: String(inv.currency ?? "INR"),
    dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
    daysOverdue: String(daysOverdue),
    portalUrl: config.corsOrigin,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildFallbackBody(templateName: string, params: WhatsAppTemplateParams): string {
  const values = Object.entries(params)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");
  return `[${templateName}] ${values}`;
}

function formatAmount(value: unknown): string {
  const num = typeof value === "number" ? value / 100 : parseFloat(String(value)) / 100 || 0;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateShort(dateStr: unknown): string {
  if (!dateStr) return "";
  const d = new Date(String(dateStr));
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
