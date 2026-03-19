import { emailQueue } from "../../jobs/queue";

// ============================================================================
// EMAIL QUEUE HELPERS
// Convenience functions to enqueue emails instead of sending directly.
// All jobs use 3 attempts with exponential backoff.
// ============================================================================

const defaultJobOpts = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
};

export async function queueInvoiceEmail(
  orgId: string,
  invoiceId: string,
  clientEmail: string,
): Promise<void> {
  await emailQueue.add(
    "send-email",
    { type: "invoice", orgId, invoiceId, clientEmail },
    defaultJobOpts,
  );
}

export async function queuePaymentReceiptEmail(
  orgId: string,
  paymentId: string,
  clientEmail: string,
): Promise<void> {
  await emailQueue.add(
    "send-email",
    { type: "payment-receipt", orgId, paymentId, clientEmail },
    defaultJobOpts,
  );
}

export async function queueQuoteEmail(
  orgId: string,
  quoteId: string,
  clientEmail: string,
): Promise<void> {
  await emailQueue.add(
    "send-email",
    { type: "quote", orgId, quoteId, clientEmail },
    defaultJobOpts,
  );
}

export async function queuePaymentReminderEmail(
  orgId: string,
  invoiceId: string,
  clientEmail: string,
): Promise<void> {
  await emailQueue.add(
    "send-email",
    { type: "payment-reminder", orgId, invoiceId, clientEmail },
    defaultJobOpts,
  );
}

export async function queueGenericEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await emailQueue.add(
    "send-email",
    { type: "generic", to, subject, html },
    defaultJobOpts,
  );
}
