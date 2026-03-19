import { logger } from "../utils/logger";
import { scheduleRecurringJobs, scheduleReminderJobs, scheduleScheduledReportJobs, scheduleDunningJobs, scheduleSubscriptionJobs, scheduleUsageBillingJobs } from "./queue";
import "./email.worker";
import "./recurring.worker";
import "./reminder.worker";
import "./pdf.worker";
import "./scheduled-report.worker";
import "./dunning.worker";
import "./subscription.worker";
import "./usage-billing.worker";

// ============================================================================
// WORKER BOOTSTRAP
// Call startWorkers() once during server startup.
// ============================================================================

export async function startWorkers(): Promise<void> {
  try {
    await scheduleRecurringJobs();
    await scheduleReminderJobs();
    await scheduleScheduledReportJobs();
    await scheduleDunningJobs();
    await scheduleSubscriptionJobs();
    await scheduleUsageBillingJobs();
    logger.info("All BullMQ workers started");
  } catch (err) {
    logger.warn("BullMQ workers not started (Redis may be unavailable)", { err });
  }
}
