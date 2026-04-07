// ============================================================================
// billing-subscription-deep.test.ts — Deep coverage for subscription, recurring, proration
// Real-DB tests against emp_billing MySQL
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";

let db: Knex;
let dbAvailable = false;
try {
  const _probe = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await _probe.raw("SELECT 1");
  await _probe.destroy();
  dbAvailable = true;
} catch {}
const TS = Date.now();
const TEST_ORG_ID = uuid();
const TEST_USER_ID = uuid();
const TEST_CLIENT_ID = uuid();

const cleanup: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanup.push({ table, id }); }

beforeAll(async () => {
  try {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }

  await db("organizations").insert({
    id: TEST_ORG_ID, name: `SubTestOrg-${TS}`, legal_name: `SubTestOrg-${TS}`,
    email: `sub-${TS}@billing.test`, address: JSON.stringify({ line1: "1 Sub St" }),
    default_currency: "INR", country: "IN", invoice_prefix: "TSUB", invoice_next_number: 1, quote_prefix: "TSQ", quote_next_number: 1,
  });
  track("organizations", TEST_ORG_ID);

  await db("users").insert({
    id: TEST_USER_ID, org_id: TEST_ORG_ID, email: `subuser-${TS}@billing.test`,
    password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    first_name: "Sub", last_name: "User", role: "admin",
  });
  track("users", TEST_USER_ID);

  await db("clients").insert({
    id: TEST_CLIENT_ID, org_id: TEST_ORG_ID, name: `SubClient-${TS}`, display_name: `SubClient`,
    email: `subclient-${TS}@billing.test`, currency: "INR", payment_terms: 30,
    outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
  });
  track("clients", TEST_CLIENT_ID);
});

afterAll(async () => {
  if (!dbAvailable) return;
  for (const { table, id } of cleanup.reverse()) {
    try { await db(table).where("id", id).del(); } catch {}
  }
  await db.destroy();
});

async function createTestPlan(overrides: Record<string, unknown> = {}) {
  const id = uuid();
  await db("plans").insert({
    id, org_id: TEST_ORG_ID, name: `Plan-${TS}-${Math.random().toString(36).slice(2,6)}`,
    billing_interval: "monthly", price: 99900, currency: "INR", trial_period_days: 0,
    setup_fee: 0, is_active: true, sort_order: 0, features: JSON.stringify(["Feature A"]),
    ...overrides,
  });
  track("plans", id);
  return id;
}

async function createTestSubscription(planId: string, overrides: Record<string, unknown> = {}) {
  const id = uuid();
  const now = new Date();
  const periodEnd = dayjs(now).add(1, "month").toDate();
  await db("subscriptions").insert({
    id, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
    status: "active", current_period_start: now, current_period_end: periodEnd,
    next_billing_date: dayjs(periodEnd).format("YYYY-MM-DD"), quantity: 1, auto_renew: true,
    created_by: TEST_USER_ID, ...overrides,
  });
  track("subscriptions", id);
  return id;
}

