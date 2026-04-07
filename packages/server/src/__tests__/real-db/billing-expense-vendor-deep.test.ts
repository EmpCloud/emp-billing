// ============================================================================
// EMP BILLING — Expense & Vendor Service Deep Real-DB Tests
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
const CAT_ID = uuid();

beforeAll(async () => {
  try {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }
  await db("organizations").insert({ id: ORG_ID, name: `EOrg-${TS}`, legal_name: `EOrg-${TS}`, email: `eorg-${TS}@test.t`, address: JSON.stringify({ line1: "2 E St", city: "Mumbai", state: "MH", zip: "400001", country: "IN" }), default_currency: "INR", country: "IN", invoice_prefix: "EINV", quote_prefix: "EQTE" });
  await db("users").insert({ id: USER_ID, org_id: ORG_ID, email: `eu-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "E", last_name: "User", role: "admin" });
  await db("clients").insert({ id: CLIENT_ID, org_id: ORG_ID, name: `EClient-${TS}`, display_name: `EClient-${TS}`, email: `ec-${TS}@test.t`, currency: "INR", payment_terms: 30 });
  await db("expense_categories").insert({ id: CAT_ID, org_id: ORG_ID, name: "Travel", description: "Travel expenses" });
});

afterAll(async () => {
  if (!dbAvailable) return;
  const tables = ["invoice_items", "invoices", "expenses", "expense_categories", "vendors", "clients", "users", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  await db.destroy();
});

async function createExpense(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("expenses").insert({ id, org_id: ORG_ID, category_id: CAT_ID, date: "2026-04-01", amount: 500000, currency: "INR", description: "Flight tickets", status: "pending", created_by: USER_ID, ...ov });
  return id;
}

async function createVendor(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("vendors").insert({ id, org_id: ORG_ID, name: `Vendor-${TS}-${id.slice(0,4)}`, ...ov });
  return id;
}

describe.skipIf(!dbAvailable)("Expense Service - Deep Coverage", () => {
  describe("createExpense", () => {
    it("creates pending expense with required fields", async () => {
      const eId = await createExpense();
      const e = await db("expenses").where({ id: eId }).first();
      expect(e.status).toBe("pending");
      expect(Number(e.amount)).toBe(500000);
      expect(e.category_id).toBe(CAT_ID);
    });
    it("creates expense with tax_amount", async () => {
      const eId = await createExpense({ tax_amount: 90000 });
      expect(Number((await db("expenses").where({ id: eId }).first()).tax_amount)).toBe(90000);
    });
    it("creates billable expense linked to client", async () => {
      const eId = await createExpense({ is_billable: true, client_id: CLIENT_ID });
      const e = await db("expenses").where({ id: eId }).first();
      expect(e.is_billable).toBeTruthy();
      expect(e.client_id).toBe(CLIENT_ID);
    });
    it("stores receipt_url", async () => {
      const eId = await createExpense({ receipt_url: "https://storage.example.com/receipt.pdf" });
      expect((await db("expenses").where({ id: eId }).first()).receipt_url).toBe("https://storage.example.com/receipt.pdf");
    });
    it("stores tags as JSON", async () => {
      const eId = await createExpense({ tags: JSON.stringify(["domestic", "flight"]) });
      const e = await db("expenses").where({ id: eId }).first();
      const tags = typeof e.tags === "string" ? JSON.parse(e.tags) : e.tags;
      expect(tags).toContain("domestic");
    });
    it("stores vendor_name and vendor_id", async () => {
      const vId = await createVendor();
      const eId = await createExpense({ vendor_name: "AirIndia", vendor_id: vId });
      const e = await db("expenses").where({ id: eId }).first();
      expect(e.vendor_name).toBe("AirIndia");
      expect(e.vendor_id).toBe(vId);
    });
    it("stores mileage fields", async () => {
      const eId = await createExpense({ distance: 45.5, mileage_rate: 800 });
      const e = await db("expenses").where({ id: eId }).first();
      expect(Number(e.distance)).toBeCloseTo(45.5, 1);
      expect(Number(e.mileage_rate)).toBe(800);
    });
  });

  describe("listExpenses", () => {
    it("lists expenses for org", async () => {
      await createExpense();
      expect((await db("expenses").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters by status", async () => {
      await createExpense({ status: "approved" });
      expect((await db("expenses").where({ org_id: ORG_ID, status: "approved" })).length).toBeGreaterThan(0);
    });
    it("filters by category_id", async () => {
      expect((await db("expenses").where({ org_id: ORG_ID, category_id: CAT_ID })).length).toBeGreaterThan(0);
    });
    it("filters by client_id", async () => {
      await createExpense({ client_id: CLIENT_ID, is_billable: true });
      expect((await db("expenses").where({ org_id: ORG_ID, client_id: CLIENT_ID })).length).toBeGreaterThan(0);
    });
    it("filters by date range", async () => {
      const rows = await db("expenses").where({ org_id: ORG_ID }).whereBetween("date", ["2026-04-01", "2026-04-30"]);
      expect(rows.length).toBeGreaterThan(0);
    });
    it("filters by is_billable", async () => {
      await createExpense({ is_billable: true });
      expect((await db("expenses").where({ org_id: ORG_ID, is_billable: true })).length).toBeGreaterThan(0);
    });
  });

  describe("getExpense", () => {
    it("returns expense by id", async () => {
      const eId = await createExpense();
      expect((await db("expenses").where({ id: eId }).first()).id).toBe(eId);
    });
    it("returns undefined for non-existent", async () => {
      expect(await db("expenses").where({ id: uuid(), org_id: ORG_ID }).first()).toBeUndefined();
    });
  });

  describe("updateExpense", () => {
    it("updates amount and description", async () => {
      const eId = await createExpense();
      await db("expenses").where({ id: eId }).update({ amount: 750000, description: "Business class flight" });
      const e = await db("expenses").where({ id: eId }).first();
      expect(Number(e.amount)).toBe(750000);
      expect(e.description).toBe("Business class flight");
    });
  });

  describe("approveExpense", () => {
    it("transitions pending to approved", async () => {
      const eId = await createExpense();
      await db("expenses").where({ id: eId }).update({ status: "approved", approved_by: USER_ID });
      const e = await db("expenses").where({ id: eId }).first();
      expect(e.status).toBe("approved");
      expect(e.approved_by).toBe(USER_ID);
    });
  });

  describe("rejectExpense", () => {
    it("transitions pending to rejected", async () => {
      const eId = await createExpense();
      await db("expenses").where({ id: eId }).update({ status: "rejected" });
      expect((await db("expenses").where({ id: eId }).first()).status).toBe("rejected");
    });
  });

  describe("billExpenseToClient", () => {
    it("creates invoice from billable expense", async () => {
      const eId = await createExpense({ is_billable: true, client_id: CLIENT_ID, status: "approved" });
      const invId = uuid();
      await db("invoices").insert({ id: invId, org_id: ORG_ID, client_id: CLIENT_ID, invoice_number: `EINV-${TS}-${invId.slice(0,4)}`, status: "draft", issue_date: "2026-04-01", due_date: "2026-04-30", currency: "INR", subtotal: 500000, total: 500000, amount_due: 500000, created_by: USER_ID });
      await db("invoice_items").insert({ id: uuid(), invoice_id: invId, org_id: ORG_ID, name: "Flight tickets", quantity: 1, rate: 500000, amount: 500000 });
      await db("expenses").where({ id: eId }).update({ status: "billed", invoice_id: invId });
      const e = await db("expenses").where({ id: eId }).first();
      expect(e.status).toBe("billed");
      expect(e.invoice_id).toBe(invId);
    });
  });

  describe("deleteExpense", () => {
    it("deletes pending expense", async () => {
      const eId = await createExpense();
      await db("expenses").where({ id: eId }).delete();
      expect(await db("expenses").where({ id: eId }).first()).toBeUndefined();
    });
  });

  describe("all expense statuses", () => {
    for (const s of ["pending", "approved", "rejected", "billed", "paid"] as const) {
      it(`supports status: ${s}`, async () => {
        const eId = await createExpense({ status: s });
        expect((await db("expenses").where({ id: eId }).first()).status).toBe(s);
      });
    }
  });

  describe("expense categories", () => {
    it("creates category", async () => {
      const catId = uuid();
      await db("expense_categories").insert({ id: catId, org_id: ORG_ID, name: "Office Supplies" });
      expect((await db("expense_categories").where({ id: catId }).first()).name).toBe("Office Supplies");
    });
    it("lists categories for org", async () => {
      expect((await db("expense_categories").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("deactivates category", async () => {
      const catId = uuid();
      await db("expense_categories").insert({ id: catId, org_id: ORG_ID, name: "Temp Cat" });
      await db("expense_categories").where({ id: catId }).update({ is_active: false });
      expect((await db("expense_categories").where({ id: catId }).first()).is_active).toBeFalsy();
    });
  });
});

describe.skipIf(!dbAvailable)("Vendor Service - Deep Coverage", () => {
  describe("createVendor", () => {
    it("creates vendor with all fields", async () => {
      const vId = await createVendor({ email: `v-${TS}@test.t`, phone: "+911234567890", company: "VendorCo", tax_id: "GSTIN123", address_line1: "100 Main St", city: "Pune", state: "MH", postal_code: "411001", country: "IN", notes: "Preferred vendor" });
      const v = await db("vendors").where({ id: vId }).first();
      expect(v.email).toBe(`v-${TS}@test.t`);
      expect(v.company).toBe("VendorCo");
      expect(v.tax_id).toBe("GSTIN123");
      expect(v.city).toBe("Pune");
    });
    it("creates vendor with minimal fields", async () => {
      const vId = await createVendor();
      expect((await db("vendors").where({ id: vId }).first()).org_id).toBe(ORG_ID);
    });
  });

  describe("listVendors", () => {
    it("lists vendors for org", async () => {
      await createVendor();
      expect((await db("vendors").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters active vendors", async () => {
      await createVendor();
      expect((await db("vendors").where({ org_id: ORG_ID, is_active: true })).length).toBeGreaterThan(0);
    });
    it("searches by name", async () => {
      const vId = await createVendor({ name: `UniqueVendor-${TS}` });
      const rows = await db("vendors").where({ org_id: ORG_ID }).where("name", "like", `%UniqueVendor-${TS}%`);
      expect(rows.length).toBe(1);
    });
  });

  describe("getVendor", () => {
    it("returns vendor by id", async () => {
      const vId = await createVendor();
      expect((await db("vendors").where({ id: vId }).first()).id).toBe(vId);
    });
    it("returns undefined for non-existent", async () => {
      expect(await db("vendors").where({ id: uuid(), org_id: ORG_ID }).first()).toBeUndefined();
    });
  });

  describe("updateVendor", () => {
    it("updates vendor fields", async () => {
      const vId = await createVendor();
      await db("vendors").where({ id: vId }).update({ email: `updated-${TS}@test.t`, phone: "+919999999999" });
      const v = await db("vendors").where({ id: vId }).first();
      expect(v.email).toBe(`updated-${TS}@test.t`);
      expect(v.phone).toBe("+919999999999");
    });
  });

  describe("deleteVendor (deactivate)", () => {
    it("sets is_active false", async () => {
      const vId = await createVendor();
      await db("vendors").where({ id: vId }).update({ is_active: false });
      expect((await db("vendors").where({ id: vId }).first()).is_active).toBeFalsy();
    });
  });

  describe("vendor address fields", () => {
    it("stores full address", async () => {
      const vId = await createVendor({ address_line1: "42 MG Road", address_line2: "Suite 5", city: "Bangalore", state: "KA", postal_code: "560001", country: "IN" });
      const v = await db("vendors").where({ id: vId }).first();
      expect(v.address_line1).toBe("42 MG Road");
      expect(v.address_line2).toBe("Suite 5");
      expect(v.state).toBe("KA");
    });
  });
});
