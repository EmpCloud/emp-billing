import { Router } from "express";
import { authenticateEmpCloud } from "../middleware/empcloud-auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { createHash } from "crypto";
import { getDB } from "../../db/adapters/index";
import { KnexAdapter } from "../../db/adapters/knex.adapter";
import { logger } from "../../utils/logger";
import { nextInvoiceNumber } from "../../utils/number-generator";
import { BadRequestError } from "../../utils/AppError";

// Deterministic idempotency key for proration documents. Built from the
// exact "change" being prorated: which subscription, which billing period,
// and the before/after pricing state. Two webhook deliveries of the same
// `subscription.updated` produce the same key; the second one fails the
// unique-index INSERT and gets caught + logged as a benign duplicate.
function prorationKey(
  kind: "mid-cycle" | "cancel",
  parts: {
    subscription_id: string;
    period_start: string;
    old_price: number;
    new_price: number;
    old_qty: number;
    new_qty: number;
  },
): string {
  const fingerprint = [
    kind,
    parts.subscription_id,
    parts.period_start,
    parts.old_price,
    parts.new_price,
    parts.old_qty,
    parts.new_qty,
  ].join("|");
  return createHash("sha256").update(fingerprint).digest("hex");
}
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
  // EmpCloud's `price_per_seat` semantics changed from "monthly base" to
  // "effective per-cycle agreed price" -- the number the customer actually
  // saw on the Subscribe modal. To keep older payloads working,
  // `effective_price_per_seat` is the canonical field for the new shape.
  // Use it when present; fall back to price_per_seat otherwise.
  effective_price_per_seat?: number;
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

  try {
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
  } catch (err: any) {
    // Race-safe: a concurrent webhook for the same EmpCloud org may have
    // created the client first. The uq_clients_empcloud_org unique index
    // (migration 019) makes the loser's INSERT fail with ER_DUP_ENTRY —
    // converge on the winner's row instead of leaving an orphan client
    // (the orphan client was what defeated the subscription dedupe before).
    if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) {
      const winner = await knex("clients")
        .where({ org_id: orgId })
        .whereRaw("JSON_EXTRACT(custom_fields, '$.empcloud_org_id') = ?", [empcloudOrgId])
        .first();
      if (winner) {
        if (adminEmail && winner.email !== adminEmail) {
          await knex("clients")
            .where({ id: winner.id })
            .update({ email: adminEmail, updated_at: new Date() });
        }
        logger.info(`findOrCreateClient: lost create race for EmpCloud org ${empcloudOrgId}, using existing client ${winner.id}`);
        return winner.id as string;
      }
    }
    throw err;
  }

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
      // Match on org_id + empcloud_subscription_id only — NOT client_id.
      // findOrCreateClient is now race-safe, but historically a racing
      // webhook could create a second client; scoping the dedupe by
      // client_id meant each webhook only saw subscriptions under its own
      // client, so the check never matched and both created an invoice.
      // empcloud_subscription_id is unique per EmpCloud subscription, which
      // is all this dedupe needs.
      const existingSubRow = await knex("subscriptions")
        .where({ org_id: orgId })
        .whereRaw("JSON_EXTRACT(metadata, '$.empcloud_subscription_id') = ?", [
          body.subscription_id,
        ])
        .first();
      const existingSub = existingSubRow ? { id: existingSubRow.id as string } : null;

      if (existingSub) {
        // The subscription row already exists -- but the FIRST-PERIOD
        // invoice might NOT, in two real scenarios we've seen:
        //   1. The original invoice was manually deleted by an operator,
        //      and the customer re-clicks Subscribe to get a fresh bill.
        //   2. The first webhook to create this sub raced with a second
        //      webhook that finished the sub-create but failed
        //      mid-invoice-create, then was never retried.
        // Re-issue the missing invoice (only if not currently on trial)
        // so the customer's "Subscribe" action visibly produces a bill.
        // Sub creation is idempotent -- no double subscription.
        const existingFull = await db.findById<{
          id: string;
          clientId: string;
          planId: string;
          status: string;
          quantity: number;
        }>("subscriptions", existingSub.id);

        const now = new Date();
        const trialEndDateIdem = body.trial_end ? new Date(body.trial_end) : null;
        const isTrialIdem =
          body.status === "trial" ||
          (trialEndDateIdem !== null && trialEndDateIdem > now);

        // Has THIS subscription's plan already produced a first-period
        // invoice for the period EmpCloud just sent? If yes we're truly
        // idempotent; otherwise re-issue.
        const periodStartIdemIso = body.period_start
          ? dayjs(body.period_start).format("YYYY-MM-DD")
          : null;
        const existingInvoice =
          existingFull?.planId && periodStartIdemIso
            ? await knex("invoices")
                .where({
                  org_id: orgId,
                  client_id: existingFull.clientId,
                  issue_date: periodStartIdemIso,
                })
                .whereRaw("notes LIKE ?", [`%${body.module_slug}%`])
                .first()
            : await knex("invoices")
                .where({
                  org_id: orgId,
                  client_id: existingFull?.clientId ?? clientId,
                })
                .whereRaw("notes LIKE ?", [`%${body.module_slug}%`])
                .first();

        let reissuedInvoiceId: string | null = null;
        let reissuedInvoiceNumber: string | null = null;
        if (
          !existingInvoice &&
          !isTrialIdem &&
          existingFull &&
          existingFull.status !== "cancelled"
        ) {
          const ratePerSeatIdem =
            (body.effective_price_per_seat ?? body.price_per_seat) || 0;
          const qtyIdem = body.total_seats || existingFull.quantity || 1;
          const lineTotalIdem = ratePerSeatIdem * qtyIdem;
          if (lineTotalIdem > 0) {
            reissuedInvoiceId = uuid();
            reissuedInvoiceNumber = await nextInvoiceNumber(orgId);
            await db.create("invoices", {
              id: reissuedInvoiceId,
              orgId,
              clientId: existingFull.clientId,
              invoiceNumber: reissuedInvoiceNumber,
              status: "sent",
              issueDate: dayjs(now).format("YYYY-MM-DD"),
              dueDate: dayjs(now).format("YYYY-MM-DD"),
              subtotal: lineTotalIdem,
              discountAmount: 0,
              taxAmount: 0,
              total: lineTotalIdem,
              amountPaid: 0,
              amountDue: lineTotalIdem,
              currency: body.currency || "INR",
              notes: `Prepaid period invoice (reissued) for ${body.module_name || body.module_slug} (EmpCloud org ${body.organization_id})`,
              createdBy: existingFull.clientId,
              createdAt: now,
              updatedAt: now,
              sentAt: now,
            });
            await db.create("invoice_items", {
              id: uuid(),
              invoiceId: reissuedInvoiceId,
              orgId,
              name: `${body.module_name || body.module_slug} — ${body.plan_tier}`,
              description: `${qtyIdem} seats at ${ratePerSeatIdem} per seat`,
              quantity: qtyIdem,
              rate: ratePerSeatIdem,
              amount: lineTotalIdem,
              sortOrder: 0,
            });
            logger.info(
              `Re-issued first-period invoice ${reissuedInvoiceNumber} for existing sub ${existingSub.id} (original was missing)`,
            );
          }
        } else {
          logger.info(
            `Subscription already exists for EmpCloud sub ${body.subscription_id} with valid invoice; skipping`,
          );
        }

        res.json({
          success: true,
          acknowledged: true,
          subscription_id: existingSub.id,
          client_id: existingFull?.clientId ?? clientId,
          plan_id: existingFull?.planId ?? null,
          invoice_id: reissuedInvoiceId,
          invoice_number: reissuedInvoiceNumber,
        });
        return;
      }

      // Find or create a plan matching this module/tier
      let plan = await db.findOne<{ id: string; billing_interval: string }>("plans", {
        org_id: orgId,
        name: `${body.module_slug}-${body.plan_tier}`,
      });

      if (!plan) {
        // Auto-create a plan. Price is the effective per-seat per-cycle
        // amount the customer agreed to on the Subscribe modal -- prefer
        // the new `effective_price_per_seat` field, fall back to
        // `price_per_seat` for older EmpCloud builds whose
        // price_per_seat was the monthly base only.
        const planId = uuid();
        const now = new Date();
        const effectivePrice =
          (body.effective_price_per_seat ?? body.price_per_seat) || 0;
        await db.create("plans", {
          id: planId,
          orgId,
          name: `${body.module_slug}-${body.plan_tier}`,
          description: `Auto-created plan for ${body.module_name || body.module_slug} (${body.plan_tier})`,
          billingInterval: mapBillingCycle(body.billing_cycle),
          trialPeriodDays: 0,
          price: effectivePrice,
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

      try {
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
      } catch (err: any) {
        // Final race guard: two webhooks for the same EmpCloud subscription
        // can both clear the idempotency check above before either commits.
        // The uq_subscriptions_empcloud_sub unique index (migration 019)
        // lets the DB pick a winner; the loser hits ER_DUP_ENTRY here. Treat
        // it as an idempotent hit — converge on the winner's row and return
        // WITHOUT creating a (duplicate) invoice.
        if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) {
          const winnerRow = await knex("subscriptions")
            .where({ org_id: orgId })
            .whereRaw("JSON_EXTRACT(metadata, '$.empcloud_subscription_id') = ?", [body.subscription_id])
            .first();
          if (winnerRow) {
            logger.info(`Lost subscription-create race for EmpCloud sub ${body.subscription_id}, using ${winnerRow.id}`);
            res.json({
              success: true,
              acknowledged: true,
              subscription_id: winnerRow.id as string,
              client_id: (winnerRow.client_id as string) ?? clientId,
              plan_id: (winnerRow.plan_id as string) ?? plan.id,
            });
            return;
          }
        }
        throw err;
      }

      let invoiceId: string | null = null;
      let invoiceNumber: string | null = null;
      let lineTotal = 0;

      if (!isTrial) {
        // Generate first invoice immediately for paid subscriptions.
        // Trials defer invoice creation until the renewal worker fires on
        // trialEnd — this is the standard SaaS flow (free trial, then bill).
        invoiceId = uuid();
        invoiceNumber = await nextInvoiceNumber(orgId);
        // Use the effective per-seat per-cycle price agreed on the modal,
        // not the monthly base. Fallback keeps old EmpCloud builds working.
        const ratePerSeat =
          (body.effective_price_per_seat ?? body.price_per_seat) || 0;
        lineTotal = ratePerSeat * (body.total_seats || 1);

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
          description: `${body.total_seats} seats at ${ratePerSeat} per seat`,
          quantity: body.total_seats || 1,
          rate: ratePerSeat,
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
      const subs = await db.findMany<{ id: string; status: string; planId: string; clientId: string; metadata: string; quantity: number; currentPeriodStart: string | Date | null; currentPeriodEnd: string | Date | null }>("subscriptions", {
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

      // Capture BEFORE-state for proration. The cycle cost the customer
      // already paid (or is on the hook for) is priorPlanPrice ×
      // priorQty; after this update it'll become newPlanPrice × nextQty.
      // The adjustment is the per-day delta × days remaining in the
      // cycle. Names are deliberately distinct from the existing
      // oldQty/newQty further down so the two blocks don't collide.
      const priorQty = Number(match.quantity || 1);
      const priorPlanRow = match.planId
        ? await db.findById<{ price: number; currency?: string }>(
            "plans",
            match.planId,
          )
        : null;
      const priorPlanPrice = priorPlanRow ? Number(priorPlanRow.price) : 0;
      const wasOnTrial = match.status === "trialing";

      await db.update("subscriptions", match.id, updatePayload, orgId);

      // Sync the linked plan's price from the latest effective per-seat
      // per-cycle amount EmpCloud just sent. Before this, updating an
      // existing subscription (tier change, cycle change, seat band cross,
      // free/comp toggle) changed the customer-promised price on
      // EmpCloud's side but left the plan in emp-billing pinned at the
      // creation-time price -- so the NEXT renewal invoice would charge
      // the old rate.
      //
      // Sync ONLY when the payload actually carries a price field. A
      // missing field means "no price info in this event" (e.g. a status-
      // only update). An EXPLICIT zero means "this is now comped" -- we
      // must sync the zero so the renewal generates a ₹0 invoice (or none
      // at all). The previous `> 0` guard would have silently kept the old
      // non-zero price after a Mark-Free.
      const sentPriceField =
        body.effective_price_per_seat ?? body.price_per_seat;
      let newPlanPrice = priorPlanPrice;
      if (sentPriceField !== undefined && sentPriceField !== null && match.planId) {
        const candidateRate = Number(sentPriceField);
        if (Number.isFinite(candidateRate) && candidateRate >= 0) {
          await db.update(
            "plans",
            match.planId,
            { price: candidateRate, updatedAt: now },
            orgId,
          );
          newPlanPrice = candidateRate;
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // MID-CYCLE PRORATION
      //
      // When the cycle cost changes (tier, cycle length, seat band, comp
      // toggle, or seat count) and the customer is mid-cycle, charge or
      // credit the day-weighted difference for the remainder of the cycle.
      //
      // proration_amount = (newCycleCost - oldCycleCost) × daysRemaining / totalDays
      //
      // Skip when:
      //   - was on trial (no money has changed hands yet; the upcoming
      //     first-period invoice already uses the new price)
      //   - status is becoming cancelled (cancellation events handle their
      //     own credit/refund flow)
      //   - period dates are missing or in the past (can't compute days)
      //   - adjustment is tiny (< 1 unit of currency = 100 paise/cents)
      //     to avoid rounding-noise invoices
      // ──────────────────────────────────────────────────────────────────
      const nextQty = Number(updatePayload.quantity || priorQty);
      const transitioningToCancelled =
        body.status === "cancelled" && !isTrial;
      const periodStartIso = match.currentPeriodStart;
      const periodEndIso = match.currentPeriodEnd;
      const periodStart = periodStartIso ? new Date(periodStartIso) : null;
      const periodEnd = periodEndIso ? new Date(periodEndIso) : null;
      const totalDays = periodStart && periodEnd
        ? Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000))
        : 0;
      const daysRemaining = periodEnd
        ? Math.max(0, Math.round((periodEnd.getTime() - now.getTime()) / 86400000))
        : 0;
      const oldCycleCost = priorPlanPrice * priorQty;
      const newCycleCost = newPlanPrice * nextQty;
      const rawAdjustment =
        totalDays > 0 && daysRemaining > 0
          ? Math.round(((newCycleCost - oldCycleCost) * daysRemaining) / totalDays)
          : 0;

      const eligibleForProration =
        !wasOnTrial &&
        !isTrial &&
        !transitioningToCancelled &&
        Math.abs(rawAdjustment) >= 100; // < ₹1 / $1 worth → ignore as noise

      // Compute idempotency key once for both branches.
      const prorationIdemKey = eligibleForProration
        ? prorationKey("mid-cycle", {
            subscription_id: match.id,
            period_start: periodStart ? dayjs(periodStart).format("YYYY-MM-DD") : "",
            old_price: priorPlanPrice,
            new_price: newPlanPrice,
            old_qty: priorQty,
            new_qty: nextQty,
          })
        : null;

      if (eligibleForProration && rawAdjustment > 0) {
        // Upgrade / seat increase / cycle shorten → customer owes more.
        // Issue a one-time prepaid invoice for the remainder of the cycle.
        const invoiceId = uuid();
        const invoiceNumber = await nextInvoiceNumber(orgId);
        try {
          await db.create("invoices", {
            id: invoiceId,
            orgId,
            clientId: match.clientId,
            invoiceNumber,
            status: "sent",
            issueDate: dayjs(now).format("YYYY-MM-DD"),
            dueDate: dayjs(now).format("YYYY-MM-DD"),
            subtotal: rawAdjustment,
            discountAmount: 0,
            taxAmount: 0,
            total: rawAdjustment,
            amountPaid: 0,
            amountDue: rawAdjustment,
            currency: body.currency || "INR",
            notes: `Mid-cycle proration for ${body.module_name || body.module_slug} — ${daysRemaining} of ${totalDays} days remaining at new rate`,
            createdBy: match.clientId,
            createdAt: now,
            updatedAt: now,
            sentAt: now,
            empcloudIdempotencyKey: prorationIdemKey,
          });
          await db.create("invoice_items", {
            id: uuid(),
            invoiceId,
            orgId,
            name: `Proration — ${body.module_name || body.module_slug} (${body.plan_tier})`,
            description: `Day-weighted difference: ${nextQty} seats × ${newPlanPrice} (new) vs ${priorQty} × ${priorPlanPrice} (old), prorated over ${daysRemaining}/${totalDays} days`,
            quantity: 1,
            rate: rawAdjustment,
            amount: rawAdjustment,
            sortOrder: 0,
          });
          logger.info(
            `Issued proration invoice ${invoiceNumber} for sub ${match.id}: +${rawAdjustment} (${daysRemaining}/${totalDays} days)`,
          );
        } catch (err) {
          // ER_DUP_ENTRY from the unique idempotency-key index → benign
          // duplicate webhook delivery, the original proration is already
          // in the DB. Swallow + log; everything else rethrows.
          if ((err as any)?.code === "ER_DUP_ENTRY" || (err as any)?.errno === 1062) {
            logger.info(
              `Duplicate proration webhook for sub ${match.id} (key ${prorationIdemKey?.slice(0, 12)}…) — original already exists`,
            );
          } else {
            throw err;
          }
        }
      } else if (eligibleForProration && rawAdjustment < 0) {
        // Downgrade / seat decrease / comp → customer owes less.
        // Issue a credit note for the unused portion. The credit applies
        // to future invoices (refund handled separately if requested).
        const creditNoteId = uuid();
        const creditAmount = Math.abs(rawAdjustment);
        const creditNumber = `CN-${dayjs(now).format("YYYYMMDD")}-${creditNoteId.slice(0, 6)}`;
        try {
          await db.create("credit_notes", {
            id: creditNoteId,
            orgId,
            clientId: match.clientId,
            creditNoteNumber: creditNumber,
            status: "open",
            date: dayjs(now).format("YYYY-MM-DD"),
            subtotal: creditAmount,
            taxAmount: 0,
            total: creditAmount,
            balance: creditAmount,
            reason: `Mid-cycle proration credit for ${body.module_name || body.module_slug} — ${daysRemaining} of ${totalDays} days remaining at lower rate`,
            createdBy: match.clientId,
            createdAt: now,
            updatedAt: now,
            empcloudIdempotencyKey: prorationIdemKey,
          });
          await db.create("credit_note_items", {
            id: uuid(),
            creditNoteId,
            orgId,
            name: `Proration credit — ${body.module_name || body.module_slug} (${body.plan_tier})`,
            description: `Day-weighted difference: ${nextQty} seats × ${newPlanPrice} (new) vs ${priorQty} × ${priorPlanPrice} (old), prorated over ${daysRemaining}/${totalDays} days`,
            quantity: 1,
            rate: creditAmount,
            discountAmount: 0,
            taxRate: 0,
            taxAmount: 0,
            amount: creditAmount,
            sortOrder: 0,
          });
          logger.info(
            `Issued proration credit note ${creditNumber} for sub ${match.id}: -${creditAmount} (${daysRemaining}/${totalDays} days)`,
          );
        } catch (err) {
          if ((err as any)?.code === "ER_DUP_ENTRY" || (err as any)?.errno === 1062) {
            logger.info(
              `Duplicate proration webhook for sub ${match.id} (key ${prorationIdemKey?.slice(0, 12)}…) — original credit already exists`,
            );
          } else {
            throw err;
          }
        }
      }

      logger.info(`Updated subscription ${match.id} for EmpCloud org ${body.organization_id}`, {
        status: updatePayload.status,
        quantity: updatePayload.quantity,
        plan_price: newPlanPrice,
      });

      // PREPAID first-period invoice on trialing → active transition.
      // Fires for BOTH natural day-14 expiry AND early upgrade — the
      // customer is starting their first paid period, so we bill upfront
      // for [period_start, period_end] at the current rate. Trial days
      // before this point stay free (the trial was the trial). due_date
      // matches issue_date so payment is expected on day of issue.
      const transitioningToActive = match.status === "trialing" && !isTrial && periodStartUpdate && periodEndUpdate;
      if (transitioningToActive) {
        // Same effective-price preference here so the post-trial first
        // invoice matches what the modal promised.
        const ratePerSeat =
          (body.effective_price_per_seat ?? body.price_per_seat) || 0;
        const lineTotal = ratePerSeat * (body.total_seats || 1);

        if (lineTotal > 0) {
          const invoiceId = uuid();
          const invoiceNumber = await nextInvoiceNumber(orgId);

          await db.create("invoices", {
            id: invoiceId,
            orgId,
            clientId: match.clientId,
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
            notes: `First billing period for ${body.module_name || body.module_slug} after trial — ${body.total_seats} seats × ${ratePerSeat}`,
            createdBy: match.clientId,
            createdAt: now,
            updatedAt: now,
            sentAt: now,
          });

          await db.create("invoice_items", {
            id: uuid(),
            invoiceId,
            orgId,
            name: `${body.module_name || body.module_slug} — ${body.plan_tier}`,
            description: `${body.total_seats} seats × ${ratePerSeat} (prepaid: ${dayjs(periodStartUpdate).format("DD MMM YYYY")} → ${dayjs(periodEndUpdate).format("DD MMM YYYY")})`,
            quantity: body.total_seats || 1,
            rate: ratePerSeat,
            amount: lineTotal,
            sortOrder: 0,
          });

          const invoiceClient = await db.findById<{ email: string; portalEmail?: string }>(
            "clients",
            match.clientId,
            orgId,
          );

          emit("invoice.created", {
            orgId,
            invoiceId,
            invoice: {
              id: invoiceId,
              clientId: match.clientId,
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

      // ── Seat-change billing on an already-active subscription ────────────
      // A seat change on a sub that was already active (NOT the trial→active
      // path above) reconciles the current invoice:
      //   * current invoice still UNPAID → amend it in place to the new count
      //   * current invoice already PAID → issue a NEW invoice for just the
      //     added seats (the delta)
      // A downgrade only amends an unpaid invoice; a paid invoice is left
      // alone (no auto-credit / no mid-period refund).
      // Invoices aren't FK-linked to subscriptions, so the current invoice is
      // matched on client + the module label carried in the invoice notes.
      const oldQty = Number(match.quantity) || 1;
      const newQty = body.total_seats || 1;
      if (match.status === "active" && !transitioningToActive && !isTrial && newQty !== oldQty) {
        const knex = (db as KnexAdapter).getKnex();
        const pricePerSeat = body.price_per_seat || 0;
        const moduleLabel = body.module_name || body.module_slug;

        const currentInvoice = await knex("invoices")
          .where({ org_id: orgId, client_id: match.clientId })
          .whereNotIn("status", ["void", "written_off"])
          .where("notes", "like", `%${moduleLabel}%`)
          .orderBy("created_at", "desc")
          .first();

        const isUnpaid =
          currentInvoice &&
          Number(currentInvoice.amount_paid) === 0 &&
          currentInvoice.status !== "paid";

        if (currentInvoice && isUnpaid) {
          // UNPAID → amend the invoice + its line item to the new seat count.
          const fullTotal = newQty * pricePerSeat;
          await knex("invoices").where({ id: currentInvoice.id }).update({
            subtotal: fullTotal,
            total: fullTotal,
            amount_due: fullTotal,
            notes: `${moduleLabel} (EmpCloud org ${body.organization_id}) — ${newQty} seats x ${pricePerSeat} (updated from ${oldQty})`,
            updated_at: now,
          });
          await knex("invoice_items")
            .where({ invoice_id: currentInvoice.id })
            .update({ quantity: newQty, rate: pricePerSeat, amount: fullTotal });
          logger.info(
            `Amended unpaid invoice ${currentInvoice.invoice_number} for subscription ${match.id}: ${oldQty} to ${newQty} seats`,
          );
        } else if (newQty > oldQty) {
          // PAID (or no open invoice) AND seats went up → bill the delta only.
          const deltaQty = newQty - oldQty;
          const deltaTotal = deltaQty * pricePerSeat;
          if (deltaTotal > 0) {
            const upgradeInvoiceId = uuid();
            const upgradeInvoiceNumber = await nextInvoiceNumber(orgId);
            await db.create("invoices", {
              id: upgradeInvoiceId,
              orgId,
              clientId: match.clientId,
              invoiceNumber: upgradeInvoiceNumber,
              status: "sent",
              issueDate: dayjs(now).format("YYYY-MM-DD"),
              dueDate: dayjs(now).format("YYYY-MM-DD"),
              subtotal: deltaTotal,
              discountAmount: 0,
              taxAmount: 0,
              total: deltaTotal,
              amountPaid: 0,
              amountDue: deltaTotal,
              currency: body.currency || "INR",
              notes: `Seat upgrade for ${moduleLabel} (EmpCloud org ${body.organization_id}) — ${deltaQty} additional seats`,
              createdBy,
              createdAt: now,
              updatedAt: now,
              sentAt: now,
            });
            await db.create("invoice_items", {
              id: uuid(),
              invoiceId: upgradeInvoiceId,
              orgId,
              name: `${moduleLabel} — ${body.plan_tier} (seat upgrade)`,
              description: `${deltaQty} additional seats x ${pricePerSeat} (${oldQty} to ${newQty})`,
              quantity: deltaQty,
              rate: pricePerSeat,
              amount: deltaTotal,
              sortOrder: 0,
            });
            const upgradeClient = await db.findById<{ email: string; portalEmail?: string }>(
              "clients",
              match.clientId,
              orgId,
            );
            emit("invoice.created", {
              orgId,
              invoiceId: upgradeInvoiceId,
              invoice: {
                id: upgradeInvoiceId,
                clientId: match.clientId,
                clientEmail: upgradeClient?.portalEmail ?? upgradeClient?.email,
                invoiceNumber: upgradeInvoiceNumber,
                total: deltaTotal,
                currency: body.currency || "INR",
                source: "seat-upgrade",
              } as unknown as Record<string, unknown>,
            });
            logger.info(
              `Seat-upgrade invoice ${upgradeInvoiceNumber} generated for subscription ${match.id}: +${deltaQty} seats x ${pricePerSeat}`,
            );
          }
        } else {
          // Downgrade with a paid/absent open invoice — no auto-credit.
          logger.info(
            `Subscription ${match.id} downgraded ${oldQty} to ${newQty} seats; open invoice paid/absent, no credit issued`,
          );
        }
      }

      res.json({ success: true, acknowledged: true, subscription_id: match.id });
      return;
    }

    case "subscription.cancelled": {
      const subs2 = await db.findMany<{ id: string; metadata: string; quantity: number; planId: string; clientId: string; status: string; currentPeriodStart: string | Date | null; currentPeriodEnd: string | Date | null }>("subscriptions", {
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

      // Capture BEFORE-cancel state for a refund-on-cancel proration.
      // The customer prepaid for the full cycle when this subscription
      // went active; cancelling mid-cycle means we owe them a credit for
      // the unused remainder of the period.
      const cancelPriorQty = Number(match2.quantity || 1);
      const cancelPlanId = match2.planId;
      const cancelPlanRow = cancelPlanId
        ? await db.findById<{ price: number; currency?: string }>(
            "plans",
            cancelPlanId,
          )
        : null;
      const cancelPlanPrice = cancelPlanRow ? Number(cancelPlanRow.price) : 0;
      const cancelClientId = match2.clientId;
      const cancelStatus = match2.status;
      const cancelPeriodStartIso = match2.currentPeriodStart;
      const cancelPeriodEndIso = match2.currentPeriodEnd;

      await db.update("subscriptions", match2.id, {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "Cancelled via EmpCloud",
        updatedAt: now,
      }, orgId);

      logger.info(`Cancelled subscription ${match2.id} for EmpCloud org ${body.organization_id}`);

      // ──────────────────────────────────────────────────────────────────
      // CANCEL PRORATION
      //
      // If the cancelled subscription was active (i.e. prepaid for the
      // current cycle) AND there are days left in the cycle, issue a
      // credit note for the unused days. The credit is `open` status with
      // its full balance available to be applied to the next invoice OR
      // refunded by ops.
      //
      // Skip when:
      //   - subscription was on trial (nothing was billed yet)
      //   - subscription was already cancelled / expired (idempotency)
      //   - the period has already ended (nothing unused)
      //   - the credit would be < 1 unit of currency (rounding noise)
      // ──────────────────────────────────────────────────────────────────
      const cancelPeriodStart = cancelPeriodStartIso
        ? new Date(cancelPeriodStartIso)
        : null;
      const cancelPeriodEnd = cancelPeriodEndIso
        ? new Date(cancelPeriodEndIso)
        : null;
      const cancelTotalDays = cancelPeriodStart && cancelPeriodEnd
        ? Math.max(
            1,
            Math.round(
              (cancelPeriodEnd.getTime() - cancelPeriodStart.getTime()) /
                86400000,
            ),
          )
        : 0;
      const cancelDaysUnused = cancelPeriodEnd
        ? Math.max(
            0,
            Math.round(
              (cancelPeriodEnd.getTime() - now.getTime()) / 86400000,
            ),
          )
        : 0;
      const cycleCost = cancelPlanPrice * cancelPriorQty;
      const refundAmount =
        cancelTotalDays > 0 && cancelDaysUnused > 0
          ? Math.round((cycleCost * cancelDaysUnused) / cancelTotalDays)
          : 0;

      // Only credit a cancellation when the customer ACTUALLY PAID for the
      // current cycle. An `active` sub whose first-period invoice was never
      // paid (or was void / written-off) must NOT generate a credit note for
      // money that never changed hands — otherwise cancelling an unpaid sub
      // hands the customer free credit. Match the cycle invoice the same way
      // the seat-change path does: by client + the module label in the notes.
      let cancelCyclePaid = false;
      if (cancelStatus === "active" && refundAmount >= 100 && cancelClientId) {
        const cancelKnex = (db as KnexAdapter).getKnex();
        const paidInvoice = await cancelKnex("invoices")
          .where({ org_id: orgId, client_id: cancelClientId })
          .whereNotIn("status", ["void", "written_off"])
          .where("notes", "like", `%${body.module_name || body.module_slug}%`)
          .where("amount_paid", ">", 0)
          .first();
        cancelCyclePaid = !!paidInvoice;
      }

      const eligibleForRefund =
        cancelStatus === "active" && refundAmount >= 100 && cancelCyclePaid;

      if (eligibleForRefund) {
        // Deterministic idempotency key so a duplicate (or concurrent)
        // `subscription.cancelled` delivery can't issue a second credit note.
        // The status-flip to "cancelled" above guards sequential replays, but
        // two deliveries racing before the first UPDATE commits would both
        // read status="active"; the unique index on empcloud_idempotency_key
        // stops the double-credit.
        const cancelIdemKey = prorationKey("cancel", {
          subscription_id: match2.id,
          period_start: cancelPeriodStart
            ? dayjs(cancelPeriodStart).format("YYYY-MM-DD")
            : "",
          old_price: cancelPlanPrice,
          new_price: 0,
          old_qty: cancelPriorQty,
          new_qty: 0,
        });
        const creditNoteId = uuid();
        const creditNumber = `CN-${dayjs(now).format("YYYYMMDD")}-${creditNoteId.slice(0, 6)}`;
        try {
          await db.create("credit_notes", {
            id: creditNoteId,
            orgId,
            clientId: cancelClientId,
            creditNoteNumber: creditNumber,
            status: "open",
            date: dayjs(now).format("YYYY-MM-DD"),
            subtotal: refundAmount,
            taxAmount: 0,
            total: refundAmount,
            balance: refundAmount,
            reason: `Cancellation refund for ${body.module_name || body.module_slug} — ${cancelDaysUnused} of ${cancelTotalDays} days unused`,
            createdBy: cancelClientId,
            createdAt: now,
            updatedAt: now,
            empcloudIdempotencyKey: cancelIdemKey,
          });
          await db.create("credit_note_items", {
            id: uuid(),
            creditNoteId,
            orgId,
            name: `Cancellation refund — ${body.module_name || body.module_slug} (${body.plan_tier})`,
            description: `Unused portion of cycle: ${cancelPriorQty} seats × ${cancelPlanPrice}, ${cancelDaysUnused}/${cancelTotalDays} days remaining`,
            quantity: 1,
            rate: refundAmount,
            discountAmount: 0,
            taxRate: 0,
            taxAmount: 0,
            amount: refundAmount,
            sortOrder: 0,
          });
          logger.info(
            `Issued cancellation credit note ${creditNumber} for sub ${match2.id}: -${refundAmount} (${cancelDaysUnused}/${cancelTotalDays} days)`,
          );
        } catch (err) {
          if ((err as any)?.code === "ER_DUP_ENTRY" || (err as any)?.errno === 1062) {
            logger.info(
              `Duplicate cancellation webhook for sub ${match2.id} — credit note already exists`,
            );
          } else {
            throw err;
          }
        }
      }

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
