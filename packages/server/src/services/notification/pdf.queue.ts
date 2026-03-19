import { pdfQueue } from "../../jobs/queue";

// ============================================================================
// PDF QUEUE HELPERS
// Convenience functions to enqueue PDF generation jobs.
// All jobs use 2 attempts with exponential backoff.
// ============================================================================

const defaultJobOpts = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 5000 },
};

export async function queueInvoicePdf(
  data: Record<string, unknown>,
  filename: string,
): Promise<void> {
  await pdfQueue.add(
    "generate-pdf",
    { type: "invoice-pdf", data, filename },
    defaultJobOpts,
  );
}

export async function queueQuotePdf(
  data: Record<string, unknown>,
  filename: string,
): Promise<void> {
  await pdfQueue.add(
    "generate-pdf",
    { type: "quote-pdf", data, filename },
    defaultJobOpts,
  );
}

export async function queueCreditNotePdf(
  data: Record<string, unknown>,
  filename: string,
): Promise<void> {
  await pdfQueue.add(
    "generate-pdf",
    { type: "credit-note-pdf", data, filename },
    defaultJobOpts,
  );
}

export async function queueReceiptPdf(
  data: Record<string, unknown>,
  filename: string,
): Promise<void> {
  await pdfQueue.add(
    "generate-pdf",
    { type: "receipt-pdf", data, filename },
    defaultJobOpts,
  );
}
