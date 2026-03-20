"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const pdf_1 = require("../utils/pdf");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// ============================================================================
// PDF WORKER
// Processes PDF generation jobs with concurrency of 2.
// ============================================================================
const PDF_DIR = path_1.default.join(process.cwd(), "uploads", "pdfs");
async function ensureDir() {
    await promises_1.default.mkdir(PDF_DIR, { recursive: true });
}
const pdfWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.PDF, async (job) => {
    const { data } = job;
    try {
        await ensureDir();
        let buffer;
        switch (data.type) {
            case "invoice-pdf":
                buffer = await (0, pdf_1.generateInvoicePdf)(data.data);
                break;
            case "quote-pdf":
                // Uses the same PDF layout as invoices for now
                buffer = await (0, pdf_1.generateInvoicePdf)(data.data);
                break;
            case "credit-note-pdf":
                // Uses the same PDF layout as invoices for now
                buffer = await (0, pdf_1.generateInvoicePdf)(data.data);
                break;
            case "receipt-pdf":
                // Uses the same PDF layout as invoices for now
                buffer = await (0, pdf_1.generateInvoicePdf)(data.data);
                break;
            default:
                logger_1.logger.warn("Unknown PDF job type", { jobId: job.id, data });
                throw new Error(`Unknown PDF job type: ${data.type}`);
        }
        const filePath = path_1.default.join(PDF_DIR, data.filename || `${data.type}-${job.id}.pdf`);
        await promises_1.default.writeFile(filePath, buffer);
        return filePath;
    }
    catch (err) {
        logger_1.logger.error("PDF worker job failed", { jobId: job.id, type: data.type, err });
        throw err; // re-throw so BullMQ marks the job as failed and retries if configured
    }
}, { connection: queue_1.connection, concurrency: 2 });
exports.pdfWorker = pdfWorker;
// ── Worker events ────────────────────────────────────────────────────────────
pdfWorker.on("completed", (job) => {
    logger_1.logger.info("PDF job completed", { jobId: job.id, type: job.data.type, filePath: job.returnvalue });
});
pdfWorker.on("failed", (job, err) => {
    logger_1.logger.error("PDF job failed", { jobId: job?.id, type: job?.data?.type, error: err.message });
});
//# sourceMappingURL=pdf.worker.js.map