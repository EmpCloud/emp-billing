import { Worker } from "bullmq";
import dayjs from "dayjs";
import { connection, QUEUE_NAMES } from "./queue";
import { logger } from "../utils/logger";
import { config } from "../config/index";
import * as scheduledReportService from "../services/report/scheduled-report.service";
import * as reportService from "../services/report/report.service";
import * as emailService from "../services/notification/email.service";
import type { ScheduledReport } from "@emp-billing/shared";

// ============================================================================
// SCHEDULED REPORT WORKER
// Runs hourly — finds active scheduled reports that are due and sends them
// via email with a CSV attachment.
// ============================================================================

// ── CSV helpers ─────────────────────────────────────────────────────────────

function arrayToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val == null) return "";
      const str = String(val);
      // Escape commas and quotes in CSV
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

// ── Report data fetchers ────────────────────────────────────────────────────

async function getReportData(
  reportType: string,
  orgId: string,
): Promise<{ data: Record<string, unknown>[]; label: string }> {
  // Use last 30 days for daily, last 7 days for weekly, last month for monthly
  // as a reasonable default range for the report data
  const to = new Date();
  const from = dayjs(to).subtract(1, "year").toDate();

  switch (reportType) {
    case "revenue": {
      const result = await reportService.getRevenueReport(orgId, from, to);
      return {
        data: result.data as unknown as Record<string, unknown>[],
        label: "Revenue Report",
      };
    }
    case "receivables": {
      const result = await reportService.getReceivablesReport(orgId);
      return {
        data: result.data as unknown as Record<string, unknown>[],
        label: "Receivables Report",
      };
    }
    case "expenses": {
      const result = await reportService.getExpenseReport(orgId, from, to);
      return {
        data: result.data as unknown as Record<string, unknown>[],
        label: "Expense Report",
      };
    }
    case "tax": {
      const result = await reportService.getTaxReport(orgId, from, to);
      return {
        data: result.data as unknown as Record<string, unknown>[],
        label: "Tax Report",
      };
    }
    case "profit_loss": {
      const result = await reportService.getProfitLossReport(orgId, from, to);
      return {
        data: result.data as unknown as Record<string, unknown>[],
        label: "Profit & Loss Report",
      };
    }
    default:
      return { data: [], label: "Unknown Report" };
  }
}

// ── Send report email with CSV attachment ───────────────────────────────────

async function sendReportEmail(
  report: ScheduledReport,
  csvContent: string,
  reportLabel: string,
): Promise<void> {
  const transport = emailService.createTransport();
  const dateStr = dayjs().format("YYYY-MM-DD");
  const filename = `${reportLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Scheduled Report: ${reportLabel}</h2>
      <p style="color: #555;">
        Here is your scheduled <strong>${report.frequency}</strong> ${reportLabel.toLowerCase()},
        generated on ${dayjs().format("MMMM D, YYYY [at] h:mm A")}.
      </p>
      <p style="color: #555;">
        The report data is attached as a CSV file for your review.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">
        This is an automated report from emp-billing. You can manage your scheduled reports
        in Settings &gt; Scheduled Reports.
      </p>
    </div>
  `;

  await transport.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to: report.recipientEmail,
    subject: `${reportLabel} - ${dateStr}`,
    html,
    attachments: [
      {
        filename,
        content: Buffer.from(csvContent, "utf-8"),
        contentType: "text/csv",
      },
    ],
  });
}

// ── Worker ──────────────────────────────────────────────────────────────────

const scheduledReportWorker = new Worker(
  QUEUE_NAMES.SCHEDULED_REPORTS,
  async (job) => {
    logger.info("Processing scheduled reports", { jobId: job.id });

    const dueReports = await scheduledReportService.getDueReports();

    logger.info(`Found ${dueReports.length} scheduled reports due for sending`);

    let successCount = 0;
    let failCount = 0;

    for (const report of dueReports) {
      try {
        // 1. Fetch report data
        const { data, label } = await getReportData(
          report.reportType,
          report.orgId,
        );

        // 2. Convert to CSV
        const csvContent = data.length > 0
          ? arrayToCsv(data)
          : "No data available for this period.";

        // 3. Send email with CSV attachment
        await sendReportEmail(report, csvContent, label);

        // 4. Update last_sent_at and compute next next_send_at
        await scheduledReportService.markReportSent(report);

        successCount++;
        logger.info("Scheduled report sent successfully", {
          reportId: report.id,
          reportType: report.reportType,
          recipientEmail: report.recipientEmail,
        });
      } catch (err) {
        failCount++;
        logger.error("Scheduled report send failed", {
          reportId: report.id,
          reportType: report.reportType,
          err,
        });
      }
    }

    logger.info("Scheduled report processing complete", {
      total: dueReports.length,
      success: successCount,
      failed: failCount,
    });
  },
  { connection, concurrency: 1 },
);

// ── Worker events ───────────────────────────────────────────────────────────

scheduledReportWorker.on("completed", (job) => {
  logger.info("Scheduled report job completed", { jobId: job.id });
});

scheduledReportWorker.on("failed", (job, err) => {
  logger.error("Scheduled report job failed", {
    jobId: job?.id,
    error: err.message,
  });
});

export { scheduledReportWorker };
