import { Router } from "express";
import { authenticateEmpCloud } from "../middleware/empcloud-auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { KnexAdapter } from "../../db/adapters/knex.adapter";
import { logger } from "../../utils/logger";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { BadRequestError } from "../../utils/AppError";
import { emit } from "../../events/index";
import { ensureEmpCloudBillingOrg } from "../../services/auth/empcloud-bootstrap.service";

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
  status?: string;
  period_start?: string;
  period_end?: string;
  trial_end?: string;
  // Real deliverable email for the org owner / admin. Used as the client's
  // `email` (the invoice "to" address). Optional for backwards-compat with
  // older EmpCloud builds — if absent we fall back to the synthetic
  // address, which sends but isn't deliverable.
  admin_email?: string;
  org_name?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find or create a billing client for the given EmpCloud organization.
 *
 * Lookup is by `customFields.empcloud_org_id` — a stable id that never
 * changes for the lifetime of an EmpCloud org. The earlier version looked
 * up by `email = org-{N}@empcloud.internal` which converged the two
 * provisioning paths (BillingPage's auto-provision + this webhook) but
 * meant invoice emails were sent to a domain nobody owns. By keying on
 * the metadata field instead, both paths still converge AND the client's
 * `email` column stays a real deliverable address.
 *
 * Self-heal: when an inbound webhook carries a different `admin_email`
 * than the stored value (e.g. the org changed owners, or the older
 * synthetic email is still on file from before this fix), update the
 * client to the new address so future invoice emails land in the right
 * mailbox without manual SQL.
 */
async function findOrCreateClient(
  orgId: string,
  empcloudOrgId: number,
  moduleSlug: string,
  adminEmail: string | undefined,
  orgName: string | undefined,
): Promise<string> {
  const db = await getDB();
  const knex = (db as KnexAdapter).getKnex();

  // Look up by stable empcloud_org_id stored in custom_fields JSON.
  const existing = await knex("clients")
    .where({ org_id: orgId })
    .whereRaw("JSON_EXTRACT(custom_fields, '$.empcloud_org_id') = ?", [empcloudOrgId])
    .first();

  if (existing) {
    // Self-heal: if the caller now sends a real email and the stored one
    // is either the legacy synthetic address or simply different, update
    // to the latest. Skip the UPDATE if nothing changed to keep the
    // query log clean.
    if (adminEmail && existing.email !== adminEmail) {
      await knex("clients")
        .where({ id: existing.id })
        .update({ email: adminEmail, updated_at: new Date() });
      logger.info(
        `Self-healed billing client ${existing.id} email: ${existing.email} → ${adminEmail}`,
      );
    }
    return existing.id;
  }

  // First-time provisioning for this EmpCloud org.
  const clientId = uuid();
  const now = new Date();
  // Fall back to the synthetic address only when the caller didn't send
  // a real one. New EmpCloud builds always do.
  const email = adminEmail || `org-${empcloudOrgId}@empcloud.internal`;
  const name = orgName || `EmpCloud Org #${empcloudOrgId}`;

  await db.create("clients", {
    id: clientId,
    orgId,
    name,
    displayName: name,
    email,
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

  logger.info(`Auto-provisioned billing client ${clientId} for EmpCloud org ${empcloudOrgId} (email=${email})`);
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

  const bootstrap = await ensureEmpCloudBillingOrg();
  const orgId = bootstrap.orgId;
  const createdBy = bootstrap.userId;

  switch (eventType) {
    case "subscription.created": {
      // Find or create client for this EmpCloud org
      const clientId = await findOrCreateClient(
        orgId,
        body.organization_id,
        body.module_slug,
        body.admin_email,
        body.org_name,
      );

      // Idempotency check. Two concurrent webhooks for the same EmpCloud
      // subscription must converge on a single billing subscription/invoice,
      // otherwise the user sees duplicate invoices for one purchase
      // (which surfaced on prod for orgs 18 and 19 as INV-…80 + INV-…81
      // off a single subscribe click).
      //
      // The original `db.findOne` lookup did a literal-string compare on
      // the metadata column with a JSON string built from a SUBSET of the
      // keys we actually insert: insert has
      //   { empcloud_subscription_id, empcloud_org_id, module_slug }
      // lookup tried with
      //   { empcloud_subscription_id, module_slug }
      // The two strings never matched, so the dedupe was a no-op. Switch
      // to JSON_EXTRACT against the empcloud_subscription_id key — that's
      // the only field that needs to be unique per webhook, and indexing
      // it via a generated-column index later is straightforward.
      const knex = (db as KnexAdapter).getKnex();
      const existingSubRow = await knex("subscriptions")
        .where({ org_id: orgId, client_id: clientId })
        .whereRaw("JSON_EXTRACT(metadata, '$.empcloud_subscription_id') = ?", [
          body.subscription_id,
        ])
        .first();
      const existingSub = existingSubRow ? { id: existingSubRow.id as string } : null;

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

      const trialEndDate = body.trial_end ? new Date(body.trial_end) : null;
      const isTrial = body.status === "trial" || (trialEndDate !== null && trialEndDate > now);

      await db.create("subscriptions", {
        id: subId,
        orgId,
        clientId,
        planId: plan.id,
        status: isTrial ? "trialing" : "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialStart: isTrial ? periodStart : null,
        trialEnd: isTrial ? trialEndDate : null,
        cancelledAt: null,
        cancelReason: null,
        pauseStart: null,
        resumeDate: null,
        nextBillingDate: dayjs(isTrial && trialEndDate ? trialEndDate : periodEnd).format("YYYY-MM-DD"),
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

      let invoiceId: string | null = null;
      let invoiceNumber: string | null = null;
      let lineTotal = 0;

      if (!isTrial) {
        // Generate first invoice immediately for paid subscriptions.
        // Trials defer invoice creation until the renewal worker fires on
        // trialEnd — this is the standard SaaS flow (free trial, then bill).
        invoiceId = uuid();
        invoiceNumber = await nextInvoiceNumber(orgId);
        lineTotal = (body.price_per_seat || 0) * (body.total_seats || 1);

        await db.create("invoices", {
          id: invoiceId,
          orgId,
          clientId,
          invoiceNumber,
          status: "sent",
          issueDate: dayjs(now).format("YYYY-MM-DD"),
          dueDate: dayjs(now).format("YYYY-MM-DD"),
          subtotal: lineTotal,
          discountAmount: 0,
          taxAmount: 0,
          total: lineTotal,
          amountPaid: 0,
          amountDue: lineTotal,
          currency: body.currency || "INR",
          notes: `Prepaid first-period invoice for ${body.module_name || body.module_slug} (EmpCloud org ${body.organization_id})`,
          createdBy,
          createdAt: now,
          updatedAt: now,
          sentAt: now,
        });

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
      } else {
        logger.info(`Created trial subscription ${subId} for EmpCloud org ${body.organization_id}, trialEnd=${trialEndDate?.toISOString()}`);
      }

      if (invoiceId) {
        const invoiceClient = await db.findById<{ email: string; portalEmail?: string }>(
          "clients",
          clientId,
          orgId,
        );

        emit("invoice.created", {
          orgId,
          invoiceId,
          invoice: {
            id: invoiceId,
            clientId,
            clientEmail: invoiceClient?.portalEmail ?? invoiceClient?.email,
            invoiceNumber,
            total: lineTotal,
            currency: body.currency || "INR",
            source: "subscription-created",
          } as unknown as Record<string, unknown>,
        });
      }

      emit("subscription.created", {
        orgId,
        subscriptionId: subId,
        subscription: { id: subId, clientId, planId: plan.id, status: isTrial ? "trialing" : "active" },
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
      const subs = await db.findMany<{ id: string; status: string; plan_id: string; client_id: string; metadata: string }>("subscriptions", {
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
      const trialEndDate = body.trial_end ? new Date(body.trial_end) : null;
      const isTrial = body.status === "trial" || (trialEndDate !== null && trialEndDate > now);
      const periodStartUpdate = body.period_start ? new Date(body.period_start) : undefined;
      const periodEndUpdate = body.period_end ? new Date(body.period_end) : undefined;

      const updatePayload: Record<string, unknown> = {
        quantity: body.total_seats || 1,
        updatedAt: now,
      };

      if (body.status) {
        updatePayload.status = isTrial ? "trialing" : "active";
        updatePayload.trialEnd = isTrial ? trialEndDate : null;
        updatePayload.trialStart = isTrial ? (periodStartUpdate ?? now) : null;
      }

      if (periodStartUpdate) {
        updatePayload.currentPeriodStart = periodStartUpdate;
      }
      if (periodEndUpdate) {
        updatePayload.currentPeriodEnd = periodEndUpdate;
        updatePayload.nextBillingDate = dayjs(
          isTrial && trialEndDate ? trialEndDate : periodEndUpdate,
        ).format("YYYY-MM-DD");
      }

      await db.update("subscriptions", match.id, updatePayload, orgId);

      logger.info(`Updated subscription ${match.id} for EmpCloud org ${body.organization_id}`, {
        status: updatePayload.status,
        quantity: updatePayload.quantity,
      });

      // PREPAID first-period invoice on trialing → active transition.
      // Fires for BOTH natural day-14 expiry AND early upgrade — the
      // customer is starting their first paid period, so we bill upfront
      // for [period_start, period_end] at the current rate. Trial days
      // before this point stay free (the trial was the trial). due_date
      // matches issue_date so payment is expected on day of issue.
      const transitioningToActive = match.status === "trialing" && !isTrial && periodStartUpdate && periodEndUpdate;
      if (transitioningToActive) {
        const lineTotal = (body.price_per_seat || 0) * (body.total_seats || 1);

        if (lineTotal > 0) {
          const invoiceId = uuid();
          const invoiceNumber = await nextInvoiceNumber(orgId);

          await db.create("invoices", {
            id: invoiceId,
            orgId,
            clientId: match.client_id,
            invoiceNumber,
            status: "sent",
            issueDate: dayjs(now).format("YYYY-MM-DD"),
            dueDate: dayjs(now).format("YYYY-MM-DD"),
            subtotal: lineTotal,
            discountAmount: 0,
            taxAmount: 0,
            total: lineTotal,
            amountPaid: 0,
            amountDue: lineTotal,
            currency: body.currency || "INR",
            notes: `First billing period for ${body.module_name || body.module_slug} after trial — ${body.total_seats} seats × ${body.price_per_seat}`,
            createdBy: match.client_id,
            createdAt: now,
            updatedAt: now,
            sentAt: now,
          });

          await db.create("invoice_items", {
            id: uuid(),
            invoiceId,
            orgId,
            name: `${body.module_name || body.module_slug} — ${body.plan_tier}`,
            description: `${body.total_seats} seats × ${body.price_per_seat} (prepaid: ${dayjs(periodStartUpdate).format("DD MMM YYYY")} → ${dayjs(periodEndUpdate).format("DD MMM YYYY")})`,
            quantity: body.total_seats || 1,
            rate: body.price_per_seat || 0,
            amount: lineTotal,
            sortOrder: 0,
          });

          const invoiceClient = await db.findById<{ email: string; portalEmail?: string }>(
            "clients",
            match.client_id,
            orgId,
          );

          emit("invoice.created", {
            orgId,
            invoiceId,
            invoice: {
              id: invoiceId,
              clientId: match.client_id,
              clientEmail: invoiceClient?.portalEmail ?? invoiceClient?.email,
              invoiceNumber,
              total: lineTotal,
              currency: body.currency || "INR",
              source: "trial-converted-to-active",
            } as unknown as Record<string, unknown>,
          });

          logger.info(`Prepaid first-period invoice ${invoiceNumber} generated for subscription ${match.id} on trialing→active transition`, {
            total: lineTotal,
            periodStart: dayjs(periodStartUpdate).format("YYYY-MM-DD"),
            periodEnd: dayjs(periodEndUpdate).format("YYYY-MM-DD"),
          });
        }
      }

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
