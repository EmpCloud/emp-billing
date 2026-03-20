"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlans = listPlans;
exports.getPlan = getPlan;
exports.createPlan = createPlan;
exports.updatePlan = updatePlan;
exports.deletePlan = deletePlan;
exports.listSubscriptions = listSubscriptions;
exports.getSubscription = getSubscription;
exports.createSubscription = createSubscription;
exports.changePlan = changePlan;
exports.cancelSubscription = cancelSubscription;
exports.pauseSubscription = pauseSubscription;
exports.resumeSubscription = resumeSubscription;
exports.renewSubscription = renewSubscription;
exports.getSubscriptionEvents = getSubscriptionEvents;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const number_generator_1 = require("../../utils/number-generator");
const index_2 = require("../../events/index");
// ============================================================================
// SUBSCRIPTION SERVICE
// ============================================================================
// ── Helpers ──────────────────────────────────────────────────────────────────
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
            if (!customDays || customDays <= 0) {
                throw (0, AppError_1.BadRequestError)("billingIntervalDays is required for custom interval");
            }
            return d.add(customDays, "day").toDate();
        default:
            throw (0, AppError_1.BadRequestError)(`Unknown billing interval: ${interval}`);
    }
}
function daysBetween(a, b) {
    return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));
}
async function logEvent(subscriptionId, orgId, eventType, opts) {
    const db = await (0, index_1.getDB)();
    await db.create("subscription_events", {
        id: (0, uuid_1.v4)(),
        subscriptionId,
        orgId,
        eventType,
        oldPlanId: opts?.oldPlanId ?? null,
        newPlanId: opts?.newPlanId ?? null,
        metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
        createdAt: new Date(),
    });
}
// ============================================================================
// PLAN CRUD
// ============================================================================
// ── List Plans ──────────────────────────────────────────────────────────────
async function listPlans(orgId) {
    const db = await (0, index_1.getDB)();
    const plans = await db.findMany("plans", {
        where: { org_id: orgId, is_active: true },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    return plans.map(parsePlanFeatures);
}
// ── Get Plan ────────────────────────────────────────────────────────────────
async function getPlan(orgId, id) {
    const db = await (0, index_1.getDB)();
    const plan = await db.findById("plans", id, orgId);
    if (!plan)
        throw (0, AppError_1.NotFoundError)("Plan");
    return parsePlanFeatures(plan);
}
// ── Create Plan ─────────────────────────────────────────────────────────────
async function createPlan(orgId, input) {
    const db = await (0, index_1.getDB)();
    const id = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("plans", {
        id,
        orgId,
        name: input.name,
        description: input.description ?? null,
        billingInterval: input.billingInterval,
        billingIntervalDays: input.billingIntervalDays ?? null,
        trialPeriodDays: input.trialPeriodDays ?? 0,
        price: input.price,
        setupFee: input.setupFee ?? 0,
        currency: input.currency ?? "INR",
        features: JSON.stringify(input.features ?? []),
        isActive: true,
        sortOrder: input.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
    });
    return getPlan(orgId, id);
}
// ── Update Plan ─────────────────────────────────────────────────────────────
async function updatePlan(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("plans", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Plan");
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.description !== undefined)
        updateData.description = input.description;
    if (input.billingInterval !== undefined)
        updateData.billingInterval = input.billingInterval;
    if (input.billingIntervalDays !== undefined)
        updateData.billingIntervalDays = input.billingIntervalDays;
    if (input.trialPeriodDays !== undefined)
        updateData.trialPeriodDays = input.trialPeriodDays;
    if (input.price !== undefined)
        updateData.price = input.price;
    if (input.setupFee !== undefined)
        updateData.setupFee = input.setupFee;
    if (input.currency !== undefined)
        updateData.currency = input.currency;
    if (input.features !== undefined)
        updateData.features = JSON.stringify(input.features);
    if (input.sortOrder !== undefined)
        updateData.sortOrder = input.sortOrder;
    await db.update("plans", id, updateData, orgId);
    return getPlan(orgId, id);
}
// ── Delete Plan (soft delete) ───────────────────────────────────────────────
async function deletePlan(orgId, id) {
    const db = await (0, index_1.getDB)();
    const plan = await db.findById("plans", id, orgId);
    if (!plan)
        throw (0, AppError_1.NotFoundError)("Plan");
    await db.update("plans", id, {
        isActive: false,
        updatedAt: new Date(),
    }, orgId);
}
function parsePlanFeatures(plan) {
    if (typeof plan.features === "string") {
        try {
            plan.features = JSON.parse(plan.features);
        }
        catch {
            plan.features = [];
        }
    }
    return plan;
}
// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================
// ── List Subscriptions ──────────────────────────────────────────────────────
async function listSubscriptions(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("subscriptions", {
        where,
        page: opts.page ?? 1,
        limit: opts.limit ?? 20,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return result;
}
// ── Get Subscription ────────────────────────────────────────────────────────
async function getSubscription(orgId, id) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", id, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    // Load plan details
    let plan;
    try {
        plan = await getPlan(orgId, subscription.planId);
    }
    catch {
        // plan may have been deactivated
    }
    // Load recent events
    const events = await db.findMany("subscription_events", {
        where: { subscription_id: id, org_id: orgId },
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return { ...subscription, plan, events };
}
// ── Create Subscription ─────────────────────────────────────────────────────
async function createSubscription(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    // Validate client
    const client = await db.findById("clients", input.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Validate plan
    const plan = await getPlan(orgId, input.planId);
    if (!plan.isActive)
        throw (0, AppError_1.BadRequestError)("Plan is not active");
    const id = (0, uuid_1.v4)();
    const now = new Date();
    const quantity = input.quantity ?? 1;
    const autoRenew = input.autoRenew ?? true;
    let status;
    let trialStart = null;
    let trialEnd = null;
    let currentPeriodStart = null;
    let currentPeriodEnd = null;
    let nextBillingDate;
    if (plan.trialPeriodDays > 0) {
        // Start with trial
        status = shared_1.SubscriptionStatus.TRIALING;
        trialStart = now;
        trialEnd = (0, dayjs_1.default)(now).add(plan.trialPeriodDays, "day").toDate();
        nextBillingDate = trialEnd;
    }
    else {
        // Activate immediately
        status = shared_1.SubscriptionStatus.ACTIVE;
        currentPeriodStart = now;
        currentPeriodEnd = computePeriodEnd(now, plan.billingInterval, plan.billingIntervalDays);
        nextBillingDate = currentPeriodEnd;
    }
    await db.create("subscriptions", {
        id,
        orgId,
        clientId: input.clientId,
        planId: input.planId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        trialStart,
        trialEnd,
        cancelledAt: null,
        cancelReason: null,
        pauseStart: null,
        resumeDate: null,
        nextBillingDate: (0, dayjs_1.default)(nextBillingDate).format("YYYY-MM-DD"),
        quantity,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        autoRenew,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    // Log created event
    await logEvent(id, orgId, shared_1.SubscriptionEventType.CREATED, {
        newPlanId: input.planId,
        metadata: { quantity, autoRenew },
    });
    (0, index_2.emit)("subscription.created", {
        orgId,
        subscriptionId: id,
        subscription: { id, clientId: input.clientId, planId: input.planId, status },
        planId: input.planId,
        clientId: input.clientId,
    });
    // Log trial started if applicable
    if (plan.trialPeriodDays > 0) {
        await logEvent(id, orgId, shared_1.SubscriptionEventType.TRIAL_STARTED, {
            metadata: { trialDays: plan.trialPeriodDays, trialEnd },
        });
    }
    // If plan has setup fee, create a one-time invoice
    if (plan.setupFee > 0) {
        const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
        const invoiceId = (0, uuid_1.v4)();
        const dueDate = (0, dayjs_1.default)(now).add(7, "day").format("YYYY-MM-DD");
        await db.create("invoices", {
            id: invoiceId,
            orgId,
            clientId: input.clientId,
            invoiceNumber,
            status: shared_1.InvoiceStatus.SENT,
            issueDate: (0, dayjs_1.default)(now).format("YYYY-MM-DD"),
            dueDate,
            currency: plan.currency,
            exchangeRate: 1,
            subtotal: plan.setupFee,
            discountAmount: 0,
            taxAmount: 0,
            total: plan.setupFee,
            amountPaid: 0,
            amountDue: plan.setupFee,
            notes: `Setup fee for ${plan.name} subscription`,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        });
        // Create invoice item
        await db.create("invoice_items", {
            id: (0, uuid_1.v4)(),
            invoiceId,
            orgId,
            name: `Setup Fee - ${plan.name}`,
            description: `One-time setup fee for ${plan.name} plan`,
            quantity: 1,
            rate: plan.setupFee,
            discountAmount: 0,
            taxRate: 0,
            taxAmount: 0,
            amount: plan.setupFee,
            sortOrder: 0,
        });
    }
    return getSubscription(orgId, id);
}
// ── Change Plan ─────────────────────────────────────────────────────────────
async function changePlan(orgId, subscriptionId, input) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (![shared_1.SubscriptionStatus.ACTIVE, shared_1.SubscriptionStatus.TRIALING].includes(subscription.status)) {
        throw (0, AppError_1.BadRequestError)("Can only change plan for active or trialing subscriptions");
    }
    const oldPlan = await getPlan(orgId, subscription.planId);
    const newPlan = await getPlan(orgId, input.newPlanId);
    if (!newPlan.isActive)
        throw (0, AppError_1.BadRequestError)("New plan is not active");
    const now = new Date();
    const prorate = input.prorate ?? false;
    // If prorate and currently active (not trialing), calculate prorated invoice
    if (prorate && subscription.status === shared_1.SubscriptionStatus.ACTIVE && subscription.currentPeriodEnd) {
        const totalDays = daysBetween(subscription.currentPeriodStart, subscription.currentPeriodEnd);
        const remainingDays = daysBetween(now, subscription.currentPeriodEnd);
        if (totalDays > 0 && remainingDays > 0) {
            const dailyOldRate = (oldPlan.price * subscription.quantity) / totalDays;
            const creditAmount = Math.round(dailyOldRate * remainingDays);
            const dailyNewRate = (newPlan.price * subscription.quantity) / totalDays;
            const chargeAmount = Math.round(dailyNewRate * remainingDays);
            const netAmount = chargeAmount - creditAmount;
            if (netAmount !== 0) {
                const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(orgId);
                const invoiceId = (0, uuid_1.v4)();
                const dueDate = (0, dayjs_1.default)(now).add(7, "day").format("YYYY-MM-DD");
                const invoiceTotal = Math.abs(netAmount);
                await db.create("invoices", {
                    id: invoiceId,
                    orgId,
                    clientId: subscription.clientId,
                    invoiceNumber,
                    status: shared_1.InvoiceStatus.SENT,
                    issueDate: (0, dayjs_1.default)(now).format("YYYY-MM-DD"),
                    dueDate,
                    currency: newPlan.currency,
                    exchangeRate: 1,
                    subtotal: invoiceTotal,
                    discountAmount: 0,
                    taxAmount: 0,
                    total: invoiceTotal,
                    amountPaid: 0,
                    amountDue: invoiceTotal,
                    notes: netAmount > 0
                        ? `Prorated upgrade from ${oldPlan.name} to ${newPlan.name}`
                        : `Prorated downgrade credit from ${oldPlan.name} to ${newPlan.name}`,
                    createdBy: subscription.createdBy,
                    createdAt: now,
                    updatedAt: now,
                });
                // Credit line item (unused old plan)
                await db.create("invoice_items", {
                    id: (0, uuid_1.v4)(),
                    invoiceId,
                    orgId,
                    name: `Credit - ${oldPlan.name} (${remainingDays} days unused)`,
                    quantity: 1,
                    rate: -creditAmount,
                    discountAmount: 0,
                    taxRate: 0,
                    taxAmount: 0,
                    amount: -creditAmount,
                    sortOrder: 0,
                });
                // Charge line item (new plan for remaining period)
                await db.create("invoice_items", {
                    id: (0, uuid_1.v4)(),
                    invoiceId,
                    orgId,
                    name: `Charge - ${newPlan.name} (${remainingDays} days remaining)`,
                    quantity: 1,
                    rate: chargeAmount,
                    discountAmount: 0,
                    taxRate: 0,
                    taxAmount: 0,
                    amount: chargeAmount,
                    sortOrder: 1,
                });
            }
        }
    }
    // Update subscription plan
    await db.update("subscriptions", subscriptionId, {
        planId: input.newPlanId,
        updatedAt: now,
    }, orgId);
    // Log event: upgraded or downgraded based on price comparison
    const eventType = newPlan.price > oldPlan.price
        ? shared_1.SubscriptionEventType.UPGRADED
        : shared_1.SubscriptionEventType.DOWNGRADED;
    await logEvent(subscriptionId, orgId, eventType, {
        oldPlanId: oldPlan.id,
        newPlanId: newPlan.id,
        metadata: { prorate, oldPrice: oldPlan.price, newPrice: newPlan.price },
    });
    const changeEvent = newPlan.price > oldPlan.price ? "subscription.upgraded" : "subscription.downgraded";
    (0, index_2.emit)(changeEvent, {
        orgId,
        subscriptionId,
        subscription: { id: subscriptionId, planId: input.newPlanId },
        oldPlanId: oldPlan.id,
        newPlanId: newPlan.id,
        planId: input.newPlanId,
        clientId: subscription.clientId,
    });
    return getSubscription(orgId, subscriptionId);
}
// ── Cancel Subscription ─────────────────────────────────────────────────────
async function cancelSubscription(orgId, subscriptionId, input) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if ([shared_1.SubscriptionStatus.CANCELLED, shared_1.SubscriptionStatus.EXPIRED].includes(subscription.status)) {
        throw (0, AppError_1.BadRequestError)("Subscription is already cancelled or expired");
    }
    const now = new Date();
    const cancelImmediately = input.cancelImmediately ?? false;
    if (cancelImmediately) {
        await db.update("subscriptions", subscriptionId, {
            status: shared_1.SubscriptionStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: input.reason ?? null,
            updatedAt: now,
        }, orgId);
    }
    else {
        // Cancel at period end
        await db.update("subscriptions", subscriptionId, {
            autoRenew: false,
            cancelReason: input.reason ?? null,
            updatedAt: now,
        }, orgId);
    }
    await logEvent(subscriptionId, orgId, shared_1.SubscriptionEventType.CANCELLED, {
        metadata: {
            immediate: cancelImmediately,
            reason: input.reason,
        },
    });
    (0, index_2.emit)("subscription.cancelled", {
        orgId,
        subscriptionId,
        subscription: { id: subscriptionId, status: shared_1.SubscriptionStatus.CANCELLED, reason: input.reason },
        clientId: subscription.clientId,
    });
    return (await db.findById("subscriptions", subscriptionId, orgId));
}
// ── Pause Subscription ──────────────────────────────────────────────────────
async function pauseSubscription(orgId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (subscription.status !== shared_1.SubscriptionStatus.ACTIVE) {
        throw (0, AppError_1.BadRequestError)("Only active subscriptions can be paused");
    }
    const now = new Date();
    await db.update("subscriptions", subscriptionId, {
        status: shared_1.SubscriptionStatus.PAUSED,
        pauseStart: now,
        updatedAt: now,
    }, orgId);
    await logEvent(subscriptionId, orgId, shared_1.SubscriptionEventType.PAUSED);
    (0, index_2.emit)("subscription.paused", {
        orgId,
        subscriptionId,
        subscription: { id: subscriptionId, status: shared_1.SubscriptionStatus.PAUSED },
        clientId: subscription.clientId,
    });
    return (await db.findById("subscriptions", subscriptionId, orgId));
}
// ── Resume Subscription ─────────────────────────────────────────────────────
async function resumeSubscription(orgId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (subscription.status !== shared_1.SubscriptionStatus.PAUSED) {
        throw (0, AppError_1.BadRequestError)("Only paused subscriptions can be resumed");
    }
    const now = new Date();
    // Fetch plan to recompute period
    const plan = await getPlan(orgId, subscription.planId);
    const newPeriodEnd = computePeriodEnd(now, plan.billingInterval, plan.billingIntervalDays);
    await db.update("subscriptions", subscriptionId, {
        status: shared_1.SubscriptionStatus.ACTIVE,
        pauseStart: null,
        resumeDate: null,
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: (0, dayjs_1.default)(newPeriodEnd).format("YYYY-MM-DD"),
        updatedAt: now,
    }, orgId);
    await logEvent(subscriptionId, orgId, shared_1.SubscriptionEventType.RESUMED);
    (0, index_2.emit)("subscription.resumed", {
        orgId,
        subscriptionId,
        subscription: { id: subscriptionId, status: shared_1.SubscriptionStatus.ACTIVE },
        clientId: subscription.clientId,
    });
    return (await db.findById("subscriptions", subscriptionId, orgId));
}
// ── Renew Subscription (called by worker) ───────────────────────────────────
async function renewSubscription(subscriptionId) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    const plan = await getPlan(subscription.orgId, subscription.planId);
    const now = new Date();
    let total = plan.price * subscription.quantity;
    // Apply subscription coupon discount if present
    let discountAmount = 0;
    if (subscription.couponId && (subscription.couponDiscountAmount ?? 0) > 0) {
        discountAmount = Math.min(subscription.couponDiscountAmount ?? 0, total);
        total = Math.max(0, total - discountAmount);
    }
    // Create invoice for the plan price x quantity
    const invoiceNumber = await (0, number_generator_1.nextInvoiceNumber)(subscription.orgId);
    const invoiceId = (0, uuid_1.v4)();
    const dueDate = (0, dayjs_1.default)(now).add(7, "day").format("YYYY-MM-DD");
    await db.create("invoices", {
        id: invoiceId,
        orgId: subscription.orgId,
        clientId: subscription.clientId,
        invoiceNumber,
        status: shared_1.InvoiceStatus.SENT,
        issueDate: (0, dayjs_1.default)(now).format("YYYY-MM-DD"),
        dueDate,
        currency: plan.currency,
        exchangeRate: 1,
        subtotal: plan.price * subscription.quantity,
        discountAmount: discountAmount,
        taxAmount: 0,
        total,
        amountPaid: 0,
        amountDue: total,
        notes: `Subscription renewal - ${plan.name}${subscription.quantity > 1 ? ` (x${subscription.quantity})` : ""}${discountAmount > 0 ? ` (coupon discount applied)` : ""}`,
        createdBy: subscription.createdBy,
        createdAt: now,
        updatedAt: now,
    });
    // Create invoice item
    await db.create("invoice_items", {
        id: (0, uuid_1.v4)(),
        invoiceId,
        orgId: subscription.orgId,
        name: plan.name,
        description: `Subscription renewal - ${plan.billingInterval} plan`,
        quantity: subscription.quantity,
        rate: plan.price,
        discountAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: total,
        sortOrder: 0,
    });
    // Advance current_period_start/end
    const newPeriodStart = subscription.currentPeriodEnd ?? now;
    const newPeriodEnd = computePeriodEnd(newPeriodStart, plan.billingInterval, plan.billingIntervalDays);
    await db.update("subscriptions", subscriptionId, {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: (0, dayjs_1.default)(newPeriodEnd).format("YYYY-MM-DD"),
        updatedAt: now,
    }, subscription.orgId);
    // Log renewed event
    await logEvent(subscriptionId, subscription.orgId, shared_1.SubscriptionEventType.RENEWED, {
        metadata: { invoiceId, total },
    });
    (0, index_2.emit)("subscription.renewed", {
        orgId: subscription.orgId,
        subscriptionId,
        subscription: { id: subscriptionId, planId: subscription.planId },
        planId: subscription.planId,
        clientId: subscription.clientId,
    });
    return { invoiceId, orgId: subscription.orgId, clientId: subscription.clientId };
}
// ── Get Subscription Events ─────────────────────────────────────────────────
async function getSubscriptionEvents(orgId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    // Validate subscription exists
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    const events = await db.findMany("subscription_events", {
        where: { subscription_id: subscriptionId, org_id: orgId },
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return events;
}
//# sourceMappingURL=subscription.service.js.map