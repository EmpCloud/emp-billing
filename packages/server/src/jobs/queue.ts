import { Queue, type ConnectionOptions } from "bullmq";
import { config } from "../config/index";
import { logger } from "../utils/logger";

// ── Connection ───────────────────────────────────────────────────────────────

const connection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};

// ── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL: "email",
  RECURRING: "recurring-invoices",
  REMINDERS: "payment-reminders",
  PDF: "pdf-generation",
  SCHEDULED_REPORTS: "scheduled-reports",
  DUNNING: "dunning-retries",
  SUBSCRIPTIONS: "subscription-billing",
  USAGE_BILLING: "usage-billing",
} as const;

// ── Create queues ────────────────────────────────────────────────────────────

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, { connection });
export const recurringQueue = new Queue(QUEUE_NAMES.RECURRING, { connection });
export const reminderQueue = new Queue(QUEUE_NAMES.REMINDERS, { connection });
export const pdfQueue = new Queue(QUEUE_NAMES.PDF, { connection });
export const scheduledReportQueue = new Queue(QUEUE_NAMES.SCHEDULED_REPORTS, { connection });
export const dunningQueue = new Queue(QUEUE_NAMES.DUNNING, { connection });
export const subscriptionQueue = new Queue(QUEUE_NAMES.SUBSCRIPTIONS, { connection });
export const usageBillingQueue = new Queue(QUEUE_NAMES.USAGE_BILLING, { connection });

// ── Job schedulers ───────────────────────────────────────────────────────────

/** Schedule recurring invoice generation — runs every hour */
export async function scheduleRecurringJobs(): Promise<void> {
  // Remove existing repeatable jobs first to avoid duplicates
  const existingJobs = await recurringQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await recurringQueue.removeRepeatableByKey(job.key);
  }

  await recurringQueue.add(
    "process-recurring",
    {},
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled recurring invoice job (hourly)");
}

/** Schedule payment reminder check — runs daily at 8am */
export async function scheduleReminderJobs(): Promise<void> {
  const existingJobs = await reminderQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await reminderQueue.removeRepeatableByKey(job.key);
  }

  await reminderQueue.add(
    "check-reminders",
    {},
    { repeat: { pattern: "0 8 * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled payment reminder job (daily 8am)");
}

/** Schedule scheduled report processing — runs every hour */
export async function scheduleScheduledReportJobs(): Promise<void> {
  const existingJobs = await scheduledReportQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await scheduledReportQueue.removeRepeatableByKey(job.key);
  }

  await scheduledReportQueue.add(
    "process-scheduled-reports",
    {},
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled report job (hourly)");
}

/** Schedule dunning retry processing — runs every 6 hours */
export async function scheduleDunningJobs(): Promise<void> {
  const existingJobs = await dunningQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await dunningQueue.removeRepeatableByKey(job.key);
  }

  await dunningQueue.add(
    "process-dunning",
    {},
    { repeat: { pattern: "0 */6 * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled dunning retry job (every 6 hours)");
}

/** Schedule subscription billing — runs daily at midnight */
export async function scheduleSubscriptionJobs(): Promise<void> {
  const existingJobs = await subscriptionQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await subscriptionQueue.removeRepeatableByKey(job.key);
  }

  await subscriptionQueue.add(
    "process-subscriptions",
    {},
    { repeat: { pattern: "0 0 * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled subscription billing job (daily midnight)");
}

/** Schedule usage billing — runs daily at 2am */
export async function scheduleUsageBillingJobs(): Promise<void> {
  const existingJobs = await usageBillingQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await usageBillingQueue.removeRepeatableByKey(job.key);
  }

  await usageBillingQueue.add(
    "process-usage-billing",
    {},
    { repeat: { pattern: "0 2 * * *" }, removeOnComplete: 100, removeOnFail: 50 },
  );
  logger.info("Scheduled usage billing job (daily 2am)");
}

export { connection };
