import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import * as emailService from "../services/notification/email.service";

// ============================================================================
// EMAIL WORKER
// Processes outbound email jobs with concurrency of 3.
// ============================================================================

interface InvoiceEmailJob {
  type: "invoice";
  orgId: string;
  invoiceId: string;
  clientEmail: string;
}

interface PaymentReceiptEmailJob {
  type: "payment-receipt";
  orgId: string;
  paymentId: string;
  clientEmail: string;
}

interface QuoteEmailJob {
  type: "quote";
  orgId: string;
  quoteId: string;
  clientEmail: string;
}

interface PaymentReminderEmailJob {
  type: "payment-reminder";
  orgId: string;
  invoiceId: string;
  clientEmail: string;
}

interface TrialEndingEmailJob {
  type: "trial-ending";
  orgId: string;
  subscriptionId: string;
  clientEmail: string;
  clientName: string;
  planName: string;
  planPrice: number;
  planCurrency: string;
  trialEndDate: string;
  daysLeft: number;
}

interface GenericEmailJob {
  type: "generic";
  to: string;
  subject: string;
  html: string;
}

type EmailJobData =
  | InvoiceEmailJob
  | PaymentReceiptEmailJob
  | QuoteEmailJob
  | PaymentReminderEmailJob
  | TrialEndingEmailJob
  | GenericEmailJob;

const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    const { data } = job;

    try {
      switch (data.type) {
        case "invoice":
          await emailService.sendInvoiceEmail(data.orgId, data.invoiceId, data.clientEmail);
          break;

        case "payment-receipt":
          await emailService.sendPaymentReceiptEmail(data.orgId, data.paymentId, data.clientEmail);
          break;

        case "quote":
          await emailService.sendQuoteEmail(data.orgId, data.quoteId, data.clientEmail);
          break;

        case "payment-reminder":
          await emailService.sendPaymentReminderEmail(data.orgId, data.invoiceId, data.clientEmail);
          break;

        case "trial-ending":
          await emailService.sendTrialEndingEmail(
            data.orgId,
            data.clientEmail,
            data.clientName,
            data.planName,
            data.planPrice,
            data.planCurrency,
            data.trialEndDate,
            data.daysLeft,
          );
          break;

        case "generic":
          await emailService.sendEmail(data.to, data.subject, data.html);
          break;

        default:
          logger.warn("Unknown email job type", { jobId: job.id, data });
      }
    } catch (err) {
      logger.error("Email worker job failed", { jobId: job.id, type: data.type, err });
      throw err; // re-throw so BullMQ marks the job as failed and retries if configured
    }
  },
  { connection, concurrency: 3 },
);

// ── Worker events ────────────────────────────────────────────────────────────

emailWorker.on("completed", (job) => {
  logger.info("Email job completed", { jobId: job.id, type: job.data.type });
});

emailWorker.on("failed", (job, err) => {
  logger.error("Email job failed", { jobId: job?.id, type: job?.data?.type, error: err.message });
});

export { emailWorker };
