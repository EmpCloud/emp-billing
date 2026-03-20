"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueInvoiceEmail = queueInvoiceEmail;
exports.queuePaymentReceiptEmail = queuePaymentReceiptEmail;
exports.queueQuoteEmail = queueQuoteEmail;
exports.queuePaymentReminderEmail = queuePaymentReminderEmail;
exports.queueGenericEmail = queueGenericEmail;
const queue_1 = require("../../jobs/queue");
// ============================================================================
// EMAIL QUEUE HELPERS
// Convenience functions to enqueue emails instead of sending directly.
// All jobs use 3 attempts with exponential backoff.
// ============================================================================
const defaultJobOpts = {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
};
async function queueInvoiceEmail(orgId, invoiceId, clientEmail) {
    await queue_1.emailQueue.add("send-email", { type: "invoice", orgId, invoiceId, clientEmail }, defaultJobOpts);
}
async function queuePaymentReceiptEmail(orgId, paymentId, clientEmail) {
    await queue_1.emailQueue.add("send-email", { type: "payment-receipt", orgId, paymentId, clientEmail }, defaultJobOpts);
}
async function queueQuoteEmail(orgId, quoteId, clientEmail) {
    await queue_1.emailQueue.add("send-email", { type: "quote", orgId, quoteId, clientEmail }, defaultJobOpts);
}
async function queuePaymentReminderEmail(orgId, invoiceId, clientEmail) {
    await queue_1.emailQueue.add("send-email", { type: "payment-reminder", orgId, invoiceId, clientEmail }, defaultJobOpts);
}
async function queueGenericEmail(to, subject, html) {
    await queue_1.emailQueue.add("send-email", { type: "generic", to, subject, html }, defaultJobOpts);
}
//# sourceMappingURL=email.queue.js.map