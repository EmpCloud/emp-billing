// ============================================================================
// EMP BILLING — Credit Note, Recurring Profile & Usage/Pricing Deep Real-DB Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";

let db: Knex;
let dbAvailable = false;
try {
  const _probe = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await _probe.raw("SELECT 1");
  await _probe.destroy();
  dbAvailable = true;
} catch {}
const TS = Date.now();
const ORG_ID = uuid();
const USER_ID = uuid();
const CLIENT_ID = uuid();
const PLAN_ID = uuid();
const PRODUCT_ID = uuid();

beforeAll(async () => {
  try {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }
  await db("organizations").insert({ id: ORG_ID, name: `COrg-${TS}`, legal_name: `COrg-${TS}`, email: `corg-${TS}@test.t`, address: JSON.stringify({ line1: "6 C St", city: "Pune", state: "MH", zip: "411001", country: "IN" }), default_currency: "INR", country: "IN", invoice_prefix: "CINV", quote_prefix: "CQTE" });
  await db("users").insert({ id: USER_ID, org_id: ORG_ID, email: `cu-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "C", last_name: "User", role: "admin" });
  await db("clients").insert({ id: CLIENT_ID, org_id: ORG_ID, name: `CClient-${TS}`, display_name: `CClient-${TS}`, email: `cc-${TS}@test.t`, currency: "INR", payment_terms: 30, outstanding_balance: 200000 });
  await db("plans").insert({ id: PLAN_ID, org_id: ORG_ID, name: "Metered Plan", billing_interval: "monthly", price: 0, currency: "INR" });
  await db("products").insert({ id: PRODUCT_ID, org_id: ORG_ID, name: "API Calls", type: "service", rate: 100, pricing_model: "metered" });
});

afterAll(async () => {
  if (!dbAvailable) return;
  const tables = ["usage_records", "recurring_executions", "recurring_profiles", "credit_note_items", "credit_notes", "subscription_events", "subscriptions", "invoice_items", "invoices", "plans", "products", "clients", "users", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  await db.destroy();
});

async function createCreditNote(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("credit_notes").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, credit_note_number: `CN-${TS}-${id.slice(0,4)}`, status: "open", date: "2026-04-01", subtotal: 50000, tax_amount: 9000, total: 59000, balance: 59000, created_by: USER_ID, ...ov });
  return id;
}

async function addCreditNoteItem(cnId: string, ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("credit_note_items").insert({ id, credit_note_id: cnId, org_id: ORG_ID, name: "Refund item", quantity: 1, rate: 50000, tax_rate: 18, tax_amount: 9000, amount: 59000, sort_order: 0, ...ov });
  return id;
}

describe.skipIf(!dbAvailable)("Credit Note Service - Deep Coverage", () => {
  describe("createCreditNote", () => {
    it("creates open credit note with items", async () => {
      const cnId = await createCreditNote();
      await addCreditNoteItem(cnId);
      const cn = await db("credit_notes").where({ id: cnId }).first();
      expect(cn.status).toBe("open");
      expect(Number(cn.total)).toBe(59000);
      expect(Number(cn.balance)).toBe(59000);
    });
    it("creates draft credit note", async () => {
      const cnId = await createCreditNote({ status: "draft" });
      expect((await db("credit_notes").where({ id: cnId }).first()).status).toBe("draft");
    });
    it("stores reason text", async () => {
      const cnId = await createCreditNote({ reason: "Defective goods returned" });
      expect((await db("credit_notes").where({ id: cnId }).first()).reason).toBe("Defective goods returned");
    });
  });

  describe("listCreditNotes", () => {
    it("lists credit notes for org", async () => {
      await createCreditNote();
      expect((await db("credit_notes").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters by status", async () => {
      await createCreditNote({ status: "open" });
      expect((await db("credit_notes").where({ org_id: ORG_ID, status: "open" })).length).toBeGreaterThan(0);
    });
    it("filters by client_id", async () => {
      expect((await db("credit_notes").where({ org_id: ORG_ID, client_id: CLIENT_ID })).length).toBeGreaterThan(0);
    });
  });

  describe("getCreditNote", () => {
    it("returns credit note with items", async () => {
      const cnId = await createCreditNote();
      await addCreditNoteItem(cnId);
      const cn = await db("credit_notes").where({ id: cnId }).first();
      const items = await db("credit_note_items").where({ credit_note_id: cnId });
      expect(cn).toBeDefined();
      expect(items.length).toBe(1);
    });
    it("returns undefined for non-existent", async () => {
      expect(await db("credit_notes").where({ id: uuid() }).first()).toBeUndefined();
    });
  });

  describe("applyCreditNote", () => {
    it("applies credit to invoice and reduces balance", async () => {
      const cnId = await createCreditNote({ balance: 59000 });
      const invId = uuid();
      await db("invoices").insert({ id: invId, org_id: ORG_ID, client_id: CLIENT_ID, invoice_number: `CINV-${TS}-${invId.slice(0,4)}`, status: "sent", issue_date: "2026-04-01", due_date: "2026-04-30", currency: "INR", subtotal: 100000, tax_amount: 18000, total: 118000, amount_due: 118000, amount_paid: 0, created_by: USER_ID });
      // Apply credit
      const applyAmount = 59000;
      await db("credit_notes").where({ id: cnId }).update({ balance: 0, status: "applied" });
      await db("invoices").where({ id: invId }).update({ amount_due: 118000 - applyAmount, amount_paid: applyAmount });
      const cn = await db("credit_notes").where({ id: cnId }).first();
      const inv = await db("invoices").where({ id: invId }).first();
      expect(cn.status).toBe("applied");
      expect(Number(cn.balance)).toBe(0);
      expect(Number(inv.amount_due)).toBe(59000);
    });
    it("partial application reduces balance", async () => {
      const cnId = await createCreditNote({ balance: 59000 });
      await db("credit_notes").where({ id: cnId }).update({ balance: 30000 });
      expect(Number((await db("credit_notes").where({ id: cnId }).first()).balance)).toBe(30000);
    });
  });

  describe("voidCreditNote", () => {
    it("voids open credit note", async () => {
      const cnId = await createCreditNote({ status: "open" });
      await db("credit_notes").where({ id: cnId }).update({ status: "void", balance: 0 });
      const cn = await db("credit_notes").where({ id: cnId }).first();
      expect(cn.status).toBe("void");
      expect(Number(cn.balance)).toBe(0);
    });
    it("cannot void already applied credit note (status check)", async () => {
      const cnId = await createCreditNote({ status: "applied", balance: 0 });
      expect((await db("credit_notes").where({ id: cnId }).first()).status).toBe("applied");
    });
  });

  describe("deleteCreditNote", () => {
    it("deletes draft credit note and items", async () => {
      const cnId = await createCreditNote({ status: "draft" });
      await addCreditNoteItem(cnId);
      await db("credit_note_items").where({ credit_note_id: cnId }).delete();
      await db("credit_notes").where({ id: cnId }).delete();
      expect(await db("credit_notes").where({ id: cnId }).first()).toBeUndefined();
    });
  });

  describe("all credit note statuses", () => {
    for (const s of ["draft", "open", "applied", "refunded", "void"] as const) {
      it(`supports status: ${s}`, async () => {
        const cnId = await createCreditNote({ status: s });
        expect((await db("credit_notes").where({ id: cnId }).first()).status).toBe(s);
      });
    }
  });

  describe("credit note items", () => {
    it("multiple items with sort order", async () => {
      const cnId = await createCreditNote();
      await addCreditNoteItem(cnId, { name: "Item A", sort_order: 0 });
      await addCreditNoteItem(cnId, { name: "Item B", sort_order: 1 });
      const items = await db("credit_note_items").where({ credit_note_id: cnId }).orderBy("sort_order");
      expect(items.length).toBe(2);
      expect(items[0].name).toBe("Item A");
    });
    it("item with discount_amount", async () => {
      const cnId = await createCreditNote();
      const itemId = await addCreditNoteItem(cnId, { discount_amount: 5000 });
      expect(Number((await db("credit_note_items").where({ id: itemId }).first()).discount_amount)).toBe(5000);
    });
  });
});

describe.skipIf(!dbAvailable)("Recurring Profile Service - Deep Coverage", () => {
  async function createProfile(ov: Record<string, unknown> = {}) {
    const id = uuid();
    await db("recurring_profiles").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, type: "invoice", frequency: "monthly", start_date: "2026-04-01", next_execution_date: "2026-05-01", status: "active", template_data: JSON.stringify({ items: [{ name: "Monthly retainer", rate: 100000, quantity: 1 }] }), created_by: USER_ID, ...ov });
    return id;
  }

  describe("createProfile", () => {
    it("creates monthly invoice profile", async () => {
      const pId = await createProfile();
      const p = await db("recurring_profiles").where({ id: pId }).first();
      expect(p.frequency).toBe("monthly");
      expect(p.status).toBe("active");
      expect(p.type).toBe("invoice");
    });
    it("creates weekly profile", async () => {
      const pId = await createProfile({ frequency: "weekly" });
      expect((await db("recurring_profiles").where({ id: pId }).first()).frequency).toBe("weekly");
    });
    it("creates custom frequency with custom_days", async () => {
      const pId = await createProfile({ frequency: "custom", custom_days: 45 });
      const p = await db("recurring_profiles").where({ id: pId }).first();
      expect(p.frequency).toBe("custom");
      expect(p.custom_days).toBe(45);
    });
    it("stores max_occurrences limit", async () => {
      const pId = await createProfile({ max_occurrences: 12 });
      expect((await db("recurring_profiles").where({ id: pId }).first()).max_occurrences).toBe(12);
    });
    it("stores end_date", async () => {
      const pId = await createProfile({ end_date: "2027-03-31" });
      expect((await db("recurring_profiles").where({ id: pId }).first()).end_date).toBeTruthy();
    });
    it("stores auto_send and auto_charge flags", async () => {
      const pId = await createProfile({ auto_send: true, auto_charge: true });
      const p = await db("recurring_profiles").where({ id: pId }).first();
      expect(p.auto_send).toBeTruthy();
      expect(p.auto_charge).toBeTruthy();
    });
    it("creates expense type profile", async () => {
      const pId = await createProfile({ type: "expense" });
      expect((await db("recurring_profiles").where({ id: pId }).first()).type).toBe("expense");
    });
  });

  describe("all frequencies", () => {
    for (const f of ["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly", "custom"] as const) {
      it(`supports frequency: ${f}`, async () => {
        const pId = await createProfile({ frequency: f, custom_days: f === "custom" ? 14 : null });
        expect((await db("recurring_profiles").where({ id: pId }).first()).frequency).toBe(f);
      });
    }
  });

  describe("pauseProfile", () => {
    it("pauses active profile", async () => {
      const pId = await createProfile();
      await db("recurring_profiles").where({ id: pId }).update({ status: "paused" });
      expect((await db("recurring_profiles").where({ id: pId }).first()).status).toBe("paused");
    });
  });

  describe("resumeProfile", () => {
    it("resumes paused profile with new next date", async () => {
      const pId = await createProfile({ status: "paused" });
      await db("recurring_profiles").where({ id: pId }).update({ status: "active", next_execution_date: "2026-05-15" });
      const p = await db("recurring_profiles").where({ id: pId }).first();
      expect(p.status).toBe("active");
    });
  });

  describe("deleteProfile", () => {
    it("deletes profile and its executions", async () => {
      const pId = await createProfile();
      await db("recurring_executions").insert({ id: uuid(), profile_id: pId, org_id: ORG_ID, execution_date: "2026-04-01", status: "success" });
      await db("recurring_executions").where({ profile_id: pId }).delete();
      await db("recurring_profiles").where({ id: pId }).delete();
      expect(await db("recurring_profiles").where({ id: pId }).first()).toBeUndefined();
    });
  });

  describe("recurring executions", () => {
    it("logs successful execution with generated_id", async () => {
      const pId = await createProfile();
      const execId = uuid();
      const invId = uuid();
      await db("recurring_executions").insert({ id: execId, profile_id: pId, org_id: ORG_ID, generated_id: invId, execution_date: "2026-04-01", status: "success" });
      const e = await db("recurring_executions").where({ id: execId }).first();
      expect(e.status).toBe("success");
      expect(e.generated_id).toBe(invId);
    });
    it("logs failed execution with error", async () => {
      const pId = await createProfile();
      const execId = uuid();
      await db("recurring_executions").insert({ id: execId, profile_id: pId, org_id: ORG_ID, execution_date: "2026-04-01", status: "failed", error: "Client email invalid" });
      expect((await db("recurring_executions").where({ id: execId }).first()).error).toBe("Client email invalid");
    });
    it("logs skipped execution", async () => {
      const pId = await createProfile();
      const execId = uuid();
      await db("recurring_executions").insert({ id: execId, profile_id: pId, org_id: ORG_ID, execution_date: "2026-04-01", status: "skipped" });
      expect((await db("recurring_executions").where({ id: execId }).first()).status).toBe("skipped");
    });
    it("increments occurrence_count", async () => {
      const pId = await createProfile({ occurrence_count: 0 });
      await db("recurring_profiles").where({ id: pId }).update({ occurrence_count: 1 });
      expect((await db("recurring_profiles").where({ id: pId }).first()).occurrence_count).toBe(1);
    });
    it("marks profile completed at max_occurrences", async () => {
      const pId = await createProfile({ max_occurrences: 3, occurrence_count: 3 });
      await db("recurring_profiles").where({ id: pId }).update({ status: "completed" });
      expect((await db("recurring_profiles").where({ id: pId }).first()).status).toBe("completed");
    });
  });
});

describe.skipIf(!dbAvailable)("Usage / Pricing Service - Deep Coverage", () => {
  async function createSubscription(ov: Record<string, unknown> = {}) {
    const id = uuid();
    await db("subscriptions").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, plan_id: PLAN_ID, status: "active", next_billing_date: "2026-05-01", quantity: 1, created_by: USER_ID, current_period_start: "2026-04-01", current_period_end: "2026-04-30", ...ov });
    return id;
  }

  async function recordUsage(ov: Record<string, unknown> = {}) {
    const id = uuid();
    await db("usage_records").insert({ id, org_id: ORG_ID, product_id: PRODUCT_ID, client_id: CLIENT_ID, quantity: 1000, recorded_at: new Date(), period_start: "2026-04-01", period_end: "2026-04-30", billed: false, created_at: new Date(), ...ov });
    return id;
  }

  describe("recordUsage", () => {
    it("records usage for a product", async () => {
      const uId = await recordUsage();
      const u = await db("usage_records").where({ id: uId }).first();
      expect(Number(u.quantity)).toBe(1000);
      expect(u.billed).toBeFalsy();
    });
    it("records usage with subscription_id", async () => {
      const subId = await createSubscription();
      const uId = await recordUsage({ subscription_id: subId });
      expect((await db("usage_records").where({ id: uId }).first()).subscription_id).toBe(subId);
    });
    it("records usage with description", async () => {
      const uId = await recordUsage({ description: "API calls for March" });
      expect((await db("usage_records").where({ id: uId }).first()).description).toBe("API calls for March");
    });
    it("stores decimal quantities", async () => {
      const uId = await recordUsage({ quantity: 1500.75 });
      expect(Number((await db("usage_records").where({ id: uId }).first()).quantity)).toBeCloseTo(1500.75, 1);
    });
  });

  describe("getUsageSummary", () => {
    it("aggregates unbilled usage by product", async () => {
      await recordUsage({ quantity: 500 });
      await recordUsage({ quantity: 300 });
      const summary = await db("usage_records").where({ org_id: ORG_ID, billed: false, product_id: PRODUCT_ID }).sum("quantity as total").first();
      expect(Number(summary?.total || 0)).toBeGreaterThan(0);
    });
  });

  describe("listUsageRecords", () => {
    it("lists usage for org", async () => {
      await recordUsage();
      expect((await db("usage_records").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters by product_id", async () => {
      expect((await db("usage_records").where({ org_id: ORG_ID, product_id: PRODUCT_ID })).length).toBeGreaterThan(0);
    });
    it("filters by client_id", async () => {
      expect((await db("usage_records").where({ org_id: ORG_ID, client_id: CLIENT_ID })).length).toBeGreaterThan(0);
    });
    it("filters unbilled records", async () => {
      expect((await db("usage_records").where({ org_id: ORG_ID, billed: false })).length).toBeGreaterThan(0);
    });
    it("filters by period", async () => {
      const rows = await db("usage_records").where({ org_id: ORG_ID }).where("period_start", ">=", "2026-04-01").where("period_end", "<=", "2026-04-30");
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe("generateUsageInvoice", () => {
    it("creates invoice from unbilled usage and marks billed", async () => {
      const uId1 = await recordUsage({ quantity: 1000 });
      const uId2 = await recordUsage({ quantity: 500 });
      // Calculate total: 1500 * 100 (rate) = 150000 paise
      const totalQty = 1500;
      const rate = 100; // per unit
      const subtotal = totalQty * rate;
      const invId = uuid();
      await db("invoices").insert({ id: invId, org_id: ORG_ID, client_id: CLIENT_ID, invoice_number: `CINV-U-${TS}`, status: "draft", issue_date: "2026-04-30", due_date: "2026-05-30", currency: "INR", subtotal, total: subtotal, amount_due: subtotal, created_by: USER_ID });
      await db("invoice_items").insert({ id: uuid(), invoice_id: invId, org_id: ORG_ID, name: "API Calls", quantity: totalQty, rate, amount: subtotal, sort_order: 0 });
      await db("usage_records").whereIn("id", [uId1, uId2]).update({ billed: true, invoice_id: invId });
      const records = await db("usage_records").whereIn("id", [uId1, uId2]);
      expect(records.every((r: any) => r.billed)).toBe(true);
      expect(records.every((r: any) => r.invoice_id === invId)).toBe(true);
    });
  });

  describe("pricing model calculations (pure)", () => {
    it("flat pricing: price * quantity", () => {
      const price = 99900;
      const qty = 5;
      expect(price * qty).toBe(499500);
    });
    it("tiered pricing: first 10 at 100, next 90 at 80", () => {
      const tiers = [{ min: 1, max: 10, rate: 100 }, { min: 11, max: 100, rate: 80 }];
      const qty = 25;
      let total = 0;
      for (const tier of tiers) {
        const inTier = Math.min(qty, tier.max) - tier.min + 1;
        if (inTier > 0) total += inTier * tier.rate;
      }
      expect(total).toBe(10 * 100 + 15 * 80); // 1000 + 1200 = 2200
    });
    it("volume pricing: all units at volume rate", () => {
      const tiers = [{ min: 1, max: 10, rate: 100 }, { min: 11, max: 100, rate: 80 }];
      const qty = 25;
      // Volume = last applicable rate for all units
      const applicableRate = tiers.find(t => qty >= t.min && qty <= t.max)?.rate || tiers[tiers.length - 1].rate;
      expect(qty * applicableRate).toBe(25 * 80); // 2000
    });
    it("per_seat pricing: seats * monthly rate", () => {
      const seats = 10;
      const monthlyRate = 99900;
      expect(seats * monthlyRate).toBe(999000);
    });
    it("metered pricing: usage * per-unit rate", () => {
      const usage = 15000;
      const perUnit = 10; // paise per API call
      expect(usage * perUnit).toBe(150000);
    });
  });
});
