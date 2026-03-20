"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueInvoicePdf = queueInvoicePdf;
exports.queueQuotePdf = queueQuotePdf;
exports.queueCreditNotePdf = queueCreditNotePdf;
exports.queueReceiptPdf = queueReceiptPdf;
const queue_1 = require("../../jobs/queue");
// ============================================================================
// PDF QUEUE HELPERS
// Convenience functions to enqueue PDF generation jobs.
// All jobs use 2 attempts with exponential backoff.
// ============================================================================
const defaultJobOpts = {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
};
async function queueInvoicePdf(data, filename) {
    await queue_1.pdfQueue.add("generate-pdf", { type: "invoice-pdf", data, filename }, defaultJobOpts);
}
async function queueQuotePdf(data, filename) {
    await queue_1.pdfQueue.add("generate-pdf", { type: "quote-pdf", data, filename }, defaultJobOpts);
}
async function queueCreditNotePdf(data, filename) {
    await queue_1.pdfQueue.add("generate-pdf", { type: "credit-note-pdf", data, filename }, defaultJobOpts);
}
async function queueReceiptPdf(data, filename) {
    await queue_1.pdfQueue.add("generate-pdf", { type: "receipt-pdf", data, filename }, defaultJobOpts);
}
//# sourceMappingURL=pdf.queue.js.map