import { Worker } from "bullmq";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import { generateInvoicePdf, type InvoicePdfData } from "../utils/pdf";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// PDF WORKER
// Processes PDF generation jobs with concurrency of 2.
// ============================================================================

const PDF_DIR = path.join(process.cwd(), "uploads", "pdfs");

async function ensureDir(): Promise<void> {
  await fs.mkdir(PDF_DIR, { recursive: true });
}

interface InvoicePdfJob {
  type: "invoice-pdf";
  data: InvoicePdfData;
  filename?: string;
}

interface QuotePdfJob {
  type: "quote-pdf";
  data: InvoicePdfData;
  filename?: string;
}

interface CreditNotePdfJob {
  type: "credit-note-pdf";
  data: InvoicePdfData;
  filename?: string;
}

interface ReceiptPdfJob {
  type: "receipt-pdf";
  data: InvoicePdfData;
  filename?: string;
}

type PdfJobData = InvoicePdfJob | QuotePdfJob | CreditNotePdfJob | ReceiptPdfJob;

const pdfWorker = new Worker<PdfJobData, string>(
  QUEUE_NAMES.PDF,
  async (job) => {
    const { data } = job;

    try {
      await ensureDir();

      let buffer: Buffer;

      switch (data.type) {
        case "invoice-pdf":
          buffer = await generateInvoicePdf(data.data);
          break;

        case "quote-pdf":
          // Uses the same PDF layout as invoices for now
          buffer = await generateInvoicePdf(data.data);
          break;

        case "credit-note-pdf":
          // Uses the same PDF layout as invoices for now
          buffer = await generateInvoicePdf(data.data);
          break;

        case "receipt-pdf":
          // Uses the same PDF layout as invoices for now
          buffer = await generateInvoicePdf(data.data);
          break;

        default:
          logger.warn("Unknown PDF job type", { jobId: job.id, data });
          throw new Error(`Unknown PDF job type: ${(data as Record<string, unknown>).type}`);
      }

      const filePath = path.join(PDF_DIR, data.filename || `${data.type}-${job.id}.pdf`);

      // Path traversal protection: ensure the resolved path stays within PDF_DIR
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(PDF_DIR);
      if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
        throw new Error(`Path traversal detected: ${data.filename}`);
      }

      await fs.writeFile(filePath, buffer);

      return filePath;
    } catch (err) {
      logger.error("PDF worker job failed", { jobId: job.id, type: data.type, err });
      throw err; // re-throw so BullMQ marks the job as failed and retries if configured
    }
  },
  { connection, concurrency: 2 },
);

// ── Worker events ────────────────────────────────────────────────────────────

pdfWorker.on("completed", (job) => {
  logger.info("PDF job completed", { jobId: job.id, type: job.data.type, filePath: job.returnvalue });
});

pdfWorker.on("failed", (job, err) => {
  logger.error("PDF job failed", { jobId: job?.id, type: job?.data?.type, error: err.message });
});

export { pdfWorker };
