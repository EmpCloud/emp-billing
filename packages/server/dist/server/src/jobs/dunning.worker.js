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
exports.dunningWorker = void 0;
const bullmq_1 = require("bullmq");
const dayjs_1 = __importDefault(require("dayjs"));
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
const dunningService = __importStar(require("../services/dunning/dunning.service"));
const dunningWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.DUNNING, async (job) => {
    logger_1.logger.info("Processing dunning attempts", { jobId: job.id });
    const db = await (0, index_1.getDB)();
    const now = (0, dayjs_1.default)();
    let processedCount = 0;
    let createdCount = 0;
    // 1. Find all dunning_attempts where status=pending AND next_retry_at <= now
    const pendingAttempts = await db.raw(`SELECT * FROM dunning_attempts WHERE status = ? AND next_retry_at <= ?`, [shared_1.DunningAttemptStatus.PENDING, now.format("YYYY-MM-DD HH:mm:ss")]);
    for (const attempt of pendingAttempts) {
        try {
            await dunningService.processDunningAttempt(attempt.id);
            processedCount++;
        }
        catch (err) {
            logger_1.logger.error("Failed to process dunning attempt", {
                attemptId: attempt.id,
                err,
            });
        }
    }
    // 2. Find overdue invoices without any dunning attempts and create initial attempts
    const overdueInvoices = await db.raw(`SELECT i.id, i.org_id, i.client_id
       FROM invoices i
       WHERE i.status = ?
         AND i.amount_due > 0
         AND NOT EXISTS (
           SELECT 1 FROM dunning_attempts da WHERE da.invoice_id = i.id
         )`, [shared_1.InvoiceStatus.OVERDUE]);
    for (const invoice of overdueInvoices) {
        try {
            // Try to find a subscription linked to this invoice
            const subscriptions = await db.raw(`SELECT s.id FROM subscriptions s
           JOIN invoices i ON i.recurring_profile_id IS NOT NULL
           WHERE s.org_id = ? AND s.client_id = ?
           ORDER BY s.created_at DESC LIMIT 1`, [invoice.org_id, invoice.client_id]);
            const subscriptionId = subscriptions[0]?.id ?? undefined;
            await dunningService.createDunningAttempt(invoice.org_id, invoice.id, subscriptionId);
            createdCount++;
        }
        catch (err) {
            logger_1.logger.error("Failed to create dunning attempt for overdue invoice", {
                invoiceId: invoice.id,
                err,
            });
        }
    }
    logger_1.logger.info(`Dunning worker: processed ${processedCount} retries, created ${createdCount} new attempts`);
}, { connection: queue_1.connection, concurrency: 1 });
exports.dunningWorker = dunningWorker;
// ── Worker events ────────────────────────────────────────────────────────────
dunningWorker.on("completed", (job) => {
    logger_1.logger.info("Dunning job completed", { jobId: job.id });
});
dunningWorker.on("failed", (job, err) => {
    logger_1.logger.error("Dunning job failed", { jobId: job?.id, error: err.message });
});
//# sourceMappingURL=dunning.worker.js.map