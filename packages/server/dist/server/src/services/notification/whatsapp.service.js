"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsAppProvider = exports.TwilioWhatsAppProvider = exports.WHATSAPP_TEMPLATE_PARAM_KEYS = void 0;
exports.getWhatsAppProvider = getWhatsAppProvider;
exports.setWhatsAppProvider = setWhatsAppProvider;
exports.sendWhatsApp = sendWhatsApp;
exports.sendInvoiceWhatsApp = sendInvoiceWhatsApp;
exports.sendPaymentReceivedWhatsApp = sendPaymentReceivedWhatsApp;
exports.sendPaymentReminderWhatsApp = sendPaymentReminderWhatsApp;
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
const index_2 = require("../../db/adapters/index");
/** Maps logical template names to the parameter keys each template expects */
exports.WHATSAPP_TEMPLATE_PARAM_KEYS = {
    invoice_sent: ["orgName", "invoiceNumber", "amount", "currency", "dueDate", "portalUrl"],
    payment_received: ["orgName", "invoiceNumber", "amount", "currency"],
    payment_reminder: ["orgName", "invoiceNumber", "amount", "currency", "dueDate", "daysOverdue", "portalUrl"],
};
// ── Twilio WhatsApp Provider ────────────────────────────────────────────────
class TwilioWhatsAppProvider {
    accountSid;
    authToken;
    fromNumber;
    baseUrl;
    constructor(accountSid, authToken, fromNumber) {
        this.accountSid = accountSid;
        this.authToken = authToken;
        this.fromNumber = fromNumber;
        this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    }
    async sendWhatsApp(to, templateName, templateParams) {
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
        const contentSid = index_1.config.whatsapp.twilioContentSids?.[templateName];
        if (contentSid) {
            body.delete("Body");
            body.set("ContentSid", contentSid);
            body.set("ContentVariables", JSON.stringify(paramValues.reduce((acc, val, idx) => {
                acc[String(idx + 1)] = val;
                return acc;
            }, {})));
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
            logger_1.logger.error("Twilio WhatsApp send failed", {
                status: response.status,
                body: errorBody,
                to,
                templateName,
            });
            return { messageId: "", status: "failed" };
        }
        const result = (await response.json());
        logger_1.logger.info("Twilio WhatsApp sent", { to, messageId: result.sid, templateName });
        return {
            messageId: result.sid,
            status: result.status === "failed" || result.status === "undelivered" ? "failed" : "queued",
        };
    }
}
exports.TwilioWhatsAppProvider = TwilioWhatsAppProvider;
// ── Meta Cloud API Provider ─────────────────────────────────────────────────
class MetaWhatsAppProvider {
    phoneNumberId;
    accessToken;
    apiVersion;
    baseUrl;
    constructor(phoneNumberId, accessToken, apiVersion = "v18.0") {
        this.phoneNumberId = phoneNumberId;
        this.accessToken = accessToken;
        this.apiVersion = apiVersion;
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }
    async sendWhatsApp(to, templateName, templateParams, language = "en") {
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
            logger_1.logger.error("Meta WhatsApp send failed", {
                status: response.status,
                body: errorBody,
                to,
                templateName,
            });
            return { messageId: "", status: "failed" };
        }
        const result = (await response.json());
        const messageId = result.messages?.[0]?.id ?? "";
        logger_1.logger.info("Meta WhatsApp sent", { to, messageId, templateName });
        return { messageId, status: "queued" };
    }
}
exports.MetaWhatsAppProvider = MetaWhatsAppProvider;
// ── Provider factory ────────────────────────────────────────────────────────
let whatsappProvider = null;
function getWhatsAppProvider() {
    if (whatsappProvider)
        return whatsappProvider;
    const providerType = index_1.config.whatsapp.provider;
    if (providerType === "meta") {
        const phoneNumberId = index_1.config.whatsapp.metaPhoneNumberId;
        const accessToken = index_1.config.whatsapp.metaAccessToken;
        if (!phoneNumberId || !accessToken) {
            throw new Error("Meta WhatsApp provider is not configured. Set WHATSAPP_META_PHONE_NUMBER_ID and WHATSAPP_META_ACCESS_TOKEN.");
        }
        whatsappProvider = new MetaWhatsAppProvider(phoneNumberId, accessToken, index_1.config.whatsapp.metaApiVersion);
    }
    else {
        // Default: Twilio
        const accountSid = index_1.config.whatsapp.twilioAccountSid || index_1.config.sms.twilioAccountSid;
        const authToken = index_1.config.whatsapp.twilioAuthToken || index_1.config.sms.twilioAuthToken;
        const fromNumber = index_1.config.whatsapp.twilioFromNumber;
        if (!accountSid || !authToken || !fromNumber) {
            throw new Error("Twilio WhatsApp provider is not configured. Set WHATSAPP_TWILIO_FROM_NUMBER (and optionally WHATSAPP_TWILIO_ACCOUNT_SID / WHATSAPP_TWILIO_AUTH_TOKEN).");
        }
        whatsappProvider = new TwilioWhatsAppProvider(accountSid, authToken, fromNumber);
    }
    return whatsappProvider;
}
/** Allow injecting a custom provider (useful for testing) */
function setWhatsAppProvider(provider) {
    whatsappProvider = provider;
}
// ── Core send ───────────────────────────────────────────────────────────────
async function sendWhatsApp(to, templateName, templateParams, language) {
    const provider = getWhatsAppProvider();
    try {
        const result = await provider.sendWhatsApp(to, templateName, templateParams, language);
        logger_1.logger.info("WhatsApp message sent", { to, templateName, status: result.status, messageId: result.messageId });
        return result;
    }
    catch (err) {
        logger_1.logger.error("WhatsApp send failed", { to, templateName, err });
        throw err;
    }
}
// ── High-level domain send functions ────────────────────────────────────────
async function sendInvoiceWhatsApp(orgId, invoiceId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendInvoiceWhatsApp: invoice not found", { orgId, invoiceId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendInvoiceWhatsApp: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const inv = invoice;
    const orgData = org;
    return sendWhatsApp(phoneNumber, "invoice_sent", {
        orgName: String(orgData.name ?? ""),
        invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
        amount: formatAmount(inv.total ?? inv.total_amount),
        currency: String(inv.currency ?? "INR"),
        dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
        portalUrl: index_1.config.corsOrigin,
    });
}
async function sendPaymentReceivedWhatsApp(orgId, paymentId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
    if (!payment) {
        logger_1.logger.warn("sendPaymentReceivedWhatsApp: payment not found", { orgId, paymentId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReceivedWhatsApp: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const pay = payment;
    const orgData = org;
    let invoiceNumber = "N/A";
    const invoiceId = pay.invoiceId ?? pay.invoice_id;
    if (invoiceId) {
        const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
        if (invoice) {
            const inv = invoice;
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
async function sendPaymentReminderWhatsApp(orgId, invoiceId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendPaymentReminderWhatsApp: invoice not found", { orgId, invoiceId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReminderWhatsApp: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const inv = invoice;
    const orgData = org;
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
        portalUrl: index_1.config.corsOrigin,
    });
}
// ── Helpers ─────────────────────────────────────────────────────────────────
function buildFallbackBody(templateName, params) {
    const values = Object.entries(params)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
    return `[${templateName}] ${values}`;
}
function formatAmount(value) {
    const num = typeof value === "number" ? value / 100 : parseFloat(String(value)) / 100 || 0;
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDateShort(dateStr) {
    if (!dateStr)
        return "";
    const d = new Date(String(dateStr));
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
//# sourceMappingURL=whatsapp.service.js.map