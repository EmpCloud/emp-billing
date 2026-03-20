"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = exports.usageBillingQueue = exports.subscriptionQueue = exports.dunningQueue = exports.scheduledReportQueue = exports.pdfQueue = exports.reminderQueue = exports.recurringQueue = exports.emailQueue = exports.QUEUE_NAMES = void 0;
exports.scheduleRecurringJobs = scheduleRecurringJobs;
exports.scheduleReminderJobs = scheduleReminderJobs;
exports.scheduleScheduledReportJobs = scheduleScheduledReportJobs;
exports.scheduleDunningJobs = scheduleDunningJobs;
exports.scheduleSubscriptionJobs = scheduleSubscriptionJobs;
exports.scheduleUsageBillingJobs = scheduleUsageBillingJobs;
const bullmq_1 = require("bullmq");
const index_1 = require("../config/index");
const logger_1 = require("../utils/logger");
// ── Connection ───────────────────────────────────────────────────────────────
const connection = {
    host: index_1.config.redis.host,
    port: index_1.config.redis.port,
    password: index_1.config.redis.password || undefined,
};
exports.connection = connection;
// ── Queue names ──────────────────────────────────────────────────────────────
exports.QUEUE_NAMES = {
    EMAIL: "email",
    RECURRING: "recurring-invoices",
    REMINDERS: "payment-reminders",
    PDF: "pdf-generation",
    SCHEDULED_REPORTS: "scheduled-reports",
    DUNNING: "dunning-retries",
    SUBSCRIPTIONS: "subscription-billing",
    USAGE_BILLING: "usage-billing",
};
// ── Create queues ────────────────────────────────────────────────────────────
exports.emailQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.EMAIL, { connection });
exports.recurringQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.RECURRING, { connection });
exports.reminderQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.REMINDERS, { connection });
exports.pdfQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.PDF, { connection });
exports.scheduledReportQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.SCHEDULED_REPORTS, { connection });
exports.dunningQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.DUNNING, { connection });
exports.subscriptionQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.SUBSCRIPTIONS, { connection });
exports.usageBillingQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.USAGE_BILLING, { connection });
// ── Job schedulers ───────────────────────────────────────────────────────────
/** Schedule recurring invoice generation — runs every hour */
async function scheduleRecurringJobs() {
    // Remove existing repeatable jobs first to avoid duplicates
    const existingJobs = await exports.recurringQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.recurringQueue.removeRepeatableByKey(job.key);
    }
    await exports.recurringQueue.add("process-recurring", {}, { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled recurring invoice job (hourly)");
}
/** Schedule payment reminder check — runs daily at 8am */
async function scheduleReminderJobs() {
    const existingJobs = await exports.reminderQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.reminderQueue.removeRepeatableByKey(job.key);
    }
    await exports.reminderQueue.add("check-reminders", {}, { repeat: { pattern: "0 8 * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled payment reminder job (daily 8am)");
}
/** Schedule scheduled report processing — runs every hour */
async function scheduleScheduledReportJobs() {
    const existingJobs = await exports.scheduledReportQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.scheduledReportQueue.removeRepeatableByKey(job.key);
    }
    await exports.scheduledReportQueue.add("process-scheduled-reports", {}, { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled report job (hourly)");
}
/** Schedule dunning retry processing — runs every 6 hours */
async function scheduleDunningJobs() {
    const existingJobs = await exports.dunningQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.dunningQueue.removeRepeatableByKey(job.key);
    }
    await exports.dunningQueue.add("process-dunning", {}, { repeat: { pattern: "0 */6 * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled dunning retry job (every 6 hours)");
}
/** Schedule subscription billing — runs daily at midnight */
async function scheduleSubscriptionJobs() {
    const existingJobs = await exports.subscriptionQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.subscriptionQueue.removeRepeatableByKey(job.key);
    }
    await exports.subscriptionQueue.add("process-subscriptions", {}, { repeat: { pattern: "0 0 * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled subscription billing job (daily midnight)");
}
/** Schedule usage billing — runs daily at 1am */
async function scheduleUsageBillingJobs() {
    const existingJobs = await exports.usageBillingQueue.getRepeatableJobs();
    for (const job of existingJobs) {
        await exports.usageBillingQueue.removeRepeatableByKey(job.key);
    }
    await exports.usageBillingQueue.add("process-usage-billing", {}, { repeat: { pattern: "0 1 * * *" }, removeOnComplete: 100, removeOnFail: 50 });
    logger_1.logger.info("Scheduled usage billing job (daily 1am)");
}
//# sourceMappingURL=queue.js.map