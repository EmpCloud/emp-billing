import { Worker } from "bullmq";
import dayjs from "dayjs";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { DunningAttemptStatus, InvoiceStatus } from "@emp-billing/shared";
import * as dunningService from "../services/dunning/dunning.service";

// ============================================================================
// DUNNING WORKER
// Runs every 6 hours — processes pending dunning retries and creates
// initial dunning attempts for overdue invoices without them.
// ============================================================================

interface DunningAttemptRow {
  id: string;
  orgId: string;
  invoiceId: string;
  subscriptionId: string | null;
  attemptNumber: number;
  status: string;
  nextRetryAt: Date | string | null;
}

const dunningWorker = new Worker(
  QUEUE_NAMES.DUNNING,
  async (job) => {
    logger.info("Processing dunning attempts", { jobId: job.id });

    const db = await getDB();
    const now = dayjs();
    let processedCount = 0;
    let createdCount = 0;

    // 1. Find all dunning_attempts where status=pending AND next_retry_at <= now
    const pendingAttempts = await db.raw<DunningAttemptRow[]>(
      `SELECT * FROM dunning_attempts WHERE status = ? AND next_retry_at <= ?`,
      [DunningAttemptStatus.PENDING, now.format("YYYY-MM-DD HH:mm:ss")],
    );

    for (const attempt of pendingAttempts) {
      try {
        await dunningService.processDunningAttempt(attempt.id);
        processedCount++;
      } catch (err) {
        logger.error("Failed to process dunning attempt", {
          attemptId: attempt.id,
          err,
        });
      }
    }

    // 2. Find overdue invoices without any dunning attempts and create initial attempts
    const overdueInvoices = await db.raw<{
      id: string;
      org_id: string;
      client_id: string;
    }[]>(
      `SELECT i.id, i.org_id, i.client_id
       FROM invoices i
       WHERE i.status = ?
         AND i.amount_due > 0
         AND NOT EXISTS (
           SELECT 1 FROM dunning_attempts da WHERE da.invoice_id = i.id
         )`,
      [InvoiceStatus.OVERDUE],
    );

    for (const invoice of overdueInvoices) {
      try {
        // Try to find a subscription linked to this invoice
        const subscriptions = await db.raw<{ id: string }[]>(
          `SELECT s.id FROM subscriptions s
           JOIN invoices i ON i.recurring_profile_id IS NOT NULL
           WHERE s.org_id = ? AND s.client_id = ?
           ORDER BY s.created_at DESC LIMIT 1`,
          [invoice.org_id, invoice.client_id],
        );
        const subscriptionId = subscriptions[0]?.id ?? undefined;

        await dunningService.createDunningAttempt(
          invoice.org_id,
          invoice.id,
          subscriptionId,
        );
        createdCount++;
      } catch (err) {
        logger.error("Failed to create dunning attempt for overdue invoice", {
          invoiceId: invoice.id,
          err,
        });
      }
    }

    logger.info(
      `Dunning worker: processed ${processedCount} retries, created ${createdCount} new attempts`,
    );
  },
  { connection, concurrency: 1 },
);

// ── Worker events ────────────────────────────────────────────────────────────

dunningWorker.on("completed", (job) => {
  logger.info("Dunning job completed", { jobId: job.id });
});

dunningWorker.on("failed", (job, err) => {
  logger.error("Dunning job failed", { jobId: job?.id, error: err.message });
});

export { dunningWorker };
