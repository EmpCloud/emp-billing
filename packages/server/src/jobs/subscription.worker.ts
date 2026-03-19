import { Worker } from "bullmq";
import dayjs from "dayjs";
import { v4 as uuid } from "uuid";
import { connection, QUEUE_NAMES, emailQueue } from "./queue";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { SubscriptionStatus, SubscriptionEventType, BillingInterval } from "@emp-billing/shared";
import * as subscriptionService from "../services/subscription/subscription.service";
import { chargeSubscriptionRenewal } from "../services/payment/online-payment.service";
import type { Subscription, Plan, DunningAttemptStatus } from "@emp-billing/shared";

// ============================================================================
// SUBSCRIPTION WORKER
// Runs daily at midnight — processes subscription billing events:
// 1. Converts expired trials to active (or creates first invoice)
// 2. Renews active subscriptions due for billing
// 3. Expires subscriptions with auto_renew=false past their period end
// ============================================================================

function computePeriodEnd(
  start: Date,
  interval: BillingInterval,
  customDays?: number
): Date {
  const d = dayjs(start);
  switch (interval) {
    case BillingInterval.MONTHLY:
      return d.add(1, "month").toDate();
    case BillingInterval.QUARTERLY:
      return d.add(3, "month").toDate();
    case BillingInterval.SEMI_ANNUAL:
      return d.add(6, "month").toDate();
    case BillingInterval.ANNUAL:
      return d.add(1, "year").toDate();
    case BillingInterval.CUSTOM:
      return d.add(customDays || 30, "day").toDate();
    default:
      return d.add(1, "month").toDate();
  }
}

