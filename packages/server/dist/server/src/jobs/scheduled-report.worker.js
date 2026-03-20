"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledReportWorker = void 0;
const bullmq_1 = require("bullmq");
const dayjs_1 = __importDefault(require("dayjs"));
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../config/index");
const scheduledReportService = __importStar(require("../services/report/scheduled-report.service"));
const reportService = __importStar(require("../services/report/report.service"));
const emailService = __importStar(require("../services/notification/email.service"));
// ============================================================================
// SCHEDULED REPORT WORKER
// Runs hourly — finds active scheduled reports that are due and sends them
// via email with a CSV attachment.
// ============================================================================
// ── CSV helpers ─────────────────────────────────────────────────────────────
function arrayToCsv(rows) {
    if (rows.length === 0)
        return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
        const values = headers.map((h) => {
            const val = row[h];
            if (val == null)
                return "";
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
async function getReportData(reportType, orgId) {
    // Use last 30 days for daily, last 7 days for weekly, last month for monthly
    // as a reasonable default range for the report data
    const to = new Date();
    const from = (0, dayjs_1.default)(to).subtract(1, "year").toDate();
    switch (reportType) {
        case "revenue": {
            const result = await reportService.getRevenueReport(orgId, from, to);
            return {
                data: result.data,
                label: "Revenue Report",
            };
        }
        case "receivables": {
            const result = await reportService.getReceivablesReport(orgId);
            return {
                data: result.data,
                label: "Receivables Report",
            };
        }
        case "expenses": {
            const result = await reportService.getExpenseReport(orgId, from, to);
            return {
                data: result.data,
                label: "Expense Report",
            };
        }
        case "tax": {
            const result = await reportService.getTaxReport(orgId, from, to);
            return {
                data: result.data,
                label: "Tax Report",
            };
        }
        case "profit_loss": {
            const result = await reportService.getProfitLossReport(orgId, from, to);
            return {
                data: result.data,
                label: "Profit & Loss Report",
            };
        }
        default:
            return { data: [], label: "Unknown Report" };
    }
}
// ── Send report email with CSV attachment ───────────────────────────────────
async function sendReportEmail(report, csvContent, reportLabel) {
    const transport = emailService.createTransport();
    const dateStr = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const filename = `${reportLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.csv`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Scheduled Report: ${reportLabel}</h2>
      <p style="color: #555;">
        Here is your scheduled <strong>${report.frequency}</strong> ${reportLabel.toLowerCase()},
        generated on ${(0, dayjs_1.default)().format("MMMM D, YYYY [at] h:mm A")}.
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
        from: `"${index_1.config.smtp.fromName}" <${index_1.config.smtp.from}>`,
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
const scheduledReportWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.SCHEDULED_REPORTS, async (job) => {
    logger_1.logger.info("Processing scheduled reports", { jobId: job.id });
    const dueReports = await scheduledReportService.getDueReports();
    logger_1.logger.info(`Found ${dueReports.length} scheduled reports due for sending`);
    let successCount = 0;
    let failCount = 0;
    for (const report of dueReports) {
        try {
            // 1. Fetch report data
            const { data, label } = await getReportData(report.reportType, report.orgId);
            // 2. Convert to CSV
            const csvContent = data.length > 0
                ? arrayToCsv(data)
                : "No data available for this period.";
            // 3. Send email with CSV attachment
            await sendReportEmail(report, csvContent, label);
            // 4. Update last_sent_at and compute next next_send_at
            await scheduledReportService.markReportSent(report);
            successCount++;
            logger_1.logger.info("Scheduled report sent successfully", {
                reportId: report.id,
                reportType: report.reportType,
                recipientEmail: report.recipientEmail,
            });
        }
        catch (err) {
            failCount++;
            logger_1.logger.error("Scheduled report send failed", {
                reportId: report.id,
                reportType: report.reportType,
                err,
            });
        }
    }
    logger_1.logger.info("Scheduled report processing complete", {
        total: dueReports.length,
        success: successCount,
        failed: failCount,
    });
}, { connection: queue_1.connection, concurrency: 1 });
exports.scheduledReportWorker = scheduledReportWorker;
// ── Worker events ───────────────────────────────────────────────────────────
scheduledReportWorker.on("completed", (job) => {
    logger_1.logger.info("Scheduled report job completed", { jobId: job.id });
});
scheduledReportWorker.on("failed", (job, err) => {
    logger_1.logger.error("Scheduled report job failed", {
        jobId: job?.id,
        error: err.message,
    });
});
//# sourceMappingURL=scheduled-report.worker.js.map