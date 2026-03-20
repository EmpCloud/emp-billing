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
exports.recurringWorker = void 0;
const bullmq_1 = require("bullmq");
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
const recurring_service_1 = require("../services/recurring/recurring.service");
const invoiceService = __importStar(require("../services/invoice/invoice.service"));
// ============================================================================
// RECURRING INVOICE WORKER
// Runs hourly — finds active recurring profiles due for execution and
// generates invoices (or expenses) from their template data.
// ============================================================================
const recurringWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.RECURRING, async (job) => {
    logger_1.logger.info("Processing recurring invoices", { jobId: job.id });
    const db = await (0, index_1.getDB)();
    const now = new Date();
    // 1. Query all active profiles whose next_execution_date has passed
    const profiles = await db.findMany("recurring_profiles", {
        where: { status: shared_1.RecurringStatus.ACTIVE },
    });
    // Filter to only profiles that are due (next_execution_date <= now)
    const dueProfiles = profiles.filter((p) => new Date(p.nextExecutionDate) <= now);
    logger_1.logger.info(`Found ${dueProfiles.length} recurring profiles due for execution`);
    let successCount = 0;
    let failCount = 0;
    for (const profile of dueProfiles) {
        try {
            // 2a. Parse templateData
            const templateData = typeof profile.templateData === "string"
                ? JSON.parse(profile.templateData)
                : profile.templateData;
            let generatedId = null;
            // 2b. Generate invoice or expense based on type
            if (profile.type === "invoice") {
                const invoice = await invoiceService.createInvoice(profile.orgId, profile.createdBy, templateData);
                generatedId = invoice.id;
            }
            // TODO: handle profile.type === "expense" when expense service supports it
            // 2c. Record successful execution
            await db.create("recurring_executions", {
                id: (0, uuid_1.v4)(),
                profileId: profile.id,
                orgId: profile.orgId,
                generatedId,
                executionDate: now,
                status: "success",
                error: null,
                createdAt: now,
            });
            // 2d. Increment occurrence_count
            const newCount = profile.occurrenceCount + 1;
            // 2e. Compute new next_execution_date
            const nextDate = (0, recurring_service_1.computeNextDate)(profile.nextExecutionDate, profile.frequency, profile.customDays);
            // 2f. Check if profile should be marked as completed
            const maxReached = profile.maxOccurrences != null && newCount >= profile.maxOccurrences;
            const endDatePassed = profile.endDate != null && (0, dayjs_1.default)(nextDate).isAfter((0, dayjs_1.default)(profile.endDate));
            const newStatus = maxReached || endDatePassed
                ? shared_1.RecurringStatus.COMPLETED
                : shared_1.RecurringStatus.ACTIVE;
            await db.update("recurring_profiles", profile.id, {
                occurrenceCount: newCount,
                nextExecutionDate: nextDate,
                status: newStatus,
                updatedAt: now,
            }, profile.orgId);
            // 2g. If autoSend, queue email
            if (profile.autoSend && generatedId) {
                // Look up client email
                const client = await db.findById("clients", profile.clientId, profile.orgId);
                if (client?.email) {
                    await queue_1.emailQueue.add("send-email", {
                        type: "invoice",
                        orgId: profile.orgId,
                        invoiceId: generatedId,
                        clientEmail: client.email,
                    }, {
                        attempts: 3,
                        backoff: { type: "exponential", delay: 5000 },
                    });
                }
            }
            successCount++;
            logger_1.logger.info("Recurring profile executed successfully", {
                profileId: profile.id,
                generatedId,
                newStatus,
            });
        }
        catch (err) {
            failCount++;
            // 3. On failure, record execution with error and continue
            try {
                await db.create("recurring_executions", {
                    id: (0, uuid_1.v4)(),
                    profileId: profile.id,
                    orgId: profile.orgId,
                    generatedId: null,
                    executionDate: now,
                    status: "failed",
                    error: err instanceof Error ? err.message : String(err),
                    createdAt: now,
                });
            }
            catch (recordErr) {
                logger_1.logger.error("Failed to record execution failure", {
                    profileId: profile.id,
                    recordErr,
                });
            }
            logger_1.logger.error("Recurring profile execution failed", {
                profileId: profile.id,
                err,
            });
        }
    }
    logger_1.logger.info("Recurring invoice processing complete", {
        total: dueProfiles.length,
        success: successCount,
        failed: failCount,
    });
}, { connection: queue_1.connection, concurrency: 1 });
exports.recurringWorker = recurringWorker;
// ── Worker events ────────────────────────────────────────────────────────────
recurringWorker.on("completed", (job) => {
    logger_1.logger.info("Recurring job completed", { jobId: job.id });
});
recurringWorker.on("failed", (job, err) => {
    logger_1.logger.error("Recurring job failed", { jobId: job?.id, error: err.message });
});
//# sourceMappingURL=recurring.worker.js.map