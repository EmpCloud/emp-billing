"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMRR = getMRR;
exports.getARR = getARR;
exports.getChurnMetrics = getChurnMetrics;
exports.getLTV = getLTV;
exports.getRevenueBreakdown = getRevenueBreakdown;
exports.getSubscriptionStats = getSubscriptionStats;
exports.getCohortAnalysis = getCohortAnalysis;
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const shared_1 = require("@emp-billing/shared");
// ============================================================================
// SAAS METRICS SERVICE
// Computes MRR, ARR, churn, LTV, revenue breakdown, and cohort analysis
// from the subscriptions and plans tables.
// ============================================================================
// ── Helpers ─────────────────────────────────────────────────────────────────
/** Normalize plan price to monthly amount based on billing interval */
function normalizeToMonthly(price, interval) {
    switch (interval) {
        case "monthly":
            return price;
        case "quarterly":
            return Math.round(price / 3);
        case "semi_annual":
            return Math.round(price / 6);
        case "annual":
            return Math.round(price / 12);
        default:
            return price;
    }
}
// ── MRR ─────────────────────────────────────────────────────────────────────
async function getMRR(orgId) {
    const db = await (0, index_1.getDB)();
    // Current MRR: sum of active subscription prices normalized to monthly
    const currentRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.status = ?`, [orgId, shared_1.SubscriptionStatus.ACTIVE]);
    const mrr = currentRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    // Last month MRR: subscriptions that were active one month ago
    const oneMonthAgo = (0, dayjs_1.default)().subtract(1, "month").format("YYYY-MM-DD HH:mm:ss");
    const lastMonthRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ?
       AND s.created_at <= ?
       AND (s.status = ? OR (s.cancelled_at IS NOT NULL AND s.cancelled_at > ?))`, [orgId, oneMonthAgo, shared_1.SubscriptionStatus.ACTIVE, oneMonthAgo]);
    const lastMrr = lastMonthRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    const mrrGrowth = lastMrr > 0 ? Math.round(((mrr - lastMrr) / lastMrr) * 10000) / 100 : 0;
    return { mrr, mrrGrowth };
}
// ── ARR ─────────────────────────────────────────────────────────────────────
async function getARR(orgId) {
    const { mrr } = await getMRR(orgId);
    return { arr: mrr * 12 };
}
// ── Churn Metrics ───────────────────────────────────────────────────────────
async function getChurnMetrics(orgId, period) {
    const db = await (0, index_1.getDB)();
    const from = period.from;
    const to = period.to;
    // Active at period start
    const [activeStartRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions
     WHERE org_id = ? AND created_at <= ? AND (status = ? OR (cancelled_at IS NOT NULL AND cancelled_at > ?))`, [orgId, from, shared_1.SubscriptionStatus.ACTIVE, from]);
    const activeAtStart = Number(activeStartRow?.count ?? 0);
    // Cancelled during period
    const [cancelledRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions
     WHERE org_id = ? AND cancelled_at >= ? AND cancelled_at <= ?`, [orgId, from, to]);
    const cancelledDuringPeriod = Number(cancelledRow?.count ?? 0);
    // Customer churn rate
    const customerChurn = activeAtStart > 0
        ? Math.round((cancelledDuringPeriod / activeAtStart) * 10000) / 100
        : 0;
    // MRR at start
    const mrrStartRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.created_at <= ?
       AND (s.status = ? OR (s.cancelled_at IS NOT NULL AND s.cancelled_at > ?))`, [orgId, from, shared_1.SubscriptionStatus.ACTIVE, from]);
    const mrrAtStart = mrrStartRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    // MRR lost from cancellations
    const churnedRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.cancelled_at >= ? AND s.cancelled_at <= ?`, [orgId, from, to]);
    const mrrLost = churnedRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    const revenueChurn = mrrAtStart > 0
        ? Math.round((mrrLost / mrrAtStart) * 10000) / 100
        : 0;
    // MRR at end
    const mrrEndRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.status = ? AND s.created_at <= ?`, [orgId, shared_1.SubscriptionStatus.ACTIVE, to]);
    const mrrAtEnd = mrrEndRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    const netRevenueRetention = mrrAtStart > 0
        ? Math.round((mrrAtEnd / mrrAtStart) * 10000) / 100
        : 100;
    return { customerChurn, revenueChurn, netRevenueRetention };
}
// ── LTV ─────────────────────────────────────────────────────────────────────
async function getLTV(orgId) {
    const db = await (0, index_1.getDB)();
    // Average revenue per customer (monthly)
    const activeRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.status = ?`, [orgId, shared_1.SubscriptionStatus.ACTIVE]);
    const totalActiveCustomers = activeRows.length;
    const totalMonthlyRevenue = activeRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    const avgRevenuePerCustomer = totalActiveCustomers > 0
        ? Math.round(totalMonthlyRevenue / totalActiveCustomers)
        : 0;
    // Average subscription duration (months)
    const durationRows = await db.raw(`SELECT AVG(
       TIMESTAMPDIFF(MONTH, s.created_at, COALESCE(s.cancelled_at, NOW()))
     ) as avg_months
     FROM subscriptions s
     WHERE s.org_id = ?`, [orgId]);
    const avgDuration = Number(durationRows[0]?.avg_months ?? 0);
    // Simple churn rate (cancelled last 3 months / total active)
    const threeMonthsAgo = (0, dayjs_1.default)().subtract(3, "month").format("YYYY-MM-DD HH:mm:ss");
    const [cancelledRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions
     WHERE org_id = ? AND cancelled_at >= ?`, [orgId, threeMonthsAgo]);
    const [totalRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions WHERE org_id = ?`, [orgId]);
    const monthlyChurnRate = Number(totalRow?.count ?? 0) > 0
        ? (Number(cancelledRow?.count ?? 0) / 3) / Number(totalRow?.count ?? 0)
        : 0;
    const ltv = monthlyChurnRate > 0
        ? Math.round(avgRevenuePerCustomer / monthlyChurnRate)
        : avgRevenuePerCustomer * 24; // fallback: 2 years
    return {
        ltv,
        averageSubscriptionDurationMonths: Math.round(avgDuration * 10) / 10,
    };
}
// ── Revenue Breakdown ───────────────────────────────────────────────────────
async function getRevenueBreakdown(orgId, months = 12) {
    const db = await (0, index_1.getDB)();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
        const monthStart = (0, dayjs_1.default)().subtract(i, "month").startOf("month");
        const monthEnd = monthStart.endOf("month");
        const monthStr = monthStart.format("YYYY-MM");
        const prevMonthStart = monthStart.subtract(1, "month").startOf("month");
        // New MRR: subscriptions created this month
        const newRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.org_id = ? AND s.created_at >= ? AND s.created_at <= ?
         AND s.status IN (?, ?)`, [orgId, monthStart.format("YYYY-MM-DD"), monthEnd.format("YYYY-MM-DD 23:59:59"),
            shared_1.SubscriptionStatus.ACTIVE, shared_1.SubscriptionStatus.TRIALING]);
        const newMRR = newRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
        // Expansion MRR: subscriptions upgraded this month (via subscription_events)
        const [expansionRow] = await db.raw(`SELECT COALESCE(SUM(
         (SELECT normalizing_price FROM (
           SELECT p2.price / CASE p2.billing_interval
             WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
             WHEN 'semi_annual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END as normalizing_price
           FROM plans p2 WHERE p2.id = se.new_plan_id
         ) sub1) -
         (SELECT normalizing_price FROM (
           SELECT p3.price / CASE p3.billing_interval
             WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
             WHEN 'semi_annual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END as normalizing_price
           FROM plans p3 WHERE p3.id = se.old_plan_id
         ) sub2)
       ), 0) as total
       FROM subscription_events se
       WHERE se.org_id = ? AND se.event_type = 'upgraded'
         AND se.created_at >= ? AND se.created_at <= ?`, [orgId, monthStart.format("YYYY-MM-DD"), monthEnd.format("YYYY-MM-DD 23:59:59")]);
        const expansionMRR = Math.max(0, Number(expansionRow?.total ?? 0));
        // Contraction MRR: subscriptions downgraded this month
        const [contractionRow] = await db.raw(`SELECT COALESCE(SUM(
         (SELECT normalizing_price FROM (
           SELECT p2.price / CASE p2.billing_interval
             WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
             WHEN 'semi_annual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END as normalizing_price
           FROM plans p2 WHERE p2.id = se.old_plan_id
         ) sub1) -
         (SELECT normalizing_price FROM (
           SELECT p3.price / CASE p3.billing_interval
             WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
             WHEN 'semi_annual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END as normalizing_price
           FROM plans p3 WHERE p3.id = se.new_plan_id
         ) sub2)
       ), 0) as total
       FROM subscription_events se
       WHERE se.org_id = ? AND se.event_type = 'downgraded'
         AND se.created_at >= ? AND se.created_at <= ?`, [orgId, monthStart.format("YYYY-MM-DD"), monthEnd.format("YYYY-MM-DD 23:59:59")]);
        const contractionMRR = Math.max(0, Number(contractionRow?.total ?? 0));
        // Churn MRR: subscriptions cancelled this month
        const churnRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.org_id = ? AND s.cancelled_at >= ? AND s.cancelled_at <= ?`, [orgId, monthStart.format("YYYY-MM-DD"), monthEnd.format("YYYY-MM-DD 23:59:59")]);
        const churnMRR = churnRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
        const netNewMRR = newMRR + expansionMRR - contractionMRR - churnMRR;
        result.push({
            month: monthStr,
            newMRR,
            expansionMRR,
            contractionMRR,
            churnMRR,
            netNewMRR,
        });
    }
    return result;
}
// ── Subscription Stats ──────────────────────────────────────────────────────
async function getSubscriptionStats(orgId) {
    const db = await (0, index_1.getDB)();
    const statusCounts = await db.raw(`SELECT status, COUNT(*) as count FROM subscriptions WHERE org_id = ? GROUP BY status`, [orgId]);
    const countMap = {};
    for (const row of statusCounts) {
        countMap[row.status] = Number(row.count);
    }
    // Conversion rate: subscriptions that went from trialing to active
    const [trialRow] = await db.raw(`SELECT COUNT(*) as count FROM subscription_events
     WHERE org_id = ? AND event_type = 'trial_started'`, [orgId]);
    const [activatedRow] = await db.raw(`SELECT COUNT(*) as count FROM subscription_events
     WHERE org_id = ? AND event_type = 'activated'`, [orgId]);
    const totalTrials = Number(trialRow?.count ?? 0);
    const totalActivations = Number(activatedRow?.count ?? 0);
    const conversionRate = totalTrials > 0
        ? Math.round((totalActivations / totalTrials) * 10000) / 100
        : 0;
    // Average revenue per subscription
    const activeRows = await db.raw(`SELECT p.price, p.billing_interval, s.quantity
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.org_id = ? AND s.status = ?`, [orgId, shared_1.SubscriptionStatus.ACTIVE]);
    const totalActive = countMap[shared_1.SubscriptionStatus.ACTIVE] ?? 0;
    const totalRevenue = activeRows.reduce((sum, r) => sum + normalizeToMonthly(Number(r.price), r.billing_interval) * Number(r.quantity), 0);
    const averageRevenuePerSubscription = totalActive > 0
        ? Math.round(totalRevenue / totalActive)
        : 0;
    return {
        totalActive: countMap[shared_1.SubscriptionStatus.ACTIVE] ?? 0,
        totalTrialing: countMap[shared_1.SubscriptionStatus.TRIALING] ?? 0,
        totalPaused: countMap[shared_1.SubscriptionStatus.PAUSED] ?? 0,
        totalPastDue: countMap[shared_1.SubscriptionStatus.PAST_DUE] ?? 0,
        totalCancelled: countMap[shared_1.SubscriptionStatus.CANCELLED] ?? 0,
        conversionRate,
        averageRevenuePerSubscription,
    };
}
// ── Cohort Analysis ─────────────────────────────────────────────────────────
async function getCohortAnalysis(orgId, months = 12) {
    const db = await (0, index_1.getDB)();
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
        const cohortMonth = (0, dayjs_1.default)().subtract(i, "month").startOf("month");
        const cohortEnd = cohortMonth.endOf("month");
        const cohortStr = cohortMonth.format("YYYY-MM");
        // Total subscriptions created in this cohort month
        const [totalRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions
       WHERE org_id = ? AND created_at >= ? AND created_at <= ?`, [orgId, cohortMonth.format("YYYY-MM-DD"), cohortEnd.format("YYYY-MM-DD 23:59:59")]);
        const totalSubscriptions = Number(totalRow?.count ?? 0);
        if (totalSubscriptions === 0) {
            result.push({
                cohortMonth: cohortStr,
                totalSubscriptions: 0,
                retentionByMonth: [],
            });
            continue;
        }
        // For each subsequent month, calculate retention
        const retentionByMonth = [];
        const maxMonths = i + 1; // how many months of data we have for this cohort
        for (let m = 0; m < Math.min(maxMonths, months); m++) {
            const checkDate = cohortMonth.add(m, "month").endOf("month");
            // Count subscriptions from this cohort that were still active at checkDate
            const [retainedRow] = await db.raw(`SELECT COUNT(*) as count FROM subscriptions
         WHERE org_id = ?
           AND created_at >= ? AND created_at <= ?
           AND (status = ? OR (cancelled_at IS NOT NULL AND cancelled_at > ?))`, [
                orgId,
                cohortMonth.format("YYYY-MM-DD"),
                cohortEnd.format("YYYY-MM-DD 23:59:59"),
                shared_1.SubscriptionStatus.ACTIVE,
                checkDate.format("YYYY-MM-DD 23:59:59"),
            ]);
            const retained = Number(retainedRow?.count ?? 0);
            const retention = Math.round((retained / totalSubscriptions) * 10000) / 100;
            retentionByMonth.push(retention);
        }
        result.push({
            cohortMonth: cohortStr,
            totalSubscriptions,
            retentionByMonth,
        });
    }
    return result;
}
//# sourceMappingURL=metrics.service.js.map