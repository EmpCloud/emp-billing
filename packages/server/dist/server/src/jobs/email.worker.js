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
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const emailService = __importStar(require("../services/notification/email.service"));
const emailWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.EMAIL, async (job) => {
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
                await emailService.sendTrialEndingEmail(data.orgId, data.clientEmail, data.clientName, data.planName, data.planPrice, data.planCurrency, data.trialEndDate, data.daysLeft);
                break;
            case "generic":
                await emailService.sendEmail(data.to, data.subject, data.html);
                break;
            default:
                logger_1.logger.warn("Unknown email job type", { jobId: job.id, data });
        }
    }
    catch (err) {
        logger_1.logger.error("Email worker job failed", { jobId: job.id, type: data.type, err });
        throw err; // re-throw so BullMQ marks the job as failed and retries if configured
    }
}, { connection: queue_1.connection, concurrency: 3 });
exports.emailWorker = emailWorker;
// ── Worker events ────────────────────────────────────────────────────────────
emailWorker.on("completed", (job) => {
    logger_1.logger.info("Email job completed", { jobId: job.id, type: job.data.type });
});
emailWorker.on("failed", (job, err) => {
    logger_1.logger.error("Email job failed", { jobId: job?.id, type: job?.data?.type, error: err.message });
});
//# sourceMappingURL=email.worker.js.map