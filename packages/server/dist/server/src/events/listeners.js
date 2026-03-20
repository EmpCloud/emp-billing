"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerListeners = registerListeners;
const index_1 = require("./index");
const logger_1 = require("../utils/logger");
const webhook_service_1 = require("../services/webhook/webhook.service");
const email_service_1 = require("../services/notification/email.service");
const notification_service_1 = require("../services/notification/notification.service");
// ============================================================================
// EVENT LISTENERS
// ============================================================================
// Events that should trigger webhook dispatch
const WEBHOOK_EVENTS = [
    "invoice.created",
    "invoice.sent",
    "invoice.paid",
    "invoice.overdue",
    "payment.received",
    "quote.created",
    "quote.accepted",
    "quote.declined",
    "client.created",
    "expense.created",
    "subscription.created",
    "subscription.activated",
    "subscription.trial_ending",
    "subscription.renewed",
    "subscription.upgraded",
    "subscription.downgraded",
    "subscription.paused",
    "subscription.resumed",
    "subscription.cancelled",
    "subscription.expired",
    "payment.failed",
    "coupon.redeemed",
];
/**
 * Register all event listeners. Call once during server startup.
 */
function registerListeners() {
    // ── Webhook dispatch for all events ─────────────────────────────────────
    for (const event of WEBHOOK_EVENTS) {
        (0, index_1.on)(event, (payload) => {
            logger_1.logger.info(`Event fired: ${event}`, { event, orgId: payload.orgId });
            (0, webhook_service_1.dispatchEvent)(payload.orgId, event, payload).catch((err) => {
                logger_1.logger.error(`Webhook dispatch failed for ${event}`, { err });
            });
        });
    }
    // ── Invoice sent → send email ───────────────────────────────────────────
    (0, index_1.on)("invoice.sent", (payload) => {
        (0, email_service_1.sendInvoiceEmail)(payload.orgId, payload.invoiceId, payload.clientEmail).catch((err) => {
            logger_1.logger.error("Failed to send invoice email", {
                invoiceId: payload.invoiceId,
                err,
            });
        });
    });
    // ── Payment received → send receipt email ───────────────────────────────
    (0, index_1.on)("payment.received", (payload) => {
        // Only send receipt if there is payment data with a client email
        const clientEmail = payload.payment?.clientEmail;
        if (clientEmail) {
            (0, email_service_1.sendPaymentReceiptEmail)(payload.orgId, payload.paymentId, clientEmail).catch((err) => {
                logger_1.logger.error("Failed to send payment receipt email", {
                    paymentId: payload.paymentId,
                    err,
                });
            });
        }
    });
    // ── In-app notifications ──────────────────────────────────────────────────
    (0, index_1.on)("invoice.created", (payload) => {
        const inv = payload.invoice;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "invoice_created",
            title: "Invoice Created",
            message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} has been created.`,
            entityType: "invoice",
            entityId: payload.invoiceId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for invoice.created", { err }));
    });
    (0, index_1.on)("invoice.sent", (payload) => {
        const inv = payload.invoice;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "invoice_sent",
            title: "Invoice Sent",
            message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} was sent to ${payload.clientEmail}.`,
            entityType: "invoice",
            entityId: payload.invoiceId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for invoice.sent", { err }));
    });
    (0, index_1.on)("invoice.paid", (payload) => {
        const inv = payload.invoice;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "invoice_paid",
            title: "Invoice Paid",
            message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} has been fully paid.`,
            entityType: "invoice",
            entityId: payload.invoiceId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for invoice.paid", { err }));
    });
    (0, index_1.on)("invoice.overdue", (payload) => {
        const inv = payload.invoice;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "invoice_overdue",
            title: "Invoice Overdue",
            message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} is now overdue.`,
            entityType: "invoice",
            entityId: payload.invoiceId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for invoice.overdue", { err }));
    });
    (0, index_1.on)("payment.received", (payload) => {
        const pay = payload.payment;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "payment_received",
            title: "Payment Received",
            message: `Payment ${pay.paymentNumber || pay.payment_number || ""} has been recorded.`,
            entityType: "payment",
            entityId: payload.paymentId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for payment.received", { err }));
    });
    (0, index_1.on)("quote.accepted", (payload) => {
        const qt = payload.quote;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "quote_accepted",
            title: "Quote Accepted",
            message: `Quote ${qt.quoteNumber || qt.quote_number || ""} has been accepted by the client.`,
            entityType: "quote",
            entityId: payload.quoteId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for quote.accepted", { err }));
    });
    (0, index_1.on)("expense.created", (payload) => {
        const exp = payload.expense;
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "expense_approved",
            title: "Expense Created",
            message: `A new expense "${exp.description || ""}" has been created.`,
            entityType: "expense",
            entityId: payload.expenseId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for expense.created", { err }));
    });
    // ── Subscription notifications ──────────────────────────────────────────
    (0, index_1.on)("subscription.created", (payload) => {
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "subscription_created",
            title: "New Subscription",
            message: `A new subscription has been created.`,
            entityType: "subscription",
            entityId: payload.subscriptionId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for subscription.created", { err }));
    });
    (0, index_1.on)("subscription.renewed", (payload) => {
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "subscription_renewed",
            title: "Subscription Renewed",
            message: `A subscription has been renewed.`,
            entityType: "subscription",
            entityId: payload.subscriptionId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for subscription.renewed", { err }));
    });
    (0, index_1.on)("subscription.cancelled", (payload) => {
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "subscription_cancelled",
            title: "Subscription Cancelled",
            message: `A subscription has been cancelled.`,
            entityType: "subscription",
            entityId: payload.subscriptionId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for subscription.cancelled", { err }));
    });
    (0, index_1.on)("payment.failed", (payload) => {
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "payment_failed",
            title: "Payment Failed",
            message: `Payment attempt #${payload.attemptNumber} failed for an invoice.`,
            entityType: "invoice",
            entityId: payload.invoiceId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for payment.failed", { err }));
    });
    (0, index_1.on)("subscription.trial_ending", (payload) => {
        (0, notification_service_1.createNotification)(payload.orgId, {
            type: "trial_ending",
            title: "Trial Ending Soon",
            message: `A subscription trial is ending soon.`,
            entityType: "subscription",
            entityId: payload.subscriptionId,
        }).catch((err) => logger_1.logger.error("Failed to create notification for subscription.trial_ending", { err }));
    });
    logger_1.logger.info("Event listeners registered");
}
//# sourceMappingURL=listeners.js.map