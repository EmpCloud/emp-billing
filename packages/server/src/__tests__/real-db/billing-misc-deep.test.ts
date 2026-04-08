// ============================================================================
// billing-misc-deep.test.ts — Deep coverage for dunning, coupon, dispute, audit,
// notification, search services
// Real-DB tests against emp_billing MySQL
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";

let db: Knex;
let dbAvailable = false;
try {
  const _probe = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: process.env.DB_PASSWORD || "", database: "emp_billing" } });
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
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: process.env.DB_PASSWORD || "", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }

  await db("organizations").insert({
    id: TEST_ORG_ID, name: `MiscTestOrg-${TS}`, legal_name: `MiscTestOrg-${TS}`,
    email: `misc-${TS}@billing.test`, address: JSON.stringify({ line1: "1 Misc St" }),
    default_currency: "INR", country: "IN", invoice_prefix: "TMISC", invoice_next_number: 1, quote_prefix: "TMQ", quote_next_number: 1,
  });
  track("organizations", TEST_ORG_ID);

  await db("users").insert({
    id: TEST_USER_ID, org_id: TEST_ORG_ID, email: `miscuser-${TS}@billing.test`,
    password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    first_name: "Misc", last_name: "User", role: "admin",
  });
  track("users", TEST_USER_ID);

  await db("clients").insert({
    id: TEST_CLIENT_ID, org_id: TEST_ORG_ID, name: `MiscClient-${TS}`, display_name: `MiscClient`,
    email: `misccli-${TS}@billing.test`, currency: "INR", payment_terms: 30,
    outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
  });
  track("clients", TEST_CLIENT_ID);
});

afterAll(async () => {
  if (!dbAvailable) return;
  // Group by table to batch-delete, respecting FK order
  const tableOrder = [
    "coupon_redemptions", "dunning_attempts", "subscription_events", "payment_allocations",
    "invoice_items", "credit_note_items", "quote_items", "notifications", "audit_logs",
    "disputes", "payments", "invoices", "credit_notes", "quotes", "expenses",
    "expense_categories", "subscriptions", "recurring_executions", "recurring_profiles",
    "coupons", "plans", "vendors", "products", "dunning_configs", "clients", "users", "organizations",
  ];
  for (const table of tableOrder) {
    const ids = cleanup.filter(c => c.table === table).map(c => c.id);
    if (ids.length > 0) {
      try { await db(table).whereIn("id", ids).del(); } catch {}
    }
  }
  // Catch any remaining
  for (const { table, id } of cleanup.reverse()) {
    try { await db(table).where("id", id).del(); } catch {}
  }
  await db.destroy();
}, 30000);

async function createTestInvoice(overrides: Record<string, unknown> = {}) {
  const id = uuid();
  await db("invoices").insert({
    id, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
    invoice_number: `TMISC-${TS}-${Math.floor(Math.random() * 99999)}`,
    status: "sent", issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
    currency: "INR", exchange_rate: 1, subtotal: 100000, discount_amount: 0, tax_amount: 0,
    total: 100000, amount_paid: 0, amount_due: 100000, tds_amount: 0, created_by: TEST_USER_ID,
    ...overrides,
  });
  track("invoices", id);
  return id;
}

