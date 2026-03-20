"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderWorker = void 0;
const bullmq_1 = require("bullmq");
const dayjs_1 = __importDefault(require("dayjs"));
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
const reminderWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.REMINDERS, async (job) => {
    logger_1.logger.info("Processing payment reminders", { jobId: job.id });
    const db = await (0, index_1.getDB)();
    const today = (0, dayjs_1.default)();
    const threeDaysFromNow = today.add(3, "day");
    let reminderCount = 0;
    let overdueCount = 0;
    // 1. Find all invoices that are sent, viewed, or partially paid
    const statusesToCheck = [
        shared_1.InvoiceStatus.SENT,
        shared_1.InvoiceStatus.VIEWED,
        shared_1.InvoiceStatus.PARTIALLY_PAID,
    ];
    for (const status of statusesToCheck) {
        const invoices = await db.findMany("invoices", {
            where: { status },
        });
        for (const invoice of invoices) {
            try {
                const dueDate = (0, dayjs_1.default)(invoice.dueDate);
                const isUpcoming = dueDate.isAfter(today) &&
                    (dueDate.isBefore(threeDaysFromNow) || dueDate.isSame(threeDaysFromNow, "day"));
                const isOverdue = dueDate.isBefore(today, "day");
                if (!isUpcoming && !isOverdue)
                    continue;
                // 2b. Look up client email
                const client = await db.findById("clients", invoice.clientId, invoice.orgId);
                if (!client?.email) {
                    logger_1.logger.warn("No client email for reminder", {
                        invoiceId: invoice.id,
                        clientId: invoice.clientId,
                    });
                    continue;
                }
                // 2c. Queue payment reminder email
                await queue_1.emailQueue.add("send-email", {
                    type: "payment-reminder",
                    orgId: invoice.orgId,
                    invoiceId: invoice.id,
                    clientEmail: client.email,
                }, {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 5000 },
                });
                reminderCount++;
                // 2d. If overdue, mark the invoice status as OVERDUE
                if (isOverdue) {
                    await db.update("invoices", invoice.id, { status: shared_1.InvoiceStatus.OVERDUE, updatedAt: new Date() }, invoice.orgId);
                    overdueCount++;
                }
            }
            catch (err) {
                logger_1.logger.error("Failed to process reminder for invoice", {
                    invoiceId: invoice.id,
                    err,
                });
                // Continue processing remaining invoices
            }
        }
    }
    // 3. Log summary
    logger_1.logger.info(`Processed ${reminderCount} reminders, ${overdueCount} marked overdue`);
}, { connection: queue_1.connection, concurrency: 1 });
exports.reminderWorker = reminderWorker;
// ── Worker events ────────────────────────────────────────────────────────────
reminderWorker.on("completed", (job) => {
    logger_1.logger.info("Reminder job completed", { jobId: job.id });
});
reminderWorker.on("failed", (job, err) => {
    logger_1.logger.error("Reminder job failed", { jobId: job?.id, error: err.message });
});
//# sourceMappingURL=reminder.worker.js.map