const subscriptionWorker = new Worker(
  QUEUE_NAMES.SUBSCRIPTIONS,
  async (job) => {
    logger.info("Processing subscription billing", { jobId: job.id });

    const db = await getDB();
    const today = dayjs().format("YYYY-MM-DD");
    const now = new Date();

    // Find all subscriptions where next_billing_date <= today AND status IN (active, trialing)
    const activeSubscriptions = await db.findMany<Subscription>("subscriptions", {
      where: { status: SubscriptionStatus.ACTIVE },
    });

    const trialingSubscriptions = await db.findMany<Subscription>("subscriptions", {
      where: { status: SubscriptionStatus.TRIALING },
    });

    const allSubscriptions = [...activeSubscriptions, ...trialingSubscriptions];
    const dueSubscriptions = allSubscriptions.filter(
      (s) => dayjs(s.nextBillingDate).format("YYYY-MM-DD") <= today
    );

    logger.info(`Found ${dueSubscriptions.length} subscriptions due for processing`);

    let successCount = 0;
    let failCount = 0;

    for (const sub of dueSubscriptions) {
      try {
        if (sub.status === SubscriptionStatus.TRIALING) {
          // Trial has ended
          const trialEnd = sub.trialEnd ? new Date(sub.trialEnd) : now;
          if (trialEnd <= now) {
            // Fetch plan to compute period
            let plan: Plan | undefined;
            try {
              plan = await subscriptionService.getPlan(sub.orgId, sub.planId);
            } catch {
              logger.error("Plan not found for subscription", { subscriptionId: sub.id, planId: sub.planId });
              failCount++;
              continue;
            }

            // Convert to active
            const periodStart = now;
            const periodEnd = computePeriodEnd(periodStart, plan.billingInterval, plan.billingIntervalDays);

            await db.update("subscriptions", sub.id, {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              nextBillingDate: dayjs(periodEnd).format("YYYY-MM-DD"),
              updatedAt: now,
            }, sub.orgId);

            // Log trial_ended event
            await db.create("subscription_events", {
              id: uuid(),
              subscriptionId: sub.id,
              orgId: sub.orgId,
              eventType: SubscriptionEventType.TRIAL_ENDED,
              metadata: null,
              createdAt: now,
            });

            // Log activated event
            await db.create("subscription_events", {
              id: uuid(),
              subscriptionId: sub.id,
              orgId: sub.orgId,
              eventType: SubscriptionEventType.ACTIVATED,
              metadata: null,
              createdAt: now,
            });

            // Create first invoice
            const trialRenewal = await subscriptionService.renewSubscription(sub.id);

            // Attempt auto-charge with saved payment method
            const trialChargeResult = await chargeSubscriptionRenewal(
              trialRenewal.orgId,
              trialRenewal.invoiceId,
              trialRenewal.clientId
            );

            if (!trialChargeResult.success) {
              logger.warn("Auto-charge failed after trial ended", {
                subscriptionId: sub.id,
                invoiceId: trialRenewal.invoiceId,
                error: trialChargeResult.error,
              });
              // No need to mark as PAST_DUE here — subscription was just activated,
              // the client still has the invoice due date window to pay manually.
            }

            successCount++;
            logger.info("Trial ended, subscription activated", { subscriptionId: sub.id });
          }
        } else if (sub.status === SubscriptionStatus.ACTIVE) {
          if (!sub.autoRenew) {
            // auto_renew is false — expire the subscription
            await db.update("subscriptions", sub.id, {
              status: SubscriptionStatus.EXPIRED,
              updatedAt: now,
            }, sub.orgId);

            await db.create("subscription_events", {
              id: uuid(),
              subscriptionId: sub.id,
              orgId: sub.orgId,
              eventType: SubscriptionEventType.EXPIRED,
              metadata: null,
              createdAt: now,
            });

            successCount++;
            logger.info("Subscription expired (auto_renew=false)", { subscriptionId: sub.id });
          } else {
            // Renew: generate invoice and advance period
            const renewal = await subscriptionService.renewSubscription(sub.id);

            // Attempt auto-charge with saved payment method
            const chargeResult = await chargeSubscriptionRenewal(
              renewal.orgId,
              renewal.invoiceId,
              renewal.clientId
            );

            if (!chargeResult.success) {
              logger.warn("Subscription renewal auto-charge failed", {
                subscriptionId: sub.id,
                invoiceId: renewal.invoiceId,
                error: chargeResult.error,
              });

              // Mark subscription as PAST_DUE
              await db.update("subscriptions", sub.id, {
                status: SubscriptionStatus.PAST_DUE,
                updatedAt: now,
              }, sub.orgId);

              // Log payment_failed event
              await db.create("subscription_events", {
                id: uuid(),
                subscriptionId: sub.id,
                orgId: sub.orgId,
                eventType: SubscriptionEventType.PAYMENT_FAILED,
                metadata: JSON.stringify({
                  invoiceId: renewal.invoiceId,
                  error: chargeResult.error,
                }),
                createdAt: now,
              });

              // Create initial dunning attempt
              await db.create("dunning_attempts", {
                id: uuid(),
                orgId: sub.orgId,
                invoiceId: renewal.invoiceId,
                subscriptionId: sub.id,
                attemptNumber: 1,
                status: "failed" as DunningAttemptStatus,
                paymentError: chargeResult.error || "Auto-charge failed on renewal",
                nextRetryAt: dayjs(now).add(1, "day").toDate(),
                createdAt: now,
              });

              logger.info("Subscription marked as PAST_DUE, dunning attempt created", {
                subscriptionId: sub.id,
                invoiceId: renewal.invoiceId,
              });
            } else {
              logger.info("Subscription renewed and auto-charged successfully", {
                subscriptionId: sub.id,
                paymentId: chargeResult.paymentId,
              });
            }

            successCount++;
            logger.info("Subscription renewed", { subscriptionId: sub.id });
          }
        }
      } catch (err) {
        failCount++;
        logger.error("Subscription processing failed", {
          subscriptionId: sub.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Subscription billing processing complete", {
      total: dueSubscriptions.length,
      success: successCount,
      failed: failCount,
    });

    // ── Trial ending reminders ────────────────────────────────────────────
    // Find trialing subscriptions ending within 3 days
    const threeDaysFromNow = dayjs().add(3, "day").format("YYYY-MM-DD");
    const trialEndingSoon = trialingSubscriptions.filter(
      (s) => {
        if (!s.trialEnd) return false;
        const trialEndDate = dayjs(s.trialEnd).format("YYYY-MM-DD");
        return trialEndDate <= threeDaysFromNow && trialEndDate > today;
      }
    );

    let reminderCount = 0;
    for (const sub of trialEndingSoon) {
      try {
        // Get client email
        const client = await db.findById<{ id: string; email: string; name: string }>(
          "clients", sub.clientId, sub.orgId
        );
        if (!client?.email) continue;

        // Get plan details
        let plan: Plan | undefined;
        try {
          plan = await subscriptionService.getPlan(sub.orgId, sub.planId);
        } catch { continue; }

        const daysLeft = dayjs(sub.trialEnd).diff(dayjs(), "day");

        // Check if we already sent a reminder for this subscription today
        // Use a simple check — we'll rely on the email queue dedup

        // Queue the trial ending email
        await emailQueue.add(
          "send-email",
          {
            type: "trial-ending",
            orgId: sub.orgId,
            subscriptionId: sub.id,
            clientEmail: client.email,
            clientName: client.name,
            planName: plan.name,
            planPrice: plan.price,
            planCurrency: plan.currency,
            trialEndDate: dayjs(sub.trialEnd).format("YYYY-MM-DD"),
            daysLeft,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            // Use a job ID to prevent duplicate emails for same sub on same day
            jobId: `trial-ending-${sub.id}-${today}`,
          },
        );

        // Emit trial_ending event
        const { emit } = await import("../events/index");
        emit("subscription.trial_ending", {
          orgId: sub.orgId,
          subscriptionId: sub.id,
          subscription: { id: sub.id, planId: sub.planId, trialEnd: sub.trialEnd },
          planId: sub.planId,
          clientId: sub.clientId,
        });

        reminderCount++;
        logger.info("Trial ending reminder queued", {
          subscriptionId: sub.id,
          clientEmail: client.email,
          daysLeft,
        });
      } catch (err) {
        logger.error("Failed to send trial ending reminder", {
          subscriptionId: sub.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (reminderCount > 0) {
      logger.info(`Sent ${reminderCount} trial ending reminders`);
    }
  },
  { connection, concurrency: 1 }
);

// ── Worker events ────────────────────────────────────────────────────────────

subscriptionWorker.on("completed", (job) => {
  logger.info("Subscription billing job completed", { jobId: job.id });
});

subscriptionWorker.on("failed", (job, err) => {
  logger.error("Subscription billing job failed", { jobId: job?.id, error: err.message });
});

export { subscriptionWorker };
