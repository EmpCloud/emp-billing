import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import {
  BillingInterval,
  SubscriptionStatus,
  SubscriptionEventType,
  InvoiceStatus,
  CreditNoteStatus,
} from "@emp-billing/shared";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { emit } from "../../events/index";
import { calculateProration } from "./proration.service";
import type { Plan, Subscription, SubscriptionEvent, ProrationPreview } from "@emp-billing/shared";
import type { ProrationResult } from "./proration.service";
import type { z } from "zod";
import type {
  CreatePlanSchema,
  UpdatePlanSchema,
  CreateSubscriptionSchema,
  ChangeSubscriptionPlanSchema,
  CancelSubscriptionSchema,
  SubscriptionFilterSchema,
  PreviewPlanChangeSchema,
} from "@emp-billing/shared";

// ============================================================================
// SUBSCRIPTION SERVICE
// ============================================================================

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      if (!customDays || customDays <= 0) {
        throw BadRequestError("billingIntervalDays is required for custom interval");
      }
      return d.add(customDays, "day").toDate();
    default:
      throw BadRequestError(`Unknown billing interval: ${interval}`);
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)));
}

async function logEvent(
  subscriptionId: string,
  orgId: string,
  eventType: SubscriptionEventType,
  opts?: { oldPlanId?: string; newPlanId?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const db = await getDB();
  await db.create("subscription_events", {
    id: uuid(),
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

export async function listPlans(orgId: string): Promise<Plan[]> {
  const db = await getDB();
  const plans = await db.findMany<Plan>("plans", {
    where: { org_id: orgId, is_active: true },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });
  return plans.map(parsePlanFeatures);
}

// ── Get Plan ────────────────────────────────────────────────────────────────

export async function getPlan(orgId: string, id: string): Promise<Plan> {
  const db = await getDB();
  const plan = await db.findById<Plan>("plans", id, orgId);
  if (!plan) throw NotFoundError("Plan");
  return parsePlanFeatures(plan);
}

// ── Create Plan ─────────────────────────────────────────────────────────────

export async function createPlan(
  orgId: string,
  input: z.infer<typeof CreatePlanSchema>
): Promise<Plan> {
  const db = await getDB();
  const id = uuid();
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

export async function updatePlan(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdatePlanSchema>
): Promise<Plan> {
  const db = await getDB();
  const existing = await db.findById<Plan>("plans", id, orgId);
  if (!existing) throw NotFoundError("Plan");

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.billingInterval !== undefined) updateData.billingInterval = input.billingInterval;
  if (input.billingIntervalDays !== undefined) updateData.billingIntervalDays = input.billingIntervalDays;
  if (input.trialPeriodDays !== undefined) updateData.trialPeriodDays = input.trialPeriodDays;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.setupFee !== undefined) updateData.setupFee = input.setupFee;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.features !== undefined) updateData.features = JSON.stringify(input.features);
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  await db.update("plans", id, updateData, orgId);
  return getPlan(orgId, id);
}

// ── Delete Plan (soft delete) ───────────────────────────────────────────────

export async function deletePlan(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const plan = await db.findById<Plan>("plans", id, orgId);
  if (!plan) throw NotFoundError("Plan");

  await db.update("plans", id, {
    isActive: false,
    updatedAt: new Date(),
  }, orgId);
}

function parsePlanFeatures(plan: Plan): Plan {
  if (typeof plan.features === "string") {
    try {
      plan.features = JSON.parse(plan.features as unknown as string);
    } catch {
      plan.features = [];
    }
  }
  return plan;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

// ── List Subscriptions ──────────────────────────────────────────────────────

export async function listSubscriptions(
  orgId: string,
  opts: z.infer<typeof SubscriptionFilterSchema>
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<Subscription>("subscriptions", {
    where,
    page: opts.page ?? 1,
    limit: opts.limit ?? 20,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return result;
}

// ── Get Subscription ────────────────────────────────────────────────────────

export async function getSubscription(
  orgId: string,
  id: string
): Promise<Subscription & { plan?: Plan; events?: SubscriptionEvent[] }> {
  const db = await getDB();
  const subscription = await db.findById<Subscription>("subscriptions", id, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  // Load plan details
  let plan: Plan | undefined;
  try {
    plan = await getPlan(orgId, subscription.planId);
  } catch {
    // plan may have been deactivated
  }

  // Load recent events
  const events = await db.findMany<SubscriptionEvent>("subscription_events", {
    where: { subscription_id: id, org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return { ...subscription, plan, events };
}

// ── Create Subscription ─────────────────────────────────────────────────────

export async function createSubscription(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateSubscriptionSchema>
): Promise<Subscription & { plan?: Plan }> {
  const db = await getDB();

  // Validate client
  const client = await db.findById<{ id: string }>("clients", input.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Validate plan
  const plan = await getPlan(orgId, input.planId);
  if (!plan.isActive) throw BadRequestError("Plan is not active");

  const id = uuid();
  const now = new Date();
  const quantity = input.quantity ?? 1;
  const autoRenew = input.autoRenew ?? true;

  let status: SubscriptionStatus;
  let trialStart: Date | null = null;
  let trialEnd: Date | null = null;
  let currentPeriodStart: Date | null = null;
  let currentPeriodEnd: Date | null = null;
  let nextBillingDate: Date;

  if (plan.trialPeriodDays > 0) {
    // Start with trial
    status = SubscriptionStatus.TRIALING;
    trialStart = now;
    trialEnd = dayjs(now).add(plan.trialPeriodDays, "day").toDate();
    nextBillingDate = trialEnd;
  } else {
    // Activate immediately
    status = SubscriptionStatus.ACTIVE;
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
    nextBillingDate: dayjs(nextBillingDate).format("YYYY-MM-DD"),
    quantity,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    autoRenew,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Log created event
  await logEvent(id, orgId, SubscriptionEventType.CREATED, {
    newPlanId: input.planId,
    metadata: { quantity, autoRenew },
  });

  emit("subscription.created", {
    orgId,
    subscriptionId: id,
    subscription: { id, clientId: input.clientId, planId: input.planId, status },
    planId: input.planId,
    clientId: input.clientId,
  });

  // If no trial period, subscription is immediately active — emit activated event
  if (plan.trialPeriodDays === 0) {
    await logEvent(id, orgId, SubscriptionEventType.ACTIVATED);

    emit("subscription.activated", {
      orgId,
      subscriptionId: id,
      subscription: { id, clientId: input.clientId, planId: input.planId, status },
      planId: input.planId,
      clientId: input.clientId,
    });
  }

  // Log trial started if applicable
  if (plan.trialPeriodDays > 0) {
    await logEvent(id, orgId, SubscriptionEventType.TRIAL_STARTED, {
      metadata: { trialDays: plan.trialPeriodDays, trialEnd },
    });
  }

  // If plan has setup fee, create a one-time invoice
  if (plan.setupFee > 0) {
    const invoiceNumber = await nextInvoiceNumber(orgId);
    const invoiceId = uuid();
    const dueDate = dayjs(now).add(7, "day").format("YYYY-MM-DD");

    await db.create("invoices", {
      id: invoiceId,
      orgId,
      clientId: input.clientId,
      invoiceNumber,
      status: InvoiceStatus.SENT,
      issueDate: dayjs(now).format("YYYY-MM-DD"),
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
      id: uuid(),
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

// ── Preview Plan Change (Proration) ─────────────────────────────────────────

export async function previewPlanChange(
  orgId: string,
  subscriptionId: string,
  input: z.infer<typeof PreviewPlanChangeSchema>
): Promise<ProrationPreview> {
  const db = await getDB();

  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(subscription.status)) {
    throw BadRequestError("Can only preview plan change for active or trialing subscriptions");
  }

  const currentPlan = await getPlan(orgId, subscription.planId);
  const newPlan = await getPlan(orgId, input.newPlanId);
  if (!newPlan.isActive) throw BadRequestError("New plan is not active");

  const proration = calculateProration(subscription, currentPlan, newPlan);

  return {
    unusedCredit: proration.unusedCredit,
    newCharge: proration.newCharge,
    netAmount: proration.netAmount,
    daysRemaining: proration.daysRemaining,
    daysTotal: proration.daysTotal,
    currentPlanPrice: proration.currentPlanPrice,
    newPlanPrice: proration.newPlanPrice,
    isUpgrade: proration.isUpgrade,
    currency: proration.currency,
  };
}

// ── Change Plan ─────────────────────────────────────────────────────────────

export async function changePlan(
  orgId: string,
  subscriptionId: string,
  input: z.infer<typeof ChangeSubscriptionPlanSchema>
): Promise<Subscription & { plan?: Plan }> {
  const db = await getDB();

  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(subscription.status)) {
    throw BadRequestError("Can only change plan for active or trialing subscriptions");
  }

  const oldPlan = await getPlan(orgId, subscription.planId);
  const newPlan = await getPlan(orgId, input.newPlanId);
  if (!newPlan.isActive) throw BadRequestError("New plan is not active");

  const now = new Date();
  const prorate = input.prorate ?? false;

  // If prorate and currently active (not trialing), use the proration engine
  if (prorate && subscription.status === SubscriptionStatus.ACTIVE && subscription.currentPeriodEnd) {
    const proration = calculateProration(subscription, oldPlan, newPlan, now);

    if (proration.netAmount !== 0 && proration.daysRemaining > 0) {
      if (proration.isUpgrade) {
        // Upgrade: create an invoice for the prorated difference
        const invoiceNumber = await nextInvoiceNumber(orgId);
        const invoiceId = uuid();
        const dueDate = dayjs(now).add(7, "day").format("YYYY-MM-DD");

        await db.create("invoices", {
          id: invoiceId,
          orgId,
          clientId: subscription.clientId,
          invoiceNumber,
          status: InvoiceStatus.SENT,
          issueDate: dayjs(now).format("YYYY-MM-DD"),
          dueDate,
          currency: newPlan.currency,
          exchangeRate: 1,
          subtotal: proration.newCharge,
          discountAmount: proration.unusedCredit,
          taxAmount: 0,
          total: proration.netAmount,
          amountPaid: 0,
          amountDue: proration.netAmount,
          notes: `Prorated upgrade from ${oldPlan.name} to ${newPlan.name} (${proration.daysRemaining} of ${proration.daysTotal} days remaining)`,
          createdBy: subscription.createdBy,
          createdAt: now,
          updatedAt: now,
        });

        // Credit line item (unused old plan)
        await db.create("invoice_items", {
          id: uuid(),
          invoiceId,
          orgId,
          name: `Credit - ${oldPlan.name} (${proration.daysRemaining} days unused)`,
          quantity: 1,
          rate: -proration.unusedCredit,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: -proration.unusedCredit,
          sortOrder: 0,
        });

        // Charge line item (new plan for remaining period)
        await db.create("invoice_items", {
          id: uuid(),
          invoiceId,
          orgId,
          name: `Charge - ${newPlan.name} (${proration.daysRemaining} days remaining)`,
          quantity: 1,
          rate: proration.newCharge,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: proration.newCharge,
          sortOrder: 1,
        });
      } else {
        // Downgrade: create a credit note for the difference
        const creditAmount = Math.abs(proration.netAmount);
        const creditNoteId = uuid();
        const creditNoteNumber = await generateProrationCreditNoteNumber(orgId);

        await db.create("credit_notes", {
          id: creditNoteId,
          orgId,
          clientId: subscription.clientId,
          creditNoteNumber,
          status: CreditNoteStatus.OPEN,
          date: dayjs(now).format("YYYY-MM-DD"),
          subtotal: creditAmount,
          taxAmount: 0,
          total: creditAmount,
          balance: creditAmount,
          reason: `Prorated downgrade from ${oldPlan.name} to ${newPlan.name} (${proration.daysRemaining} of ${proration.daysTotal} days remaining)`,
          createdBy: subscription.createdBy,
          createdAt: now,
          updatedAt: now,
        });

        // Credit note line item
        await db.create("credit_note_items", {
          id: uuid(),
          creditNoteId,
          orgId,
          name: `Downgrade credit - ${oldPlan.name} to ${newPlan.name}`,
          description: `Unused value (${proration.daysRemaining} days) minus new plan cost for remaining period`,
          quantity: 1,
          rate: creditAmount,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          amount: creditAmount,
          sortOrder: 0,
        });
      }
    }
  }

  // Update subscription plan immediately
  await db.update("subscriptions", subscriptionId, {
    planId: input.newPlanId,
    updatedAt: now,
  }, orgId);

  // Log event: upgraded or downgraded based on price comparison
  const isUpgrade = newPlan.price > oldPlan.price;
  const eventType = isUpgrade
    ? SubscriptionEventType.UPGRADED
    : SubscriptionEventType.DOWNGRADED;

  await logEvent(subscriptionId, orgId, eventType, {
    oldPlanId: oldPlan.id,
    newPlanId: newPlan.id,
    metadata: { prorate, oldPrice: oldPlan.price, newPrice: newPlan.price },
  });

  const changeEvent = isUpgrade ? "subscription.upgraded" : "subscription.downgraded";
  emit(changeEvent, {
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

// ── Helper: Generate proration credit note number ────────────────────────────

async function generateProrationCreditNoteNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const count = await db.count("credit_notes", { org_id: orgId });
  const year = new Date().getFullYear();
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── Cancel Subscription ─────────────────────────────────────────────────────

export async function cancelSubscription(
  orgId: string,
  subscriptionId: string,
  input: z.infer<typeof CancelSubscriptionSchema>
): Promise<Subscription> {
  const db = await getDB();
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if ([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
    throw BadRequestError("Subscription is already cancelled or expired");
  }

  const now = new Date();
  const cancelImmediately = input.cancelImmediately ?? false;

  if (cancelImmediately) {
    await db.update("subscriptions", subscriptionId, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
      cancelReason: input.reason ?? null,
      updatedAt: now,
    }, orgId);
  } else {
    // Cancel at period end
    await db.update("subscriptions", subscriptionId, {
      autoRenew: false,
      cancelReason: input.reason ?? null,
      updatedAt: now,
    }, orgId);
  }

  await logEvent(subscriptionId, orgId, SubscriptionEventType.CANCELLED, {
    metadata: {
      immediate: cancelImmediately,
      reason: input.reason,
    },
  });

  emit("subscription.cancelled", {
    orgId,
    subscriptionId,
    subscription: { id: subscriptionId, status: SubscriptionStatus.CANCELLED, reason: input.reason },
    clientId: subscription.clientId,
  });

  return (await db.findById<Subscription>("subscriptions", subscriptionId, orgId))!;
}

// ── Pause Subscription ──────────────────────────────────────────────────────

export async function pauseSubscription(
  orgId: string,
  subscriptionId: string
): Promise<Subscription> {
  const db = await getDB();
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    throw BadRequestError("Only active subscriptions can be paused");
  }

  const now = new Date();
  await db.update("subscriptions", subscriptionId, {
    status: SubscriptionStatus.PAUSED,
    pauseStart: now,
    updatedAt: now,
  }, orgId);

  await logEvent(subscriptionId, orgId, SubscriptionEventType.PAUSED);

  emit("subscription.paused", {
    orgId,
    subscriptionId,
    subscription: { id: subscriptionId, status: SubscriptionStatus.PAUSED },
    clientId: subscription.clientId,
  });

  return (await db.findById<Subscription>("subscriptions", subscriptionId, orgId))!;
}

// ── Resume Subscription ─────────────────────────────────────────────────────

export async function resumeSubscription(
  orgId: string,
  subscriptionId: string
): Promise<Subscription> {
  const db = await getDB();
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if (subscription.status !== SubscriptionStatus.PAUSED) {
    throw BadRequestError("Only paused subscriptions can be resumed");
  }

  const now = new Date();

  // Fetch plan to recompute period
  const plan = await getPlan(orgId, subscription.planId);
  const newPeriodEnd = computePeriodEnd(now, plan.billingInterval, plan.billingIntervalDays);

  await db.update("subscriptions", subscriptionId, {
    status: SubscriptionStatus.ACTIVE,
    pauseStart: null,
    resumeDate: null,
    currentPeriodStart: now,
    currentPeriodEnd: newPeriodEnd,
    nextBillingDate: dayjs(newPeriodEnd).format("YYYY-MM-DD"),
    updatedAt: now,
  }, orgId);

  await logEvent(subscriptionId, orgId, SubscriptionEventType.RESUMED);

  emit("subscription.resumed", {
    orgId,
    subscriptionId,
    subscription: { id: subscriptionId, status: SubscriptionStatus.ACTIVE },
    clientId: subscription.clientId,
  });

  return (await db.findById<Subscription>("subscriptions", subscriptionId, orgId))!;
}

// ── Renew Subscription (called by worker) ───────────────────────────────────

export async function renewSubscription(subscriptionId: string): Promise<{ invoiceId: string; orgId: string; clientId: string }> {
  const db = await getDB();
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId);
  if (!subscription) throw NotFoundError("Subscription");

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
  const invoiceNumber = await nextInvoiceNumber(subscription.orgId);
  const invoiceId = uuid();
  const dueDate = dayjs(now).add(7, "day").format("YYYY-MM-DD");

  await db.create("invoices", {
    id: invoiceId,
    orgId: subscription.orgId,
    clientId: subscription.clientId,
    invoiceNumber,
    status: InvoiceStatus.SENT,
    issueDate: dayjs(now).format("YYYY-MM-DD"),
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
    id: uuid(),
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
    nextBillingDate: dayjs(newPeriodEnd).format("YYYY-MM-DD"),
    updatedAt: now,
  }, subscription.orgId);

  // Log renewed event
  await logEvent(subscriptionId, subscription.orgId, SubscriptionEventType.RENEWED, {
    metadata: { invoiceId, total },
  });

  emit("subscription.renewed", {
    orgId: subscription.orgId,
    subscriptionId,
    subscription: { id: subscriptionId, planId: subscription.planId },
    planId: subscription.planId,
    clientId: subscription.clientId,
  });

  return { invoiceId, orgId: subscription.orgId, clientId: subscription.clientId };
}

// ── Get Subscription Events ─────────────────────────────────────────────────

export async function getSubscriptionEvents(
  orgId: string,
  subscriptionId: string
): Promise<SubscriptionEvent[]> {
  const db = await getDB();

  // Validate subscription exists
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  const events = await db.findMany<SubscriptionEvent>("subscription_events", {
    where: { subscription_id: subscriptionId, org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return events;
}
