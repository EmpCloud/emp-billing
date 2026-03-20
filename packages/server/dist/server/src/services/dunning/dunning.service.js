"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDunningConfig = getDunningConfig;
exports.updateDunningConfig = updateDunningConfig;
exports.createDunningAttempt = createDunningAttempt;
exports.listDunningAttempts = listDunningAttempts;
exports.processDunningAttempt = processDunningAttempt;
exports.getDunningSummary = getDunningSummary;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const queue_1 = require("../../jobs/queue");
const logger_1 = require("../../utils/logger");
const index_2 = require("../payment/gateways/index");
const index_3 = require("../../events/index");
// ============================================================================
// DUNNING SERVICE
// Manages failed-payment retry logic (dunning).
// ============================================================================
// Default config used when org has not configured dunning
const DEFAULT_CONFIG = {
    maxRetries: 4,
    retrySchedule: [1, 3, 5, 7],
    gracePeriodDays: 3,
    cancelAfterAllRetries: true,
    sendReminderEmails: true,
};
// ── Get Config ──────────────────────────────────────────────────────────────
async function getDunningConfig(orgId) {
    const db = await (0, index_1.getDB)();
    const rows = await db.findMany("dunning_configs", {
        where: { org_id: orgId },
    });
    if (rows.length > 0) {
        const row = rows[0];
        // Parse retry_schedule if stored as string
        if (typeof row.retrySchedule === "string") {
            row.retrySchedule = JSON.parse(row.retrySchedule);
        }
        return row;
    }
    // Return defaults with synthetic id
    return {
        id: "",
        orgId,
        ...DEFAULT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
// ── Update Config ───────────────────────────────────────────────────────────
async function updateDunningConfig(orgId, data) {
    const db = await (0, index_1.getDB)();
    const now = new Date();
    // Check existing
    const existing = await db.findMany("dunning_configs", {
        where: { org_id: orgId },
    });
    if (existing.length > 0) {
        // Update
        await db.update("dunning_configs", existing[0].id, {
            maxRetries: data.maxRetries,
            retrySchedule: JSON.stringify(data.retrySchedule),
            gracePeriodDays: data.gracePeriodDays,
            cancelAfterAllRetries: data.cancelAfterAllRetries,
            sendReminderEmails: data.sendReminderEmails,
            updatedAt: now,
        }, orgId);
        return getDunningConfig(orgId);
    }
    // Create
    const id = (0, uuid_1.v4)();
    await db.create("dunning_configs", {
        id,
        orgId,
        maxRetries: data.maxRetries ?? DEFAULT_CONFIG.maxRetries,
        retrySchedule: JSON.stringify(data.retrySchedule ?? DEFAULT_CONFIG.retrySchedule),
        gracePeriodDays: data.gracePeriodDays ?? DEFAULT_CONFIG.gracePeriodDays,
        cancelAfterAllRetries: data.cancelAfterAllRetries ?? DEFAULT_CONFIG.cancelAfterAllRetries,
        sendReminderEmails: data.sendReminderEmails ?? DEFAULT_CONFIG.sendReminderEmails,
        createdAt: now,
        updatedAt: now,
    });
    return getDunningConfig(orgId);
}
// ── Create Dunning Attempt ──────────────────────────────────────────────────
async function createDunningAttempt(orgId, invoiceId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    const config = await getDunningConfig(orgId);
    const id = (0, uuid_1.v4)();
    const now = new Date();
    // First retry is scheduled after grace period + first retry schedule day
    const firstRetryDay = config.retrySchedule[0] ?? 1;
    const nextRetryAt = (0, dayjs_1.default)(now).add(firstRetryDay, "day").toDate();
    const attempt = await db.create("dunning_attempts", {
        id,
        orgId,
        invoiceId,
        subscriptionId: subscriptionId ?? null,
        attemptNumber: 1,
        status: shared_1.DunningAttemptStatus.PENDING,
        paymentError: null,
        nextRetryAt,
        createdAt: now,
    });
    return attempt;
}
async function listDunningAttempts(orgId, params) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (params.status)
        where.status = params.status;
    if (params.invoiceId)
        where.invoice_id = params.invoiceId;
    const result = await db.findPaginated("dunning_attempts", {
        where,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return result;
}
// ── Process Dunning Attempt ─────────────────────────────────────────────────
async function processDunningAttempt(attemptId) {
    const db = await (0, index_1.getDB)();
    const attempt = await db.findById("dunning_attempts", attemptId);
    if (!attempt)
        throw (0, AppError_1.NotFoundError)("Dunning attempt");
    const config = await getDunningConfig(attempt.orgId);
    const now = new Date();
    // Look up the invoice to check current status
    const invoice = await db.findById("invoices", attempt.invoiceId, attempt.orgId);
    if (!invoice) {
        // Invoice deleted — skip
        await db.update("dunning_attempts", attemptId, {
            status: shared_1.DunningAttemptStatus.SKIPPED,
            paymentError: "Invoice not found",
        }, attempt.orgId);
        return;
    }
    // If invoice is already paid, mark success
    if (invoice.status === shared_1.InvoiceStatus.PAID) {
        await db.update("dunning_attempts", attemptId, {
            status: shared_1.DunningAttemptStatus.SUCCESS,
            nextRetryAt: null,
        }, attempt.orgId);
        return;
    }
    // Look up the client's saved payment method
    const client = await db.findById("clients", invoice.clientId, attempt.orgId);
    let chargeSuccess = false;
    let chargeError = "No saved payment method";
    let gatewayTransactionId;
    if (client?.paymentGateway && client?.paymentMethodId) {
        try {
            const gateway = (0, index_2.getGateway)(client.paymentGateway);
            const chargeResult = await gateway.chargeCustomer({
                paymentMethodId: client.paymentMethodId,
                amount: invoice.amountDue,
                currency: invoice.currency || "INR",
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                description: `Dunning retry #${attempt.attemptNumber} for invoice ${invoice.invoiceNumber}`,
                metadata: { orgId: attempt.orgId, invoiceId: invoice.id },
            });
            chargeSuccess = chargeResult.success;
            gatewayTransactionId = chargeResult.gatewayTransactionId;
            if (!chargeSuccess) {
                chargeError = chargeResult.error || "Payment declined";
            }
        }
        catch (err) {
            chargeError = err instanceof Error ? err.message : "Payment processing error";
        }
    }
    else {
        chargeError = "No saved payment method on file";
    }
    if (chargeSuccess) {
        // Mark attempt as success
        await db.update("dunning_attempts", attemptId, {
            status: shared_1.DunningAttemptStatus.SUCCESS,
            nextRetryAt: null,
        }, attempt.orgId);
        // Determine the payment method enum from the gateway name
        const paymentMethod = client?.paymentGateway === "stripe"
            ? shared_1.PaymentMethod.GATEWAY_STRIPE
            : client?.paymentGateway === "razorpay"
                ? shared_1.PaymentMethod.GATEWAY_RAZORPAY
                : shared_1.PaymentMethod.OTHER;
        // Record the payment (same pattern as recordGatewayPayment in online-payment.service)
        const paymentId = (0, uuid_1.v4)();
        const paymentCount = await db.count("payments", { org_id: attempt.orgId });
        const year = now.getFullYear();
        const paymentNumber = `PAY-${year}-${String(paymentCount + 1).padStart(4, "0")}`;
        await db.create("payments", {
            id: paymentId,
            orgId: attempt.orgId,
            clientId: invoice.clientId,
            paymentNumber,
            date: now,
            amount: invoice.amountDue,
            method: paymentMethod,
            reference: null,
            gatewayTransactionId: gatewayTransactionId || null,
            notes: `Dunning retry #${attempt.attemptNumber} via ${client?.paymentGateway || "gateway"}`,
            isRefund: false,
            refundedAmount: 0,
            createdBy: "system",
            createdAt: now,
            updatedAt: now,
        });
        // Create payment allocation linking payment to invoice
        await db.create("payment_allocations", {
            id: (0, uuid_1.v4)(),
            paymentId,
            invoiceId: invoice.id,
            orgId: attempt.orgId,
            amount: invoice.amountDue,
            createdAt: now,
            updatedAt: now,
        });
        // Update invoice balances
        const newAmountPaid = invoice.amountPaid + invoice.amountDue;
        const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
        const newStatus = newAmountDue === 0 ? shared_1.InvoiceStatus.PAID : shared_1.InvoiceStatus.PARTIALLY_PAID;
        await db.update("invoices", attempt.invoiceId, {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            paidAt: newStatus === shared_1.InvoiceStatus.PAID ? now : null,
            updatedAt: now,
        }, attempt.orgId);
        // Update client balances
        await db.update("clients", invoice.clientId, {
            totalPaid: await db.increment("clients", invoice.clientId, "total_paid", invoice.amountDue),
            outstandingBalance: await db.increment("clients", invoice.clientId, "outstanding_balance", -invoice.amountDue),
            updatedAt: now,
        }, attempt.orgId);
        logger_1.logger.info("Dunning attempt succeeded", {
            attemptId,
            invoiceId: attempt.invoiceId,
            paymentId,
            paymentNumber,
            amount: invoice.amountDue,
        });
    }
    else {
        // Check if more retries available
        const hasMoreRetries = attempt.attemptNumber < config.maxRetries;
        if (hasMoreRetries) {
            // Calculate next retry date based on retry_schedule
            const nextRetryIndex = attempt.attemptNumber; // 0-indexed schedule, current attempt is 1-indexed
            const retryDays = config.retrySchedule[nextRetryIndex] ?? config.retrySchedule[config.retrySchedule.length - 1] ?? 7;
            const nextRetryAt = (0, dayjs_1.default)(now).add(retryDays, "day").toDate();
            // Update current attempt as failed
            await db.update("dunning_attempts", attemptId, {
                status: shared_1.DunningAttemptStatus.FAILED,
                paymentError: chargeError,
                nextRetryAt: null,
            }, attempt.orgId);
            // Create next attempt
            const nextAttemptId = (0, uuid_1.v4)();
            await db.create("dunning_attempts", {
                id: nextAttemptId,
                orgId: attempt.orgId,
                invoiceId: attempt.invoiceId,
                subscriptionId: attempt.subscriptionId ?? null,
                attemptNumber: attempt.attemptNumber + 1,
                status: shared_1.DunningAttemptStatus.PENDING,
                paymentError: null,
                nextRetryAt,
                createdAt: now,
            });
            (0, index_3.emit)("payment.failed", {
                orgId: attempt.orgId,
                invoiceId: attempt.invoiceId,
                subscriptionId: attempt.subscriptionId ?? undefined,
                error: chargeError,
                attemptNumber: attempt.attemptNumber,
            });
            logger_1.logger.info("Dunning attempt failed, next retry scheduled", {
                attemptId,
                nextAttemptId,
                nextRetryAt,
            });
        }
        else {
            // No retries left
            await db.update("dunning_attempts", attemptId, {
                status: shared_1.DunningAttemptStatus.FAILED,
                paymentError: chargeError,
                nextRetryAt: null,
            }, attempt.orgId);
            // Cancel subscription if configured
            if (config.cancelAfterAllRetries && attempt.subscriptionId) {
                await db.update("subscriptions", attempt.subscriptionId, {
                    status: shared_1.SubscriptionStatus.CANCELLED,
                    cancelledAt: now,
                    cancelReason: "Payment failed after all dunning retries",
                    updatedAt: now,
                }, attempt.orgId);
                // Record a payment_failed subscription event
                await db.create("subscription_events", {
                    id: (0, uuid_1.v4)(),
                    subscriptionId: attempt.subscriptionId,
                    orgId: attempt.orgId,
                    eventType: "payment_failed",
                    metadata: JSON.stringify({
                        invoiceId: attempt.invoiceId,
                        attemptNumber: attempt.attemptNumber,
                    }),
                    createdAt: now,
                });
                logger_1.logger.info("Subscription cancelled after all dunning retries", {
                    subscriptionId: attempt.subscriptionId,
                    invoiceId: attempt.invoiceId,
                });
            }
            // Send final notice email
            if (config.sendReminderEmails) {
                const clientForEmail = await db.findById("clients", invoice.clientId, attempt.orgId);
                if (clientForEmail?.email) {
                    await queue_1.emailQueue.add("send-email", {
                        type: "dunning-final-notice",
                        orgId: attempt.orgId,
                        invoiceId: attempt.invoiceId,
                        clientEmail: clientForEmail.email,
                    }, {
                        attempts: 3,
                        backoff: { type: "exponential", delay: 5000 },
                    });
                }
            }
            (0, index_3.emit)("payment.failed", {
                orgId: attempt.orgId,
                invoiceId: attempt.invoiceId,
                subscriptionId: attempt.subscriptionId ?? undefined,
                error: chargeError,
                attemptNumber: attempt.attemptNumber,
            });
            logger_1.logger.info("Dunning exhausted all retries", {
                attemptId,
                invoiceId: attempt.invoiceId,
            });
        }
        // Send reminder email for each failure
        if (config.sendReminderEmails) {
            const reminderClient = await db.findById("clients", invoice.clientId, attempt.orgId);
            if (reminderClient?.email) {
                await queue_1.emailQueue.add("send-email", {
                    type: "dunning-retry-failed",
                    orgId: attempt.orgId,
                    invoiceId: attempt.invoiceId,
                    clientEmail: reminderClient.email,
                    attemptNumber: attempt.attemptNumber,
                }, {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 5000 },
                });
            }
        }
    }
}
// ── Get Dunning Summary ─────────────────────────────────────────────────────
async function getDunningSummary(orgId) {
    const db = await (0, index_1.getDB)();
    // Total pending retries
    const [pendingRow] = await db.raw(`SELECT COUNT(*) as count FROM dunning_attempts WHERE org_id = ? AND status = ?`, [orgId, shared_1.DunningAttemptStatus.PENDING]);
    const totalPending = Number(pendingRow?.count ?? 0);
    // Failed this month
    const monthStart = (0, dayjs_1.default)().startOf("month").format("YYYY-MM-DD HH:mm:ss");
    const [failedRow] = await db.raw(`SELECT COUNT(*) as count FROM dunning_attempts WHERE org_id = ? AND status = ? AND created_at >= ?`, [orgId, shared_1.DunningAttemptStatus.FAILED, monthStart]);
    const failedThisMonth = Number(failedRow?.count ?? 0);
    // Recovered amount (invoices with successful dunning attempts)
    const [recoveredRow] = await db.raw(`SELECT COALESCE(SUM(i.total), 0) as total
     FROM dunning_attempts da
     JOIN invoices i ON i.id = da.invoice_id
     WHERE da.org_id = ? AND da.status = ?`, [orgId, shared_1.DunningAttemptStatus.SUCCESS]);
    const recoveredAmount = Number(recoveredRow?.total ?? 0);
    return {
        totalPending,
        failedThisMonth,
        recoveredAmount,
    };
}
//# sourceMappingURL=dunning.service.js.map