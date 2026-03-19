import { Worker } from "bullmq";
import dayjs from "dayjs";
import { connection, QUEUE_NAMES, emailQueue } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { InvoiceStatus } from "@emp-billing/shared";

// ============================================================================
// PAYMENT REMINDER WORKER
// Runs daily at 8am — finds invoices approaching or past due date,
// sends reminder emails, and marks overdue invoices.
// ============================================================================

interface InvoiceRow {
  id: string;
  orgId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  dueDate: Date | string;
}

const reminderWorker = new Worker(
  QUEUE_NAMES.REMINDERS,
  async (job) => {
    logger.info("Processing payment reminders", { jobId: job.id });

    const db = await getDB();
    const today = dayjs();
    const threeDaysFromNow = today.add(3, "day");

    let reminderCount = 0;
    let overdueCount = 0;

    // 1. Find all invoices that are sent, viewed, or partially paid
    const statusesToCheck = [
      InvoiceStatus.SENT,
      InvoiceStatus.VIEWED,
      InvoiceStatus.PARTIALLY_PAID,
    ];

    for (const status of statusesToCheck) {
      const invoices = await db.findMany<InvoiceRow>("invoices", {
        where: { status },
      });

      for (const invoice of invoices) {
        try {
          const dueDate = dayjs(invoice.dueDate);
          const isUpcoming =
            dueDate.isAfter(today) &&
            (dueDate.isBefore(threeDaysFromNow) || dueDate.isSame(threeDaysFromNow, "day"));
          const isOverdue = dueDate.isBefore(today, "day");

          if (!isUpcoming && !isOverdue) continue;

          // 2b. Look up client email
          const client = await db.findById<{ id: string; email: string }>(
            "clients",
            invoice.clientId,
            invoice.orgId,
          );

          if (!client?.email) {
            logger.warn("No client email for reminder", {
              invoiceId: invoice.id,
              clientId: invoice.clientId,
            });
            continue;
          }

          // 2c. Queue payment reminder email
          await emailQueue.add(
            "send-email",
            {
              type: "payment-reminder",
              orgId: invoice.orgId,
              invoiceId: invoice.id,
              clientEmail: client.email,
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            },
          );
          reminderCount++;

          // 2d. If overdue, mark the invoice status as OVERDUE
          if (isOverdue) {
            await db.update(
              "invoices",
              invoice.id,
              { status: InvoiceStatus.OVERDUE, updatedAt: new Date() },
              invoice.orgId,
            );
            overdueCount++;
          }
        } catch (err) {
          logger.error("Failed to process reminder for invoice", {
            invoiceId: invoice.id,
            err,
          });
          // Continue processing remaining invoices
        }
      }
    }

    // 3. Log summary
    logger.info(
      `Processed ${reminderCount} reminders, ${overdueCount} marked overdue`,
    );
  },
  { connection, concurrency: 1 },
);

// ── Worker events ────────────────────────────────────────────────────────────

reminderWorker.on("completed", (job) => {
  logger.info("Reminder job completed", { jobId: job.id });
});

reminderWorker.on("failed", (job, err) => {
  logger.error("Reminder job failed", { jobId: job?.id, error: err.message });
});

export { reminderWorker };
