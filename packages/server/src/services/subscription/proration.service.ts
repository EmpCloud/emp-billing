import dayjs from "dayjs";
import type { Plan, Subscription, BillingInterval } from "@emp-billing/shared";

// ============================================================================
// PRORATION SERVICE
// Calculates prorated charges/credits when changing subscription plans mid-cycle.
// All monetary values are in smallest currency unit (paise/cents).
// ============================================================================

export interface ProrationResult {
  /** Remaining value of current plan for unused days (smallest unit) */
  unusedCredit: number;
  /** Cost of new plan for remaining days in the current period (smallest unit) */
  newCharge: number;
  /** Net amount: newCharge - unusedCredit. Positive = charge, negative = credit */
  netAmount: number;
  /** Days left in the current billing period (including change date) */
  daysRemaining: number;
  /** Total days in the current billing period */
  daysTotal: number;
  /** Current plan price (full period, smallest unit) */
  currentPlanPrice: number;
  /** New plan price (full period, smallest unit) */
  newPlanPrice: number;
  /** Whether this is an upgrade (net positive) or downgrade (net negative / zero) */
  isUpgrade: boolean;
  /** Currency code */
  currency: string;
}

/**
 * Calculate proration when changing from the subscription's current plan to a new plan.
 *
 * The calculation uses a daily rate approach:
 *   dailyRate = (planPrice * quantity) / totalDaysInPeriod
 *   unusedCredit = dailyOldRate * daysRemaining
 *   newCharge    = dailyNewRate * daysRemaining
 *   netAmount    = newCharge - unusedCredit
 *
 * Supports monthly, quarterly, semi-annual, annual, and custom billing intervals.
 */
export function calculateProration(
  subscription: Subscription,
  currentPlan: Plan,
  newPlan: Plan,
  changeDate?: Date
): ProrationResult {
  const now = changeDate ?? new Date();

  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : new Date(now);
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : new Date(now);

  const daysTotal = daysBetween(periodStart, periodEnd);
  const daysRemaining = daysBetween(now, periodEnd);

  // Guard: if no days remain or period is zero-length, no proration needed
  if (daysTotal <= 0 || daysRemaining <= 0) {
    return {
      unusedCredit: 0,
      newCharge: 0,
      netAmount: 0,
      daysRemaining: 0,
      daysTotal: Math.max(daysTotal, 0),
      currentPlanPrice: currentPlan.price * subscription.quantity,
      newPlanPrice: newPlan.price * subscription.quantity,
      isUpgrade: newPlan.price > currentPlan.price,
      currency: currentPlan.currency,
    };
  }

  const quantity = subscription.quantity;

  // Daily rates based on full-period price
  const dailyOldRate = (currentPlan.price * quantity) / daysTotal;
  const dailyNewRate = (newPlan.price * quantity) / daysTotal;

  // Round to avoid fractional paise/cents
  const unusedCredit = Math.round(dailyOldRate * daysRemaining);
  const newCharge = Math.round(dailyNewRate * daysRemaining);
  const netAmount = newCharge - unusedCredit;

  return {
    unusedCredit,
    newCharge,
    netAmount,
    daysRemaining,
    daysTotal,
    currentPlanPrice: currentPlan.price * quantity,
    newPlanPrice: newPlan.price * quantity,
    isUpgrade: netAmount > 0,
    currency: currentPlan.currency,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.max(
    0,
    Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
  );
}
