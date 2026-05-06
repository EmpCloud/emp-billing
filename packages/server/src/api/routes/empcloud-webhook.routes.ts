import { Router } from "express";
import { authenticateEmpCloud } from "../middleware/empcloud-auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { logger } from "../../utils/logger";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { BadRequestError } from "../../utils/AppError";
import { emit } from "../../events/index";

const router = Router();

// All routes require EmpCloud API key
router.use(authenticateEmpCloud);

// ── Types ───────────────────────────────────────────────────────────────────

interface EmpCloudEvent {
  event_type: string;
  organization_id: number;
  subscription_id?: number;
  module_slug: string;
  module_name?: string;
  plan_tier: string;
  total_seats: number;
  price_per_seat: number;
  currency?: string;
  billing_cycle: string;
  period_start?: string;
  period_end?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find or create a billing client for the given EmpCloud organization.
 * Uses a convention-based lookup: empcloud org ID mapped to a billing client.
 */
async function findOrCreateClient(
  orgId: string,
  empcloudOrgId: number,
  moduleSlug: string
): Promise<string> {
  const db = await getDB();

  // Look up existing client by empcloud metadata
  const existing = await db.findOne<{ id: string }>("clients", {
    org_id: orgId,
    email: `org-${empcloudOrgId}@empcloud.internal`,
  });

  if (existing) return existing.id;

  // Auto-provision a client record for this EmpCloud organization
  const clientId = uuid();
  const now = new Date();
  await db.create("clients", {
    id: clientId,
    orgId,
    name: `EmpCloud Org #${empcloudOrgId}`,
    displayName: `EmpCloud Organization ${empcloudOrgId}`,
    email: `org-${empcloudOrgId}@empcloud.internal`,
    phone: null,
    taxId: null,
    currency: "INR",
    paymentTerms: 30,
    billingAddress: null,
    shippingAddress: null,
    tags: JSON.stringify(["empcloud", moduleSlug]),
    customFields: JSON.stringify({ empcloud_org_id: empcloudOrgId }),
    outstandingBalance: 0,
    totalBilled: 0,
    totalPaid: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  logger.info(`Auto-provisioned billing client ${clientId} for EmpCloud org ${empcloudOrgId}`);
  return clientId;
}

/**
 * Map EmpCloud billing_cycle string to a billing interval value.
 */
function mapBillingCycle(cycle: string): string {
  switch (cycle) {
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "annual":
    case "yearly":
      return "annual";
    default:
      return "monthly";
  }
}

/**
 * Compute period end from start + billing cycle.
 */
function computePeriodEnd(start: Date, cycle: string): Date {
  const d = dayjs(start);
  switch (cycle) {
    case "quarterly":
      return d.add(3, "month").toDate();
    case "annual":
    case "yearly":
      return d.add(1, "year").toDate();
    default:
      return d.add(1, "month").toDate();
  }
}

// ── Webhook Handler ─────────────────────────────────────────────────────────

router.post("/", asyncHandler(async (req, res) => {
  const body = req.body as EmpCloudEvent;
  const eventType = body.event_type || (req.headers["x-empcloud-event"] as string);

  if (!eventType) {
    throw BadRequestError("Missing event_type in body or X-EmpCloud-Event header");
  }
  if (!body.organization_id) {
    throw BadRequestError("Missing organization_id");
  }
  if (!body.module_slug) {
    throw BadRequestError("Missing module_slug");
  }

  logger.info(`EmpCloud webhook received: ${eventType} for org ${body.organization_id} module ${body.module_slug}`);

  const db = await getDB();

  // Use a default billing org — the first org in the system (billing is single-tenant typically)
  // or we could derive it. For now, find the first active org.
  const defaultOrg = await db.findOne<{ id: string }>("organizations", { is_active: true });
  const orgId = defaultOrg?.id;
  if (!orgId) {
    logger.warn("No active billing organization found — cannot process EmpCloud webhook");
    res.json({ success: true, acknowledged: true, warning: "No billing org configured" });
    return;
  }

  // Find a system user to attribute records to (needed for FK constraints)
  const systemUser = await db.findOne<{ id: string }>("users", { org_id: orgId, role: "owner" });
  const createdBy = systemUser?.id || "system";

  switch (eventType) {
    case "subscription.created": {
      // Find or create client for this EmpCloud org
      const clientId = await findOrCreateClient(orgId, body.organization_id, body.module_slug);

      // Check if subscription already exists (idempotency)
      const existingSub = await db.findOne<{ id: string }>("subscriptions", {
        org_id: orgId,
        client_id: clientId,
        metadata: JSON.stringify({ empcloud_subscription_id: body.subscription_id, module_slug: body.module_slug }),
      });

      if (existingSub) {
        logger.info(`Subscription already exists for EmpCloud sub ${body.subscription_id}, skipping`);
        // Surface the client + plan ids on the idempotent path too so the
        // EmpCloud caller can still persist the mapping if it lost track.
        const existingFull = await db.findById<{ id: string; client_id: string; plan_id: string }>(
          "subscriptions",
          existingSub.id,
        );
        res.json({
          success: true,
          acknowledged: true,
          subscription_id: existingSub.id,
          client_id: existingFull?.client_id ?? clientId,
          plan_id: existingFull?.plan_id ?? null,
        });
        return;
      }

      // Find or create a plan matching this module/tier
      let plan = await db.findOne<{ id: string; billing_interval: string }>("plans", {
        org_id: orgId,
        name: `${body.module_slug}-${body.plan_tier}`,
      });

      if (!plan) {
        // Auto-create a plan
        const planId = uuid();
        const now = new Date();
        await db.create("plans", {
          id: planId,
          orgId,
          name: `${body.module_slug}-${body.plan_tier}`,
          description: `Auto-created plan for ${body.module_name || body.module_slug} (${body.plan_tier})`,
          billingInterval: mapBillingCycle(body.billing_cycle),
          trialPeriodDays: 0,
          price: body.price_per_seat || 0,
          setupFee: 0,
          currency: body.currency || "INR",
          features: JSON.stringify([]),
          isActive: true,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        });
        plan = { id: planId, billing_interval: mapBillingCycle(body.billing_cycle) };
        logger.info(`Auto-created billing plan ${planId} for ${body.module_slug}-${body.plan_tier}`);
      }

      // Create subscription
      const subId = uuid();
      const now = new Date();
      const periodStart = body.period_start ? new Date(body.period_start) : now;
      const periodEnd = body.period_end
        ? new Date(body.period_end)
        : computePeriodEnd(periodStart, body.billing_cycle);

      await db.create("subscriptions", {
        id: subId,
        orgId,
        clientId,
        planId: plan.id,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelledAt: null,
        cancelReason: null,
        pauseStart: null,
        resumeDate: null,
        nextBillingDate: dayjs(periodEnd).format("YYYY-MM-DD"),
        quantity: body.total_seats || 1,
        metadata: JSON.stringify({
          empcloud_subscription_id: body.subscription_id,
          empcloud_org_id: body.organization_id,
          module_slug: body.module_slug,
        }),
        autoRenew: true,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });

      // Generate first invoice
      const invoiceId = uuid();
      const invoiceNumber = await nextInvoiceNumber(orgId);
      const lineTotal = (body.price_per_seat || 0) * (body.total_seats || 1);

      await db.create("invoices", {
        id: invoiceId,
        orgId,
        clientId,
        invoiceNumber,
        status: "draft",
        issueDate: dayjs(now).format("YYYY-MM-DD"),
        dueDate: dayjs(now).add(30, "day").format("YYYY-MM-DD"),
        subtotal: lineTotal,
        discountAmount: 0,
        taxAmount: 0,
        total: lineTotal,
        amountPaid: 0,
        amountDue: lineTotal,
        currency: body.currency || "INR",
        notes: `Auto-generated invoice for ${body.module_name || body.module_slug} subscription (EmpCloud org ${body.organization_id})`,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });

      // Create invoice line item
      await db.create("invoice_items", {
        id: uuid(),
        invoiceId,
        orgId,
        name: `${body.module_name || body.module_slug} — ${body.plan_tier}`,
        description: `${body.total_seats} seats at ${body.price_per_seat} per seat`,
        quantity: body.total_seats || 1,
        rate: body.price_per_seat || 0,
        amount: lineTotal,
        sortOrder: 0,
      });

      logger.info(`Created subscription ${subId} and invoice ${invoiceNumber} for EmpCloud org ${body.organization_id}`);

      emit("subscription.created", {
        orgId,
        subscriptionId: subId,
        subscription: { id: subId, clientId, planId: plan.id, status: "active" },
        planId: plan.id,
        clientId,
      });

      res.json({
        success: true,
        acknowledged: true,
        subscription_id: subId,
        client_id: clientId,
        plan_id: plan.id,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
      });
      return;
    }

    case "subscription.updated": {
      // Find existing subscription by empcloud metadata
      const subs = await db.findMany<{ id: string; metadata: string }>("subscriptions", {
        where: { org_id: orgId },
      });

      const match = subs.find((s) => {
        try {
          const meta = typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata;
          return meta?.empcloud_subscription_id === body.subscription_id;
        } catch {
          return false;
        }
      });

      if (!match) {
        logger.warn(`No matching subscription found for EmpCloud sub ${body.subscription_id}`);
        res.json({ success: true, acknowledged: true, warning: "Subscription not found" });
        return;
      }

      const now = new Date();
      await db.update("subscriptions", match.id, {
        quantity: body.total_seats || 1,
        updatedAt: now,
      }, orgId);

      logger.info(`Updated subscription ${match.id} for EmpCloud org ${body.organization_id}`);

      res.json({ success: true, acknowledged: true, subscription_id: match.id });
      return;
    }

    case "subscription.cancelled": {
      const subs2 = await db.findMany<{ id: string; metadata: string }>("subscriptions", {
        where: { org_id: orgId },
      });

      const match2 = subs2.find((s) => {
        try {
          const meta = typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata;
          return meta?.empcloud_subscription_id === body.subscription_id;
        } catch {
          return false;
        }
      });

      if (!match2) {
        logger.warn(`No matching subscription found for EmpCloud sub ${body.subscription_id}`);
        res.json({ success: true, acknowledged: true, warning: "Subscription not found" });
        return;
      }

      const now = new Date();
      await db.update("subscriptions", match2.id, {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "Cancelled via EmpCloud",
        updatedAt: now,
      }, orgId);

      logger.info(`Cancelled subscription ${match2.id} for EmpCloud org ${body.organization_id}`);

      emit("subscription.cancelled", {
        orgId,
        subscriptionId: match2.id,
        subscription: { id: match2.id, status: "cancelled" },
      });

      res.json({ success: true, acknowledged: true, subscription_id: match2.id });
      return;
    }

    default:
      logger.warn(`Unknown EmpCloud webhook event: ${eventType}`);
      res.json({ success: true, acknowledged: true, warning: `Unknown event type: ${eventType}` });
  }
}));

export { router as empcloudWebhookRoutes };
