"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioSMSProvider = void 0;
exports.renderSMSTemplate = renderSMSTemplate;
exports.getSMSProvider = getSMSProvider;
exports.setSMSProvider = setSMSProvider;
exports.sendSMS = sendSMS;
exports.sendInvoiceSMS = sendInvoiceSMS;
exports.sendPaymentReceivedSMS = sendPaymentReceivedSMS;
exports.sendPaymentReminderSMS = sendPaymentReminderSMS;
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
const index_2 = require("../../db/adapters/index");
const SMS_TEMPLATES = {
    invoice_sent: (data) => `[${data.orgName}] Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} has been sent to you. Due: ${data.dueDate}. View at: ${data.portalUrl}`,
    payment_received: (data) => `[${data.orgName}] Payment of ${data.currency} ${data.amount} received for Invoice ${data.invoiceNumber}. Thank you!`,
    payment_reminder: (data) => {
        const overdue = data.daysOverdue && data.daysOverdue > 0;
        return overdue
            ? `[${data.orgName}] Reminder: Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} is ${data.daysOverdue} day(s) overdue. Please pay at: ${data.portalUrl}`
            : `[${data.orgName}] Reminder: Invoice ${data.invoiceNumber} for ${data.currency} ${data.amount} is due on ${data.dueDate}. Pay at: ${data.portalUrl}`;
    },
};
function renderSMSTemplate(templateName, data) {
    const templateFn = SMS_TEMPLATES[templateName];
    return templateFn(data);
}
// ── Twilio SMS Provider ─────────────────────────────────────────────────────
class TwilioSMSProvider {
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
    async sendSMS(to, message) {
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
            logger_1.logger.error("Twilio SMS send failed", {
                status: response.status,
                body: errorBody,
                to,
            });
            return { messageId: "", status: "failed" };
        }
        const result = (await response.json());
        logger_1.logger.info("Twilio SMS sent", { to, messageId: result.sid, status: result.status });
        return {
            messageId: result.sid,
            status: result.status === "failed" || result.status === "undelivered" ? "failed" : "queued",
        };
    }
}
exports.TwilioSMSProvider = TwilioSMSProvider;
// ── Provider factory ────────────────────────────────────────────────────────
let smsProvider = null;
function getSMSProvider() {
    if (smsProvider)
        return smsProvider;
    const accountSid = index_1.config.sms.twilioAccountSid;
    const authToken = index_1.config.sms.twilioAuthToken;
    const fromNumber = index_1.config.sms.twilioFromNumber;
    if (!accountSid || !authToken || !fromNumber) {
        throw new Error("SMS provider (Twilio) is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.");
    }
    smsProvider = new TwilioSMSProvider(accountSid, authToken, fromNumber);
    return smsProvider;
}
/** Allow injecting a custom provider (useful for testing or alternative providers) */
function setSMSProvider(provider) {
    smsProvider = provider;
}
// ── High-level send functions ───────────────────────────────────────────────
async function sendSMS(to, message) {
    const provider = getSMSProvider();
    try {
        const result = await provider.sendSMS(to, message);
        logger_1.logger.info("SMS sent", { to, status: result.status, messageId: result.messageId });
        return result;
    }
    catch (err) {
        logger_1.logger.error("SMS send failed", { to, err });
        throw err;
    }
}
async function sendInvoiceSMS(orgId, invoiceId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendInvoiceSMS: invoice not found", { orgId, invoiceId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendInvoiceSMS: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const inv = invoice;
    const orgData = org;
    const message = renderSMSTemplate("invoice_sent", {
        orgName: String(orgData.name ?? ""),
        invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? invoiceId),
        amount: formatAmount(inv.total ?? inv.total_amount),
        currency: String(inv.currency ?? "INR"),
        dueDate: formatDateShort(inv.dueDate ?? inv.due_date),
        portalUrl: index_1.config.corsOrigin,
    });
    return sendSMS(phoneNumber, message);
}
async function sendPaymentReceivedSMS(orgId, paymentId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const payment = await db.findOne("payments", { id: paymentId, org_id: orgId });
    if (!payment) {
        logger_1.logger.warn("sendPaymentReceivedSMS: payment not found", { orgId, paymentId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReceivedSMS: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const pay = payment;
    const orgData = org;
    // Resolve invoice number if available
    let invoiceNumber = "N/A";
    const invoiceId = pay.invoiceId ?? pay.invoice_id;
    if (invoiceId) {
        const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
        if (invoice) {
            const inv = invoice;
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
async function sendPaymentReminderSMS(orgId, invoiceId, phoneNumber) {
    const db = await (0, index_2.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("sendPaymentReminderSMS: invoice not found", { orgId, invoiceId });
        return { messageId: "", status: "failed" };
    }
    const org = await db.findOne("organizations", { id: orgId });
    if (!org) {
        logger_1.logger.warn("sendPaymentReminderSMS: organization not found", { orgId });
        return { messageId: "", status: "failed" };
    }
    const inv = invoice;
    const orgData = org;
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
        portalUrl: index_1.config.corsOrigin,
    });
    return sendSMS(phoneNumber, message);
}
// ── Utility helpers ─────────────────────────────────────────────────────────
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
//# sourceMappingURL=sms.service.js.map