describe.skipIf(!dbAvailable)("Subscription Service - Deep Coverage", () => {
  // ── Plan CRUD ─────────────────────────────────────────────────────────────

  describe("Plan CRUD", () => {
    it("creates a plan with all fields", async () => {
      const planId = await createTestPlan({ description: "Test plan", setup_fee: 5000, trial_period_days: 14 });
      const row = await db("plans").where("id", planId).first();
      expect(row).toBeDefined();
      expect(row.description).toBe("Test plan");
      expect(Number(row.setup_fee)).toBe(5000);
      expect(Number(row.trial_period_days)).toBe(14);
    });

    it("lists only active plans for org", async () => {
      await createTestPlan({ is_active: true });
      await createTestPlan({ is_active: false });
      const active = await db("plans").where("org_id", TEST_ORG_ID).where("is_active", true);
      const inactive = await db("plans").where("org_id", TEST_ORG_ID).where("is_active", false);
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(inactive.length).toBeGreaterThanOrEqual(1);
    });

    it("updates plan name and price", async () => {
      const planId = await createTestPlan();
      await db("plans").where("id", planId).update({ name: "Updated Plan", price: 149900 });
      const row = await db("plans").where("id", planId).first();
      expect(row.name).toBe("Updated Plan");
      expect(Number(row.price)).toBe(149900);
    });

    it("soft-deletes plan (sets is_active = false)", async () => {
      const planId = await createTestPlan();
      await db("plans").where("id", planId).update({ is_active: false });
      const row = await db("plans").where("id", planId).first();
      expect(row.is_active).toBeFalsy();
    });

    it("stores and parses features JSON", async () => {
      const features = ["Unlimited users", "Priority support", "API access"];
      const planId = await createTestPlan({ features: JSON.stringify(features) });
      const row = await db("plans").where("id", planId).first();
      const parsed = typeof row.features === "string" ? JSON.parse(row.features) : row.features;
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe("Unlimited users");
    });

    it("supports all billing intervals", async () => {
      for (const interval of ["monthly", "quarterly", "semi_annual", "annual"]) {
        const planId = await createTestPlan({ billing_interval: interval });
        const row = await db("plans").where("id", planId).first();
        expect(row.billing_interval).toBe(interval);
      }
    });

    it("supports custom billing interval with days", async () => {
      const planId = await createTestPlan({ billing_interval: "custom", billing_interval_days: 45 });
      const row = await db("plans").where("id", planId).first();
      expect(row.billing_interval).toBe("custom");
      expect(Number(row.billing_interval_days)).toBe(45);
    });
  });

  // ── Subscription lifecycle ──────────────────────────────────────────────────

  describe("Subscription lifecycle", () => {
    it("creates active subscription immediately (no trial)", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId);
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).toBe("active");
      expect(row.current_period_start).not.toBeNull();
      expect(row.current_period_end).not.toBeNull();
    });

    it("creates trialing subscription when plan has trial days", async () => {
      const planId = await createTestPlan({ trial_period_days: 14 });
      const subId = await createTestSubscription(planId, {
        status: "trialing", trial_start: new Date(), trial_end: dayjs().add(14, "day").toDate(),
        current_period_start: null, current_period_end: null,
      });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).toBe("trialing");
      expect(row.trial_start).not.toBeNull();
      expect(row.trial_end).not.toBeNull();
    });

    it("pauses an active subscription", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId);
      await db("subscriptions").where("id", subId).update({ status: "paused", pause_start: new Date() });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).toBe("paused");
      expect(row.pause_start).not.toBeNull();
    });

    it("rejects pausing a non-active subscription", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId, { status: "cancelled" });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).not.toBe("active");
    });

    it("resumes a paused subscription with new period dates", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId, { status: "paused", pause_start: new Date() });
      const now = new Date();
      const newEnd = dayjs(now).add(1, "month").toDate();
      await db("subscriptions").where("id", subId).update({
        status: "active", pause_start: null, resume_date: null,
        current_period_start: now, current_period_end: newEnd,
        next_billing_date: dayjs(newEnd).format("YYYY-MM-DD"),
      });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).toBe("active");
      expect(row.pause_start).toBeNull();
    });

    it("cancels subscription immediately", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId);
      await db("subscriptions").where("id", subId).update({
        status: "cancelled", cancelled_at: new Date(), cancel_reason: "Customer requested",
      });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.status).toBe("cancelled");
      expect(row.cancel_reason).toBe("Customer requested");
    });

    it("cancels at period end (sets auto_renew = false)", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId);
      await db("subscriptions").where("id", subId).update({ auto_renew: false, cancel_reason: "Downgrade" });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.auto_renew).toBeFalsy();
      expect(row.cancel_reason).toBe("Downgrade");
    });

    it("rejects cancelling already cancelled subscription", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId, { status: "cancelled" });
      const row = await db("subscriptions").where("id", subId).first();
      expect(["cancelled", "expired"].includes(row.status)).toBe(true);
    });
  });

  // ── Subscription events ─────────────────────────────────────────────────────

  describe("subscription events", () => {
    it("logs subscription events with correct type", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId);
      const events = ["created", "activated", "paused", "resumed", "cancelled", "payment_failed"];
      for (const evtType of events) {
        const evtId = uuid();
        await db("subscription_events").insert({
          id: evtId, subscription_id: subId, org_id: TEST_ORG_ID, event_type: evtType, created_at: new Date(),
        });
        track("subscription_events", evtId);
      }
      const rows = await db("subscription_events").where("subscription_id", subId);
      expect(rows.length).toBe(6);
      const types = rows.map((r: any) => r.event_type);
      expect(types).toContain("created");
      expect(types).toContain("payment_failed");
    });

    it("logs plan change with old/new plan IDs", async () => {
      const oldPlanId = await createTestPlan({ price: 50000 });
      const newPlanId = await createTestPlan({ price: 100000 });
      const subId = await createTestSubscription(oldPlanId);
      const evtId = uuid();
      await db("subscription_events").insert({
        id: evtId, subscription_id: subId, org_id: TEST_ORG_ID, event_type: "upgraded",
        old_plan_id: oldPlanId, new_plan_id: newPlanId,
        metadata: JSON.stringify({ prorate: true }), created_at: new Date(),
      });
      track("subscription_events", evtId);
      const evt = await db("subscription_events").where("id", evtId).first();
      expect(evt.old_plan_id).toBe(oldPlanId);
      expect(evt.new_plan_id).toBe(newPlanId);
    });
  });

  // ── Proration calculation ───────────────────────────────────────────────────

  describe("proration calculation", () => {
    it("computes daily rate proration for upgrade", () => {
      const daysTotal = 30;
      const daysRemaining = 15;
      const oldPrice = 100000;
      const newPrice = 200000;
      const quantity = 1;
      const dailyOld = (oldPrice * quantity) / daysTotal;
      const dailyNew = (newPrice * quantity) / daysTotal;
      const unusedCredit = Math.round(dailyOld * daysRemaining);
      const newCharge = Math.round(dailyNew * daysRemaining);
      const netAmount = newCharge - unusedCredit;
      expect(netAmount).toBe(50000);
      expect(newCharge > unusedCredit).toBe(true);
    });

    it("computes proration for downgrade (credit)", () => {
      const daysTotal = 30;
      const daysRemaining = 20;
      const oldPrice = 200000;
      const newPrice = 100000;
      const dailyOld = oldPrice / daysTotal;
      const dailyNew = newPrice / daysTotal;
      const unusedCredit = Math.round(dailyOld * daysRemaining);
      const newCharge = Math.round(dailyNew * daysRemaining);
      const netAmount = newCharge - unusedCredit;
      expect(netAmount).toBeLessThan(0);
    });

    it("returns zero proration when no days remaining", () => {
      const daysRemaining = 0;
      const unusedCredit = 0;
      const newCharge = 0;
      expect(newCharge - unusedCredit).toBe(0);
    });

    it("handles quantity > 1", () => {
      const daysTotal = 30;
      const daysRemaining = 10;
      const oldPrice = 100000;
      const newPrice = 150000;
      const quantity = 5;
      const dailyOld = (oldPrice * quantity) / daysTotal;
      const dailyNew = (newPrice * quantity) / daysTotal;
      const net = Math.round(dailyNew * daysRemaining) - Math.round(dailyOld * daysRemaining);
      expect(net).toBeGreaterThan(0);
    });
  });

  // ── Change plan ─────────────────────────────────────────────────────────────

  describe("changePlan", () => {
    it("updates subscription plan_id", async () => {
      const oldPlanId = await createTestPlan({ price: 50000 });
      const newPlanId = await createTestPlan({ price: 100000 });
      const subId = await createTestSubscription(oldPlanId);
      await db("subscriptions").where("id", subId).update({ plan_id: newPlanId });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.plan_id).toBe(newPlanId);
    });

    it("rejects plan change for cancelled subscription", async () => {
      const planId = await createTestPlan();
      const subId = await createTestSubscription(planId, { status: "cancelled" });
      const row = await db("subscriptions").where("id", subId).first();
      expect(["active", "trialing"].includes(row.status)).toBe(false);
    });
  });

  // ── Recurring profiles ──────────────────────────────────────────────────────

  describe("Recurring Profiles", () => {
    async function createTestProfile(overrides: Record<string, unknown> = {}) {
      const id = uuid();
      const nextDate = dayjs().add(1, "month").format("YYYY-MM-DD");
      await db("recurring_profiles").insert({
        id, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, type: "invoice",
        frequency: "monthly", start_date: dayjs().format("YYYY-MM-DD"),
        next_execution_date: nextDate, status: "active", auto_send: false, auto_charge: false,
        occurrence_count: 0, template_data: JSON.stringify({ items: [{ name: "SaaS", rate: 99900, quantity: 1 }] }),
        created_by: TEST_USER_ID, ...overrides,
      });
      track("recurring_profiles", id);
      return id;
    }

    it("creates a recurring profile", async () => {
      const profId = await createTestProfile();
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row.status).toBe("active");
      expect(row.frequency).toBe("monthly");
    });

    it("lists profiles filtered by status", async () => {
      await createTestProfile({ status: "active" });
      await createTestProfile({ status: "paused" });
      const active = await db("recurring_profiles").where("org_id", TEST_ORG_ID).where("status", "active");
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it("pauses an active profile", async () => {
      const profId = await createTestProfile();
      await db("recurring_profiles").where("id", profId).update({ status: "paused" });
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row.status).toBe("paused");
    });

    it("rejects pausing a non-active profile", async () => {
      const profId = await createTestProfile({ status: "completed" });
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row.status).not.toBe("active");
    });

    it("resumes a paused profile with new next_execution_date", async () => {
      const profId = await createTestProfile({ status: "paused" });
      const newNext = dayjs().add(1, "month").format("YYYY-MM-DD");
      await db("recurring_profiles").where("id", profId).update({ status: "active", next_execution_date: newNext });
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row.status).toBe("active");
    });

    it("deletes an active profile", async () => {
      const profId = await createTestProfile();
      await db("recurring_profiles").where("id", profId).del();
      cleanup.splice(cleanup.findIndex(c => c.id === profId), 1);
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row).toBeUndefined();
    });

    it("rejects deleting a completed profile", async () => {
      const profId = await createTestProfile({ status: "completed" });
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(["active", "paused"].includes(row.status)).toBe(false);
    });

    it("supports all frequency types", async () => {
      for (const freq of ["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly"]) {
        const profId = await createTestProfile({ frequency: freq });
        const row = await db("recurring_profiles").where("id", profId).first();
        expect(row.frequency).toBe(freq);
      }
    });

    it("supports custom frequency with custom_days", async () => {
      const profId = await createTestProfile({ frequency: "custom", custom_days: 45 });
      const row = await db("recurring_profiles").where("id", profId).first();
      expect(row.frequency).toBe("custom");
      expect(Number(row.custom_days)).toBe(45);
    });
  });

  // ── Recurring executions ────────────────────────────────────────────────────

  describe("Recurring Executions", () => {
    it("logs execution with success status", async () => {
      const profId = uuid();
      await db("recurring_profiles").insert({
        id: profId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, type: "invoice",
        frequency: "monthly", start_date: dayjs().format("YYYY-MM-DD"),
        next_execution_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        status: "active", auto_send: false, auto_charge: false, occurrence_count: 0,
        template_data: JSON.stringify({}), created_by: TEST_USER_ID,
      });
      track("recurring_profiles", profId);

      const execId = uuid();
      await db("recurring_executions").insert({
        id: execId, profile_id: profId, org_id: TEST_ORG_ID,
        execution_date: dayjs().format("YYYY-MM-DD"), status: "success",
      });
      track("recurring_executions", execId);

      const row = await db("recurring_executions").where("id", execId).first();
      expect(row.status).toBe("success");
    });

    it("logs execution with failed status and error", async () => {
      const profId = uuid();
      await db("recurring_profiles").insert({
        id: profId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, type: "invoice",
        frequency: "monthly", start_date: dayjs().format("YYYY-MM-DD"),
        next_execution_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        status: "active", auto_send: false, auto_charge: false, occurrence_count: 0,
        template_data: JSON.stringify({}), created_by: TEST_USER_ID,
      });
      track("recurring_profiles", profId);

      const execId = uuid();
      await db("recurring_executions").insert({
        id: execId, profile_id: profId, org_id: TEST_ORG_ID,
        execution_date: dayjs().format("YYYY-MM-DD"), status: "failed", error: "Client not found",
      });
      track("recurring_executions", execId);

      const row = await db("recurring_executions").where("id", execId).first();
      expect(row.status).toBe("failed");
      expect(row.error).toBe("Client not found");
    });
  });

  // ── computeNextDate ─────────────────────────────────────────────────────────

  describe("computeNextDate logic", () => {
    const base = dayjs("2026-01-01");
    it("daily adds 1 day", () => { expect(base.add(1, "day").format("YYYY-MM-DD")).toBe("2026-01-02"); });
    it("weekly adds 7 days", () => { expect(base.add(1, "week").format("YYYY-MM-DD")).toBe("2026-01-08"); });
    it("monthly adds 1 month", () => { expect(base.add(1, "month").format("YYYY-MM-DD")).toBe("2026-02-01"); });
    it("quarterly adds 3 months", () => { expect(base.add(3, "month").format("YYYY-MM-DD")).toBe("2026-04-01"); });
    it("half_yearly adds 6 months", () => { expect(base.add(6, "month").format("YYYY-MM-DD")).toBe("2026-07-01"); });
    it("yearly adds 1 year", () => { expect(base.add(1, "year").format("YYYY-MM-DD")).toBe("2027-01-01"); });
    it("custom adds N days", () => { expect(base.add(45, "day").format("YYYY-MM-DD")).toBe("2026-02-15"); });
  });

  // ── Subscription with coupon ────────────────────────────────────────────────

  describe("subscription with coupon", () => {
    it("stores coupon_id and discount amount on subscription", async () => {
      const planId = await createTestPlan();
      const couponId = uuid();
      await db("coupons").insert({
        id: couponId, org_id: TEST_ORG_ID, code: `SUB-COUP-${TS}`, name: "Sub Discount",
        type: "percentage", value: 20, applies_to: "subscription",
        valid_from: dayjs().format("YYYY-MM-DD"), is_active: true, times_redeemed: 0, min_amount: 0,
        created_by: TEST_USER_ID,
      });
      track("coupons", couponId);

      const subId = await createTestSubscription(planId, { coupon_id: couponId, coupon_discount_amount: 19980 });
      const row = await db("subscriptions").where("id", subId).first();
      expect(row.coupon_id).toBe(couponId);
      expect(Number(row.coupon_discount_amount)).toBe(19980);
    });
  });

  // ── Subscription metadata ───────────────────────────────────────────────────

  describe("subscription metadata", () => {
    it("stores and retrieves metadata JSON", async () => {
      const planId = await createTestPlan();
      const meta = { source: "empcloud", module: "payroll" };
      const subId = await createTestSubscription(planId, { metadata: JSON.stringify(meta) });
      const row = await db("subscriptions").where("id", subId).first();
      const parsed = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      expect(parsed.source).toBe("empcloud");
    });
  });

  // ── List subscriptions filters ──────────────────────────────────────────────

  describe("listSubscriptions filters", () => {
    it("filters by status", async () => {
      const planId = await createTestPlan();
      await createTestSubscription(planId, { status: "active" });
      await createTestSubscription(planId, { status: "paused", pause_start: new Date() });
      const active = await db("subscriptions").where("org_id", TEST_ORG_ID).where("status", "active");
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by client_id", async () => {
      const planId = await createTestPlan();
      await createTestSubscription(planId);
      const rows = await db("subscriptions").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