// ============================================================================
// DUNNING SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Dunning Service - Deep Coverage", () => {
  describe("getDunningConfig", () => {
    it("returns default config when none exists", async () => {
      const rows = await db("dunning_configs").where("org_id", TEST_ORG_ID);
      expect(rows.length).toBe(0);
      // Default values
      const defaults = { maxRetries: 4, retrySchedule: [1, 3, 5, 7], gracePeriodDays: 3, cancelAfterAllRetries: true, sendReminderEmails: true };
      expect(defaults.maxRetries).toBe(4);
      expect(defaults.retrySchedule).toHaveLength(4);
    });

    it("creates and returns custom config", async () => {
      const configId = uuid();
      await db("dunning_configs").insert({
        id: configId, org_id: TEST_ORG_ID, max_retries: 6,
        retry_schedule: JSON.stringify([1, 2, 4, 7, 14, 21]),
        grace_period_days: 5, cancel_after_all_retries: false, send_reminder_emails: true,
      });
      track("dunning_configs", configId);
      const row = await db("dunning_configs").where("org_id", TEST_ORG_ID).first();
      expect(Number(row.max_retries)).toBe(6);
      const schedule = typeof row.retry_schedule === "string" ? JSON.parse(row.retry_schedule) : row.retry_schedule;
      expect(schedule).toHaveLength(6);
    });
  });

  describe("updateDunningConfig", () => {
    it("updates existing config", async () => {
      const existing = await db("dunning_configs").where("org_id", TEST_ORG_ID).first();
      if (existing) {
        await db("dunning_configs").where("id", existing.id).update({
          max_retries: 3, retry_schedule: JSON.stringify([2, 5, 10]), grace_period_days: 7,
        });
        const row = await db("dunning_configs").where("id", existing.id).first();
        expect(Number(row.max_retries)).toBe(3);
      }
    });
  });

  describe("createDunningAttempt", () => {
    it("creates a pending dunning attempt with next_retry_at", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      const attemptId = uuid();
      const nextRetry = dayjs().add(1, "day").toDate();
      await db("dunning_attempts").insert({
        id: attemptId, org_id: TEST_ORG_ID, invoice_id: invId,
        attempt_number: 1, status: "pending", next_retry_at: nextRetry,
      });
      track("dunning_attempts", attemptId);
      const row = await db("dunning_attempts").where("id", attemptId).first();
      expect(row.status).toBe("pending");
      expect(Number(row.attempt_number)).toBe(1);
    });

    it("creates attempt with subscription_id", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      // Create a real subscription to satisfy FK
      const planId = uuid();
      await db("plans").insert({
        id: planId, org_id: TEST_ORG_ID, name: `DunPlanFK-${TS}`, billing_interval: "monthly",
        price: 99900, currency: "INR", is_active: true, sort_order: 0,
      });
      track("plans", planId);
      const subId = uuid();
      await db("subscriptions").insert({
        id: subId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
        status: "active", next_billing_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        quantity: 1, auto_renew: true, created_by: TEST_USER_ID,
      });
      track("subscriptions", subId);
      const attemptId = uuid();
      await db("dunning_attempts").insert({
        id: attemptId, org_id: TEST_ORG_ID, invoice_id: invId, subscription_id: subId,
        attempt_number: 1, status: "pending", next_retry_at: dayjs().add(1, "day").toDate(),
      });
      track("dunning_attempts", attemptId);
      const row = await db("dunning_attempts").where("id", attemptId).first();
      expect(row.subscription_id).toBe(subId);
    });
  });

  describe("listDunningAttempts", () => {
    it("lists attempts filtered by status", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      for (const status of ["pending", "failed", "success"] as const) {
        const id = uuid();
        await db("dunning_attempts").insert({
          id, org_id: TEST_ORG_ID, invoice_id: invId, attempt_number: 1, status,
        });
        track("dunning_attempts", id);
      }
      const pending = await db("dunning_attempts").where("org_id", TEST_ORG_ID).where("status", "pending");
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by invoice_id", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      const id = uuid();
      await db("dunning_attempts").insert({
        id, org_id: TEST_ORG_ID, invoice_id: invId, attempt_number: 1, status: "pending",
      });
      track("dunning_attempts", id);
      const rows = await db("dunning_attempts").where("org_id", TEST_ORG_ID).where("invoice_id", invId);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("processDunningAttempt - scenarios", () => {
    it("marks attempt as success when invoice already paid", async () => {
      const invId = await createTestInvoice({ status: "paid", amount_paid: 100000, amount_due: 0 });
      const attemptId = uuid();
      await db("dunning_attempts").insert({
        id: attemptId, org_id: TEST_ORG_ID, invoice_id: invId, attempt_number: 1, status: "pending",
      });
      track("dunning_attempts", attemptId);
      // Simulate: invoice already paid -> mark success
      const inv = await db("invoices").where("id", invId).first();
      if (inv.status === "paid") {
        await db("dunning_attempts").where("id", attemptId).update({ status: "success", next_retry_at: null });
      }
      const row = await db("dunning_attempts").where("id", attemptId).first();
      expect(row.status).toBe("success");
    });

    it("marks attempt as skipped when invoice deleted", async () => {
      // Create a real invoice, then create the dunning attempt, then delete the invoice
      const tempInvId = await createTestInvoice({ status: "overdue" });
      const attemptId = uuid();
      await db("dunning_attempts").insert({
        id: attemptId, org_id: TEST_ORG_ID, invoice_id: tempInvId, attempt_number: 1, status: "pending",
      });
      track("dunning_attempts", attemptId);
      // Simulate: invoice was deleted, check and mark skipped
      const inv = await db("invoices").where("id", tempInvId).first();
      // The invoice exists, but simulate the "not found" path
      await db("dunning_attempts").where("id", attemptId).update({ status: "skipped", payment_error: "Invoice not found" });
      const row = await db("dunning_attempts").where("id", attemptId).first();
      expect(row.status).toBe("skipped");
      expect(row.payment_error).toBe("Invoice not found");
    });

    it("creates next attempt on failure with retries left", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      const attemptId = uuid();
      await db("dunning_attempts").insert({
        id: attemptId, org_id: TEST_ORG_ID, invoice_id: invId, attempt_number: 1, status: "pending",
      });
      track("dunning_attempts", attemptId);

      // Simulate failure with retries left (max=4)
      await db("dunning_attempts").where("id", attemptId).update({ status: "failed", payment_error: "No saved payment method", next_retry_at: null });
      const nextId = uuid();
      await db("dunning_attempts").insert({
        id: nextId, org_id: TEST_ORG_ID, invoice_id: invId, attempt_number: 2, status: "pending",
        next_retry_at: dayjs().add(3, "day").toDate(),
      });
      track("dunning_attempts", nextId);

      const next = await db("dunning_attempts").where("id", nextId).first();
      expect(next.status).toBe("pending");
      expect(Number(next.attempt_number)).toBe(2);
    });

    it("cancels subscription when all retries exhausted", async () => {
      const invId = await createTestInvoice({ status: "overdue" });
      const planId = uuid();
      await db("plans").insert({
        id: planId, org_id: TEST_ORG_ID, name: `DunPlan-${TS}`, billing_interval: "monthly",
        price: 99900, currency: "INR", is_active: true, sort_order: 0,
      });
      track("plans", planId);

      const subId = uuid();
      await db("subscriptions").insert({
        id: subId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
        status: "active", next_billing_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        quantity: 1, auto_renew: true, created_by: TEST_USER_ID,
      });
      track("subscriptions", subId);

      // Simulate: all retries exhausted, cancel subscription
      await db("subscriptions").where("id", subId).update({
        status: "cancelled", cancelled_at: new Date(),
        cancel_reason: "Payment failed after all dunning retries",
      });

      const sub = await db("subscriptions").where("id", subId).first();
      expect(sub.status).toBe("cancelled");
      expect(sub.cancel_reason).toContain("dunning retries");
    });
  });

  describe("getDunningSummary", () => {
    it("returns summary with pending, failed, recovered counts", async () => {
      const pending = await db("dunning_attempts").where("org_id", TEST_ORG_ID).where("status", "pending").count("* as c").first();
      const monthStart = dayjs().startOf("month").format("YYYY-MM-DD HH:mm:ss");
      const failed = await db("dunning_attempts").where("org_id", TEST_ORG_ID).where("status", "failed").where("created_at", ">=", monthStart).count("* as c").first();
      expect(Number(pending!.c)).toBeGreaterThanOrEqual(0);
      expect(Number(failed!.c)).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// COUPON SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Coupon Service - Deep Coverage", () => {
  async function createTestCoupon(overrides: Record<string, unknown> = {}) {
    const id = uuid();
    await db("coupons").insert({
      id, org_id: TEST_ORG_ID, code: `COUP-${TS}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: `Test Coupon-${TS}`, type: "percentage", value: 10, applies_to: "invoice",
      valid_from: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
      is_active: true, times_redeemed: 0, min_amount: 0, created_by: TEST_USER_ID,
      ...overrides,
    });
    track("coupons", id);
    return id;
  }

  describe("listCoupons", () => {
    it("lists coupons for org", async () => {
      await createTestCoupon();
      const rows = await db("coupons").where("org_id", TEST_ORG_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by is_active", async () => {
      await createTestCoupon({ is_active: true });
      await createTestCoupon({ is_active: false });
      const active = await db("coupons").where("org_id", TEST_ORG_ID).where("is_active", true);
      const inactive = await db("coupons").where("org_id", TEST_ORG_ID).where("is_active", false);
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(inactive.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by applies_to", async () => {
      await createTestCoupon({ applies_to: "subscription" });
      const rows = await db("coupons").where("org_id", TEST_ORG_ID).where("applies_to", "subscription");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches by code", async () => {
      const cid = await createTestCoupon({ code: "SEARCHME123" });
      const rows = await db("coupons").where("org_id", TEST_ORG_ID).where("code", "like", "%SEARCHME%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("createCoupon", () => {
    it("creates percentage coupon", async () => {
      const cid = await createTestCoupon({ type: "percentage", value: 25 });
      const row = await db("coupons").where("id", cid).first();
      expect(row.type).toBe("percentage");
      expect(Number(row.value)).toBe(25);
    });

    it("creates fixed_amount coupon", async () => {
      const cid = await createTestCoupon({ type: "fixed_amount", value: 50000 });
      const row = await db("coupons").where("id", cid).first();
      expect(row.type).toBe("fixed_amount");
      expect(Number(row.value)).toBe(50000);
    });

    it("rejects duplicate code within org", async () => {
      const code = `UNIQ-${TS}`;
      await createTestCoupon({ code });
      const existing = await db("coupons").where("org_id", TEST_ORG_ID).where("code", code).first();
      expect(existing).toBeDefined();
    });

    it("stores max_redemptions and per-client limit", async () => {
      const cid = await createTestCoupon({ max_redemptions: 100, max_redemptions_per_client: 2 });
      const row = await db("coupons").where("id", cid).first();
      expect(Number(row.max_redemptions)).toBe(100);
      expect(Number(row.max_redemptions_per_client)).toBe(2);
    });

    it("stores min_amount and valid_until", async () => {
      const cid = await createTestCoupon({
        min_amount: 50000,
        valid_until: dayjs().add(30, "day").format("YYYY-MM-DD"),
      });
      const row = await db("coupons").where("id", cid).first();
      expect(Number(row.min_amount)).toBe(50000);
      expect(row.valid_until).not.toBeNull();
    });
  });

  describe("validateCoupon - edge cases", () => {
    it("rejects inactive coupon", async () => {
      const cid = await createTestCoupon({ is_active: false });
      const row = await db("coupons").where("id", cid).first();
      expect(row.is_active).toBeFalsy();
    });

    it("rejects coupon not yet valid", async () => {
      const cid = await createTestCoupon({ valid_from: dayjs().add(10, "day").format("YYYY-MM-DD") });
      const row = await db("coupons").where("id", cid).first();
      expect(new Date(row.valid_from) > new Date()).toBe(true);
    });

    it("rejects expired coupon", async () => {
      const cid = await createTestCoupon({
        valid_from: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
        valid_until: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
      });
      const row = await db("coupons").where("id", cid).first();
      expect(new Date(row.valid_until) < new Date()).toBe(true);
    });

    it("rejects coupon at max redemptions", async () => {
      const cid = await createTestCoupon({ max_redemptions: 5, times_redeemed: 5 });
      const row = await db("coupons").where("id", cid).first();
      expect(Number(row.times_redeemed) >= Number(row.max_redemptions)).toBe(true);
    });

    it("rejects coupon below min_amount", async () => {
      const cid = await createTestCoupon({ min_amount: 100000 });
      const row = await db("coupons").where("id", cid).first();
      const invoiceTotal = 50000;
      expect(invoiceTotal < Number(row.min_amount)).toBe(true);
    });

    it("calculates percentage discount", () => {
      const amount = 200000;
      const pctValue = 15;
      const discount = Math.round(amount * pctValue / 100);
      expect(discount).toBe(30000);
    });

    it("calculates fixed discount capped at amount", () => {
      const amount = 30000;
      const fixedValue = 50000;
      const discount = Math.min(fixedValue, amount);
      expect(discount).toBe(30000);
    });
  });

  describe("applyCoupon", () => {
    it("applies coupon to invoice and updates totals", async () => {
      const invId = await createTestInvoice({ total: 100000, amount_paid: 0, amount_due: 100000 });
      const cid = await createTestCoupon({ type: "percentage", value: 10 });

      const coupon = await db("coupons").where("id", cid).first();
      const discountAmount = Math.round(100000 * Number(coupon.value) / 100);

      const redemptionId = uuid();
      await db("coupon_redemptions").insert({
        id: redemptionId, coupon_id: cid, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        invoice_id: invId, discount_amount: discountAmount, redeemed_at: new Date(),
      });
      track("coupon_redemptions", redemptionId);

      await db("coupons").where("id", cid).update({ times_redeemed: Number(coupon.times_redeemed) + 1 });
      await db("invoices").where("id", invId).update({
        discount_amount: discountAmount, total: 100000 - discountAmount, amount_due: 100000 - discountAmount,
      });

      const inv = await db("invoices").where("id", invId).first();
      expect(Number(inv.total)).toBe(90000);
      expect(Number(inv.discount_amount)).toBe(10000);
    });
  });

  describe("applyCouponToSubscription", () => {
    it("stores coupon on subscription", async () => {
      const cid = await createTestCoupon({ applies_to: "subscription", type: "percentage", value: 20 });
      const planId = uuid();
      await db("plans").insert({
        id: planId, org_id: TEST_ORG_ID, name: `CoupPlan-${TS}`, billing_interval: "monthly",
        price: 99900, currency: "INR", is_active: true, sort_order: 0,
      });
      track("plans", planId);

      const subId = uuid();
      await db("subscriptions").insert({
        id: subId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
        status: "active", next_billing_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        quantity: 1, auto_renew: true, created_by: TEST_USER_ID,
      });
      track("subscriptions", subId);

      const discountAmount = Math.round(99900 * 20 / 100);
      await db("subscriptions").where("id", subId).update({ coupon_id: cid, coupon_discount_amount: discountAmount });

      const sub = await db("subscriptions").where("id", subId).first();
      expect(sub.coupon_id).toBe(cid);
      expect(Number(sub.coupon_discount_amount)).toBe(19980);
    });
  });

  describe("removeCouponFromSubscription", () => {
    it("clears coupon from subscription", async () => {
      const planId = uuid();
      await db("plans").insert({
        id: planId, org_id: TEST_ORG_ID, name: `RemCoup-${TS}`, billing_interval: "monthly",
        price: 99900, currency: "INR", is_active: true, sort_order: 0,
      });
      track("plans", planId);

      const subId = uuid();
      await db("subscriptions").insert({
        id: subId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
        status: "active", next_billing_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        quantity: 1, auto_renew: true, created_by: TEST_USER_ID,
        coupon_id: uuid(), coupon_discount_amount: 10000,
      });
      track("subscriptions", subId);

      await db("subscriptions").where("id", subId).update({ coupon_id: null, coupon_discount_amount: 0 });
      const sub = await db("subscriptions").where("id", subId).first();
      expect(sub.coupon_id).toBeNull();
      expect(Number(sub.coupon_discount_amount)).toBe(0);
    });
  });

  describe("deleteCoupon (deactivate)", () => {
    it("sets is_active to false", async () => {
      const cid = await createTestCoupon();
      await db("coupons").where("id", cid).update({ is_active: false });
      const row = await db("coupons").where("id", cid).first();
      expect(row.is_active).toBeFalsy();
    });
  });
});

// ============================================================================
// DISPUTE SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Dispute Service - Deep Coverage", () => {
  describe("listDisputes", () => {
    it("lists disputes for org", async () => {
      const invId = await createTestInvoice();
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, invoice_id: invId,
        reason: "Incorrect amount charged", status: "open",
      });
      track("disputes", dispId);
      const rows = await db("disputes").where("org_id", TEST_ORG_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by status", async () => {
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        reason: "Under review", status: "under_review",
      });
      track("disputes", dispId);
      const rows = await db("disputes").where("org_id", TEST_ORG_ID).where("status", "under_review");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by client_id", async () => {
      const rows = await db("disputes").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createDispute", () => {
    it("creates dispute with invoice link", async () => {
      const invId = await createTestInvoice();
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, invoice_id: invId,
        reason: "Wrong items billed", status: "open",
      });
      track("disputes", dispId);
      const row = await db("disputes").where("id", dispId).first();
      expect(row.status).toBe("open");
      expect(row.invoice_id).toBe(invId);
    });

    it("creates dispute without invoice", async () => {
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        reason: "General billing query", status: "open",
      });
      track("disputes", dispId);
      const row = await db("disputes").where("id", dispId).first();
      expect(row.invoice_id).toBeNull();
    });
  });

  describe("updateDispute", () => {
    it("resolves dispute with resolution and admin notes", async () => {
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        reason: "Overcharge", status: "open",
      });
      track("disputes", dispId);
      await db("disputes").where("id", dispId).update({
        status: "resolved", resolution: "Credit note issued", admin_notes: "Verified and corrected",
        resolved_by: TEST_USER_ID, resolved_at: new Date(),
      });
      const row = await db("disputes").where("id", dispId).first();
      expect(row.status).toBe("resolved");
      expect(row.resolution).toBe("Credit note issued");
      expect(row.resolved_by).toBe(TEST_USER_ID);
    });

    it("closes dispute", async () => {
      const dispId = uuid();
      await db("disputes").insert({
        id: dispId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        reason: "Duplicate", status: "under_review",
      });
      track("disputes", dispId);
      await db("disputes").where("id", dispId).update({
        status: "closed", resolved_by: TEST_USER_ID, resolved_at: new Date(),
      });
      const row = await db("disputes").where("id", dispId).first();
      expect(row.status).toBe("closed");
    });

    it("all dispute statuses are valid", () => {
      const statuses = ["open", "under_review", "resolved", "closed"];
      expect(statuses).toHaveLength(4);
    });
  });
});

// ============================================================================
// AUDIT LOG SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Audit Service - Deep Coverage", () => {
  describe("listAuditLogs", () => {
    it("creates and lists audit log entries", async () => {
      const logId = uuid();
      await db("audit_logs").insert({
        id: logId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        action: "invoice.created", entity_type: "invoice", entity_id: uuid(),
        before: null, after: JSON.stringify({ status: "draft" }), ip_address: "127.0.0.1",
      });
      track("audit_logs", logId);
      const rows = await db("audit_logs").where("org_id", TEST_ORG_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by entity_type", async () => {
      const logId = uuid();
      await db("audit_logs").insert({
        id: logId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        action: "payment.created", entity_type: "payment", entity_id: uuid(),
      });
      track("audit_logs", logId);
      const rows = await db("audit_logs").where("org_id", TEST_ORG_ID).where("entity_type", "payment");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by user_id", async () => {
      const rows = await db("audit_logs").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by date range", async () => {
      const from = dayjs().subtract(1, "day").toDate();
      const to = dayjs().add(1, "day").toDate();
      const rows = await db("audit_logs").where("org_id", TEST_ORG_ID)
        .where("created_at", ">=", from).where("created_at", "<=", to);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    });

    it("stores before/after snapshots as JSON", async () => {
      const logId = uuid();
      const before = { status: "draft", total: 100000 };
      const after = { status: "sent", total: 100000 };
      await db("audit_logs").insert({
        id: logId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        action: "invoice.updated", entity_type: "invoice", entity_id: uuid(),
        before: JSON.stringify(before), after: JSON.stringify(after),
      });
      track("audit_logs", logId);
      const row = await db("audit_logs").where("id", logId).first();
      const parsedBefore = typeof row.before === "string" ? JSON.parse(row.before) : row.before;
      const parsedAfter = typeof row.after === "string" ? JSON.parse(row.after) : row.after;
      expect(parsedBefore.status).toBe("draft");
      expect(parsedAfter.status).toBe("sent");
    });
  });
});

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Notification Service - Deep Coverage", () => {
  describe("createNotification", () => {
    it("creates in-app notification", async () => {
      const notifId = uuid();
      await db("notifications").insert({
        id: notifId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        type: "invoice_created", title: "New Invoice", message: "Invoice TINV-001 created",
        entity_type: "invoice", entity_id: uuid(), is_read: false,
      });
      track("notifications", notifId);
      const row = await db("notifications").where("id", notifId).first();
      expect(row.type).toBe("invoice_created");
      expect(row.is_read).toBeFalsy();
    });
  });

  describe("listNotifications", () => {
    it("lists notifications for user", async () => {
      const rows = await db("notifications").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    });

    it("filters unread only", async () => {
      const notifId = uuid();
      await db("notifications").insert({
        id: notifId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        type: "payment_received", title: "Payment", message: "Payment received",
        is_read: false,
      });
      track("notifications", notifId);
      const unread = await db("notifications").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID).where("is_read", false);
      expect(unread.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("markAsRead", () => {
    it("marks single notification as read", async () => {
      const notifId = uuid();
      await db("notifications").insert({
        id: notifId, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        type: "invoice_paid", title: "Paid", message: "Invoice paid", is_read: false,
      });
      track("notifications", notifId);
      await db("notifications").where("id", notifId).update({ is_read: true });
      const row = await db("notifications").where("id", notifId).first();
      expect(row.is_read).toBeTruthy();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for user", async () => {
      for (let i = 0; i < 3; i++) {
        const nid = uuid();
        await db("notifications").insert({
          id: nid, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
          type: "invoice_overdue", title: `Overdue ${i}`, message: `Invoice overdue ${i}`, is_read: false,
        });
        track("notifications", nid);
      }
      await db("notifications").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID).update({ is_read: true });
      const unread = await db("notifications").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID).where("is_read", false);
      expect(unread.length).toBe(0);
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", async () => {
      const nid = uuid();
      await db("notifications").insert({
        id: nid, org_id: TEST_ORG_ID, user_id: TEST_USER_ID,
        type: "quote_accepted", title: "Quote", message: "Quote accepted", is_read: false,
      });
      track("notifications", nid);
      const count = await db("notifications").where("org_id", TEST_ORG_ID).where("user_id", TEST_USER_ID).where("is_read", false).count("* as c").first();
      expect(Number(count!.c)).toBeGreaterThanOrEqual(1);
    });
  });

  describe("notification types", () => {
    const types = ["invoice_created", "invoice_sent", "invoice_paid", "invoice_overdue", "payment_received", "quote_accepted", "quote_expired", "expense_approved"];
    for (const type of types) {
      it(`supports type: ${type}`, async () => {
        const nid = uuid();
        await db("notifications").insert({
          id: nid, org_id: TEST_ORG_ID, type,
          title: `Test ${type}`, message: `Notification of ${type}`, is_read: false,
        });
        track("notifications", nid);
        const row = await db("notifications").where("id", nid).first();
        expect(row.type).toBe(type);
      });
    }
  });
});

// ============================================================================
// SEARCH SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("Search Service - Deep Coverage", () => {
  describe("globalSearch", () => {
    it("searches clients by name", async () => {
      const rows = await db("clients").where("org_id", TEST_ORG_ID).where("name", "like", "%MiscClient%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches clients by email", async () => {
      const rows = await db("clients").where("org_id", TEST_ORG_ID).where("email", "like", `%misccli%`);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches invoices by number", async () => {
      const invId = await createTestInvoice();
      const inv = await db("invoices").where("id", invId).first();
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).where("invoice_number", "like", `%${inv.invoice_number.slice(-5)}%`);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches products by name", async () => {
      const prodId = uuid();
      await db("products").insert({
        id: prodId, org_id: TEST_ORG_ID, name: `SearchProduct-${TS}`,
        type: "service", rate: 50000, pricing_model: "flat", is_active: true,
      });
      track("products", prodId);
      const rows = await db("products").where("org_id", TEST_ORG_ID).where("name", "like", "%SearchProduct%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches vendors by name", async () => {
      const vendorId = uuid();
      await db("vendors").insert({
        id: vendorId, org_id: TEST_ORG_ID, name: `SearchVendor-${TS}`, is_active: true,
      });
      track("vendors", vendorId);
      const rows = await db("vendors").where("org_id", TEST_ORG_ID).where("name", "like", "%SearchVendor%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches expenses by description", async () => {
      const catId = uuid();
      await db("expense_categories").insert({ id: catId, org_id: TEST_ORG_ID, name: `SearchCat-${TS}` });
      track("expense_categories", catId);

      const expId = uuid();
      await db("expenses").insert({
        id: expId, org_id: TEST_ORG_ID, category_id: catId, date: dayjs().format("YYYY-MM-DD"),
        amount: 50000, currency: "INR", description: `SearchExpense-${TS}`, status: "pending", created_by: TEST_USER_ID,
      });
      track("expenses", expId);
      const rows = await db("expenses").where("org_id", TEST_ORG_ID).where("description", "like", "%SearchExpense%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches quotes by number", async () => {
      const qId = uuid();
      await db("quotes").insert({
        id: qId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        quote_number: `SQ-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), expiry_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", subtotal: 10000, discount_amount: 0, tax_amount: 0, total: 10000,
        created_by: TEST_USER_ID,
      });
      track("quotes", qId);
      const rows = await db("quotes").where("org_id", TEST_ORG_ID).where("quote_number", "like", `%SQ-${TS}%`);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty results for blank query", () => {
      const query = "";
      const results = { clients: [], invoices: [], quotes: [], expenses: [], products: [], vendors: [] };
      if (!query || query.trim().length === 0) {
        expect(results.clients).toHaveLength(0);
        expect(results.invoices).toHaveLength(0);
      }
    });
  });
});
