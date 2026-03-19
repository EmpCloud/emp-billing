import { Worker } from "bullmq";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { connection, QUEUE_NAMES, emailQueue } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { RecurringStatus } from "@emp-billing/shared";
import { computeNextDate } from "../services/recurring/recurring.service";
import * as invoiceService from "../services/invoice/invoice.service";
import type { RecurringProfile } from "@emp-billing/shared";

// ============================================================================
// RECURRING INVOICE WORKER
// Runs hourly — finds active recurring profiles due for execution and
// generates invoices (or expenses) from their template data.
// ============================================================================

const recurringWorker = new Worker(
  QUEUE_NAMES.RECURRING,
  async (job) => {
    logger.info("Processing recurring invoices", { jobId: job.id });

    const db = await getDB();
    const now = new Date();

    // 1. Query all active profiles whose next_execution_date has passed
    const profiles = await db.findMany<RecurringProfile>("recurring_profiles", {
      where: { status: RecurringStatus.ACTIVE },
    });

    // Filter to only profiles that are due (next_execution_date <= now)
    const dueProfiles = profiles.filter(
      (p) => new Date(p.nextExecutionDate) <= now,
    );

    logger.info(`Found ${dueProfiles.length} recurring profiles due for execution`);

    let successCount = 0;
    let failCount = 0;

    for (const profile of dueProfiles) {
      try {
        // 2a. Parse templateData
        const templateData =
          typeof profile.templateData === "string"
            ? JSON.parse(profile.templateData as string)
            : profile.templateData;

        let generatedId: string | null = null;

        // 2b. Generate invoice or expense based on type
        if (profile.type === "invoice") {
          const invoice = await invoiceService.createInvoice(
            profile.orgId,
            profile.createdBy,
            templateData,
          );
          generatedId = invoice.id;
        }
        // TODO: handle profile.type === "expense" when expense service supports it

        // 2c. Record successful execution
        await db.create("recurring_executions", {
          id: uuid(),
          profileId: profile.id,
          orgId: profile.orgId,
          generatedId,
          executionDate: now,
          status: "success",
          error: null,
          createdAt: now,
        });

        // 2d. Increment occurrence_count
        const newCount = profile.occurrenceCount + 1;

        // 2e. Compute new next_execution_date
        const nextDate = computeNextDate(
          profile.nextExecutionDate,
          profile.frequency,
          profile.customDays,
        );

        // 2f. Check if profile should be marked as completed
        const maxReached =
          profile.maxOccurrences != null && newCount >= profile.maxOccurrences;
        const endDatePassed =
          profile.endDate != null && dayjs(nextDate).isAfter(dayjs(profile.endDate));

        const newStatus =
          maxReached || endDatePassed
            ? RecurringStatus.COMPLETED
            : RecurringStatus.ACTIVE;

        await db.update(
          "recurring_profiles",
          profile.id,
          {
            occurrenceCount: newCount,
            nextExecutionDate: nextDate,
            status: newStatus,
            updatedAt: now,
          },
          profile.orgId,
        );

        // 2g. If autoSend, queue email
        if (profile.autoSend && generatedId) {
          // Look up client email
          const client = await db.findById<{ id: string; email: string }>(
            "clients",
            profile.clientId,
            profile.orgId,
          );
          if (client?.email) {
            await emailQueue.add(
              "send-email",
              {
                type: "invoice",
                orgId: profile.orgId,
                invoiceId: generatedId,
                clientEmail: client.email,
              },
              {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
              },
            );
          }
        }

        successCount++;
        logger.info("Recurring profile executed successfully", {
          profileId: profile.id,
          generatedId,
          newStatus,
        });
      } catch (err) {
        failCount++;

        // 3. On failure, record execution with error and continue
        try {
          await db.create("recurring_executions", {
            id: uuid(),
            profileId: profile.id,
            orgId: profile.orgId,
            generatedId: null,
            executionDate: now,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            createdAt: now,
          });
        } catch (recordErr) {
          logger.error("Failed to record execution failure", {
            profileId: profile.id,
            recordErr,
          });
        }

        logger.error("Recurring profile execution failed", {
          profileId: profile.id,
          err,
        });
      }
    }

    logger.info("Recurring invoice processing complete", {
      total: dueProfiles.length,
      success: successCount,
      failed: failCount,
    });
  },
  { connection, concurrency: 1 },
);

// ── Worker events ────────────────────────────────────────────────────────────

recurringWorker.on("completed", (job) => {
  logger.info("Recurring job completed", { jobId: job.id });
});

recurringWorker.on("failed", (job, err) => {
  logger.error("Recurring job failed", { jobId: job?.id, error: err.message });
});

export { recurringWorker };
