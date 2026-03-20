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
exports.subscriptionWorker = void 0;
const bullmq_1 = require("bullmq");
const dayjs_1 = __importDefault(require("dayjs"));
const uuid_1 = require("uuid");
const queue_1 = require("./queue");
const logger_1 = require("../utils/logger");
const index_1 = require("../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
const subscriptionService = __importStar(require("../services/subscription/subscription.service"));
const online_payment_service_1 = require("../services/payment/online-payment.service");
// ============================================================================
// SUBSCRIPTION WORKER
// Runs daily at midnight — processes subscription billing events:
// 1. Converts expired trials to active (or creates first invoice)
// 2. Renews active subscriptions due for billing
// 3. Expires subscriptions with auto_renew=false past their period end
// ============================================================================
function computePeriodEnd(start, interval, customDays) {
    const d = (0, dayjs_1.default)(start);
    switch (interval) {
        case shared_1.BillingInterval.MONTHLY:
            return d.add(1, "month").toDate();
        case shared_1.BillingInterval.QUARTERLY:
            return d.add(3, "month").toDate();
        case shared_1.BillingInterval.SEMI_ANNUAL:
            return d.add(6, "month").toDate();
        case shared_1.BillingInterval.ANNUAL:
            return d.add(1, "year").toDate();
        case shared_1.BillingInterval.CUSTOM:
            return d.add(customDays || 30, "day").toDate();
        default:
            return d.add(1, "month").toDate();
    }
}
const subscriptionWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.SUBSCRIPTIONS, async (job) => {
    logger_1.logger.info("Processing subscription billing", { jobId: job.id });
    const db = await (0, index_1.getDB)();
    const today = (0, dayjs_1.default)().format("YYYY-MM-DD");
    const now = new Date();
    // Find all subscriptions where next_billing_date <= today AND status IN (active, trialing)
    const activeSubscriptions = await db.findMany("subscriptions", {
        where: { status: shared_1.SubscriptionStatus.ACTIVE },
    });
    const trialingSubscriptions = await db.findMany("subscriptions", {
        where: { status: shared_1.SubscriptionStatus.TRIALING },
    });
    const allSubscriptions = [...activeSubscriptions, ...trialingSubscriptions];
    const dueSubscriptions = allSubscriptions.filter((s) => (0, dayjs_1.default)(s.nextBillingDate).format("YYYY-MM-DD") <= today);
    logger_1.logger.info(`Found ${dueSubscriptions.length} subscriptions due for processing`);
    let successCount = 0;
    let failCount = 0;
    for (const sub of dueSubscriptions) {
        try {
            if (sub.status === shared_1.SubscriptionStatus.TRIALING) {
                // Trial has ended
                const trialEnd = sub.trialEnd ? new Date(sub.trialEnd) : now;
                if (trialEnd <= now) {
                    // Fetch plan to compute period
                    let plan;
                    try {
                        plan = await subscriptionService.getPlan(sub.orgId, sub.planId);
                    }
                    catch {
                        logger_1.logger.error("Plan not found for subscription", { subscriptionId: sub.id, planId: sub.planId });
                        failCount++;
                        continue;
                    }
                    // Convert to active
                    const periodStart = now;
                    const periodEnd = computePeriodEnd(periodStart, plan.billingInterval, plan.billingIntervalDays);
                    await db.update("subscriptions", sub.id, {
                        status: shared_1.SubscriptionStatus.ACTIVE,
                        currentPeriodStart: periodStart,
                        currentPeriodEnd: periodEnd,
                        nextBillingDate: (0, dayjs_1.default)(periodEnd).format("YYYY-MM-DD"),
                        updatedAt: now,
                    }, sub.orgId);
                    // Log trial_ended event
                    await db.create("subscription_events", {
                        id: (0, uuid_1.v4)(),
                        subscriptionId: sub.id,
                        orgId: sub.orgId,
                        eventType: shared_1.SubscriptionEventType.TRIAL_ENDED,
                        metadata: null,
                        createdAt: now,
                    });
                    // Log activated event
                    await db.create("subscription_events", {
                        id: (0, uuid_1.v4)(),
                        subscriptionId: sub.id,
                        orgId: sub.orgId,
                        eventType: shared_1.SubscriptionEventType.ACTIVATED,
                        metadata: null,
                        createdAt: now,
                    });
                    // Create first invoice
                    const trialRenewal = await subscriptionService.renewSubscription(sub.id);
                    // Attempt auto-charge with saved payment method
                    const trialChargeResult = await (0, online_payment_service_1.chargeSubscriptionRenewal)(trialRenewal.orgId, trialRenewal.invoiceId, trialRenewal.clientId);
                    if (!trialChargeResult.success) {
                        logger_1.logger.warn("Auto-charge failed after trial ended", {
                            subscriptionId: sub.id,
                            invoiceId: trialRenewal.invoiceId,
                            error: trialChargeResult.error,
                        });
                        // No need to mark as PAST_DUE here — subscription was just activated,
                        // the client still has the invoice due date window to pay manually.
                    }
                    successCount++;
                    logger_1.logger.info("Trial ended, subscription activated", { subscriptionId: sub.id });
                }
            }
            else if (sub.status === shared_1.SubscriptionStatus.ACTIVE) {
                if (!sub.autoRenew) {
                    // auto_renew is false — expire the subscription
                    await db.update("subscriptions", sub.id, {
                        status: shared_1.SubscriptionStatus.EXPIRED,
                        updatedAt: now,
                    }, sub.orgId);
                    await db.create("subscription_events", {
                        id: (0, uuid_1.v4)(),
                        subscriptionId: sub.id,
                        orgId: sub.orgId,
                        eventType: shared_1.SubscriptionEventType.EXPIRED,
                        metadata: null,
                        createdAt: now,
                    });
                    successCount++;
                    logger_1.logger.info("Subscription expired (auto_renew=false)", { subscriptionId: sub.id });
                }
                else {
                    // Renew: generate invoice and advance period
                    const renewal = await subscriptionService.renewSubscription(sub.id);
                    // Attempt auto-charge with saved payment method
                    const chargeResult = await (0, online_payment_service_1.chargeSubscriptionRenewal)(renewal.orgId, renewal.invoiceId, renewal.clientId);
                    if (!chargeResult.success) {
                        logger_1.logger.warn("Subscription renewal auto-charge failed", {
                            subscriptionId: sub.id,
                            invoiceId: renewal.invoiceId,
                            error: chargeResult.error,
                        });
                        // Mark subscription as PAST_DUE
                        await db.update("subscriptions", sub.id, {
                            status: shared_1.SubscriptionStatus.PAST_DUE,
                            updatedAt: now,
                        }, sub.orgId);
                        // Log payment_failed event
                        await db.create("subscription_events", {
                            id: (0, uuid_1.v4)(),
                            subscriptionId: sub.id,
                            orgId: sub.orgId,
                            eventType: shared_1.SubscriptionEventType.PAYMENT_FAILED,
                            metadata: JSON.stringify({
                                invoiceId: renewal.invoiceId,
                                error: chargeResult.error,
                            }),
                            createdAt: now,
                        });
                        // Create initial dunning attempt
                        await db.create("dunning_attempts", {
                            id: (0, uuid_1.v4)(),
                            orgId: sub.orgId,
                            invoiceId: renewal.invoiceId,
                            subscriptionId: sub.id,
                            attemptNumber: 1,
                            status: "failed",
                            paymentError: chargeResult.error || "Auto-charge failed on renewal",
                            nextRetryAt: (0, dayjs_1.default)(now).add(1, "day").toDate(),
                            createdAt: now,
                        });
                        logger_1.logger.info("Subscription marked as PAST_DUE, dunning attempt created", {
                            subscriptionId: sub.id,
                            invoiceId: renewal.invoiceId,
                        });
                    }
                    else {
                        logger_1.logger.info("Subscription renewed and auto-charged successfully", {
                            subscriptionId: sub.id,
                            paymentId: chargeResult.paymentId,
                        });
                    }
                    successCount++;
                    logger_1.logger.info("Subscription renewed", { subscriptionId: sub.id });
                }
            }
        }
        catch (err) {
            failCount++;
            logger_1.logger.error("Subscription processing failed", {
                subscriptionId: sub.id,
                err: err instanceof Error ? err.message : String(err),
            });
        }
    }
    logger_1.logger.info("Subscription billing processing complete", {
        total: dueSubscriptions.length,
        success: successCount,
        failed: failCount,
    });
    // ── Trial ending reminders ────────────────────────────────────────────
    // Find trialing subscriptions ending within 3 days
    const threeDaysFromNow = (0, dayjs_1.default)().add(3, "day").format("YYYY-MM-DD");
    const trialEndingSoon = trialingSubscriptions.filter((s) => {
        if (!s.trialEnd)
            return false;
        const trialEndDate = (0, dayjs_1.default)(s.trialEnd).format("YYYY-MM-DD");
        return trialEndDate <= threeDaysFromNow && trialEndDate > today;
    });
    let reminderCount = 0;
    for (const sub of trialEndingSoon) {
        try {
            // Get client email
            const client = await db.findById("clients", sub.clientId, sub.orgId);
            if (!client?.email)
                continue;
            // Get plan details
            let plan;
            try {
                plan = await subscriptionService.getPlan(sub.orgId, sub.planId);
            }
            catch {
                continue;
            }
            const daysLeft = (0, dayjs_1.default)(sub.trialEnd).diff((0, dayjs_1.default)(), "day");
            // Check if we already sent a reminder for this subscription today
            // Use a simple check — we'll rely on the email queue dedup
            // Queue the trial ending email
            await queue_1.emailQueue.add("send-email", {
                type: "trial-ending",
                orgId: sub.orgId,
                subscriptionId: sub.id,
                clientEmail: client.email,
                clientName: client.name,
                planName: plan.name,
                planPrice: plan.price,
                planCurrency: plan.currency,
                trialEndDate: (0, dayjs_1.default)(sub.trialEnd).format("YYYY-MM-DD"),
                daysLeft,
            }, {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                // Use a job ID to prevent duplicate emails for same sub on same day
                jobId: `trial-ending-${sub.id}-${today}`,
            });
            // Emit trial_ending event
            const { emit } = await Promise.resolve().then(() => __importStar(require("../events/index")));
            emit("subscription.trial_ending", {
                orgId: sub.orgId,
                subscriptionId: sub.id,
                subscription: { id: sub.id, planId: sub.planId, trialEnd: sub.trialEnd },
                planId: sub.planId,
                clientId: sub.clientId,
            });
            reminderCount++;
            logger_1.logger.info("Trial ending reminder queued", {
                subscriptionId: sub.id,
                clientEmail: client.email,
                daysLeft,
            });
        }
        catch (err) {
            logger_1.logger.error("Failed to send trial ending reminder", {
                subscriptionId: sub.id,
                err: err instanceof Error ? err.message : String(err),
            });
        }
    }
    if (reminderCount > 0) {
        logger_1.logger.info(`Sent ${reminderCount} trial ending reminders`);
    }
}, { connection: queue_1.connection, concurrency: 1 });
exports.subscriptionWorker = subscriptionWorker;
// ── Worker events ────────────────────────────────────────────────────────────
subscriptionWorker.on("completed", (job) => {
    logger_1.logger.info("Subscription billing job completed", { jobId: job.id });
});
subscriptionWorker.on("failed", (job, err) => {
    logger_1.logger.error("Subscription billing job failed", { jobId: job?.id, error: err.message });
});
//# sourceMappingURL=subscription.worker.js.map