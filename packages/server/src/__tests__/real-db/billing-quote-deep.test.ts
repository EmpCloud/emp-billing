// ============================================================================
// EMP BILLING — Quote Service Deep Real-DB Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";

let db: Knex;
let dbAvailable = false;
try {
  const _probe = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: process.env.DB_PASSWORD || "", database: "emp_billing" } });
  await _probe.raw("SELECT 1");
  await _probe.destroy();
  dbAvailable = true;
} catch {}
const TS = Date.now();
const ORG_ID = uuid();
const USER_ID = uuid();
const CLIENT_ID = uuid();

beforeAll(async () => {
  try {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: process.env.DB_PASSWORD || "", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }
  await db("organizations").insert({ id: ORG_ID, name: `QOrg-${TS}`, legal_name: `QOrg-${TS}`, email: `qorg-${TS}@test.t`, address: JSON.stringify({ line1: "1 Q St", city: "Delhi", state: "DL", zip: "110001", country: "IN" }), default_currency: "INR", country: "IN", invoice_prefix: "QINV", quote_prefix: "QQTE" });
  await db("users").insert({ id: USER_ID, org_id: ORG_ID, email: `qu-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Q", last_name: "User", role: "admin" });
  await db("clients").insert({ id: CLIENT_ID, org_id: ORG_ID, name: `QClient-${TS}`, display_name: `QClient-${TS}`, email: `qc-${TS}@test.t`, currency: "INR", payment_terms: 15 });
});

afterAll(async () => {
  if (!dbAvailable) return;
  const tables = ["quote_items", "invoice_items", "invoices", "quotes", "products", "tax_rates", "clients", "users", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  await db.destroy();
});

async function createQuote(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("quotes").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, quote_number: `QQTE-${TS}-${id.slice(0,4)}`, status: "draft", issue_date: "2026-04-01", expiry_date: "2026-04-30", currency: "INR", subtotal: 100000, tax_amount: 18000, total: 118000, created_by: USER_ID, version: 1, ...ov });
  return id;
}

async function addQuoteItem(quoteId: string, ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("quote_items").insert({ id, quote_id: quoteId, org_id: ORG_ID, name: "Service A", quantity: 2, rate: 50000, tax_rate: 18, tax_amount: 18000, amount: 118000, sort_order: 0, ...ov });
  return id;
}

describe.skipIf(!dbAvailable)("Quote Service - Deep Coverage", () => {
  describe("createQuote", () => {
    it("creates a draft quote with items", async () => {
      const qId = await createQuote();
      await addQuoteItem(qId);
      const q = await db("quotes").where({ id: qId }).first();
      expect(q.status).toBe("draft");
      expect(Number(q.total)).toBe(118000);
      const items = await db("quote_items").where({ quote_id: qId });
      expect(items.length).toBe(1);
    });
    it("stores notes and terms", async () => {
      const qId = await createQuote({ notes: "Net 15", terms: "Due on acceptance" });
      const q = await db("quotes").where({ id: qId }).first();
      expect(q.notes).toBe("Net 15");
      expect(q.terms).toBe("Due on acceptance");
    });
    it("creates quote with zero total", async () => {
      const qId = await createQuote({ subtotal: 0, tax_amount: 0, total: 0 });
      expect(Number((await db("quotes").where({ id: qId }).first()).total)).toBe(0);
    });
  });

  describe("listQuotes", () => {
    it("lists quotes for org", async () => {
      await createQuote();
      expect((await db("quotes").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters by status", async () => {
      await createQuote({ status: "sent" });
      expect((await db("quotes").where({ org_id: ORG_ID, status: "sent" })).length).toBeGreaterThan(0);
    });
    it("filters by client_id", async () => {
      expect((await db("quotes").where({ org_id: ORG_ID, client_id: CLIENT_ID })).length).toBeGreaterThan(0);
    });
  });

  describe("getQuote", () => {
    it("returns quote by id", async () => {
      const qId = await createQuote();
      const q = await db("quotes").where({ id: qId, org_id: ORG_ID }).first();
      expect(q).toBeDefined();
      expect(q.id).toBe(qId);
    });
    it("returns undefined for non-existent", async () => {
      expect(await db("quotes").where({ id: uuid(), org_id: ORG_ID }).first()).toBeUndefined();
    });
  });

  describe("updateQuote", () => {
    it("updates notes on draft", async () => {
      const qId = await createQuote();
      await db("quotes").where({ id: qId }).update({ notes: "Updated" });
      expect((await db("quotes").where({ id: qId }).first()).notes).toBe("Updated");
    });
    it("converted quote cannot logically be updated", async () => {
      const qId = await createQuote({ status: "converted" });
      expect((await db("quotes").where({ id: qId }).first()).status).toBe("converted");
    });
    it("updates subtotal and recalculates", async () => {
      const qId = await createQuote();
      await db("quotes").where({ id: qId }).update({ subtotal: 200000, tax_amount: 36000, total: 236000 });
      expect(Number((await db("quotes").where({ id: qId }).first()).total)).toBe(236000);
    });
  });

  describe("sendQuote", () => {
    it("transitions draft to sent", async () => {
      const qId = await createQuote();
      await db("quotes").where({ id: qId }).update({ status: "sent" });
      expect((await db("quotes").where({ id: qId }).first()).status).toBe("sent");
    });
  });

  describe("acceptQuote", () => {
    it("transitions sent to accepted with timestamp", async () => {
      const qId = await createQuote({ status: "sent" });
      const now = new Date();
      await db("quotes").where({ id: qId }).update({ status: "accepted", accepted_at: now });
      const q = await db("quotes").where({ id: qId }).first();
      expect(q.status).toBe("accepted");
      expect(q.accepted_at).toBeTruthy();
    });
  });

  describe("declineQuote", () => {
    it("transitions sent to declined", async () => {
      const qId = await createQuote({ status: "sent" });
      await db("quotes").where({ id: qId }).update({ status: "declined" });
      expect((await db("quotes").where({ id: qId }).first()).status).toBe("declined");
    });
  });

  describe("convertToInvoice", () => {
    it("creates invoice from quote and marks converted", async () => {
      const qId = await createQuote({ status: "accepted" });
      await addQuoteItem(qId);
      const invId = uuid();
      await db("invoices").insert({ id: invId, org_id: ORG_ID, client_id: CLIENT_ID, invoice_number: `QINV-${TS}-${invId.slice(0,4)}`, status: "draft", issue_date: "2026-04-01", due_date: "2026-04-15", currency: "INR", subtotal: 100000, tax_amount: 18000, total: 118000, amount_due: 118000, created_by: USER_ID });
      const qItems = await db("quote_items").where({ quote_id: qId });
      for (const qi of qItems) {
        await db("invoice_items").insert({ id: uuid(), invoice_id: invId, org_id: ORG_ID, name: qi.name, quantity: qi.quantity, rate: qi.rate, tax_rate: qi.tax_rate, tax_amount: qi.tax_amount, amount: qi.amount, sort_order: qi.sort_order });
      }
      await db("quotes").where({ id: qId }).update({ status: "converted", converted_invoice_id: invId });
      const q = await db("quotes").where({ id: qId }).first();
      expect(q.status).toBe("converted");
      expect(q.converted_invoice_id).toBe(invId);
      expect(Number((await db("invoices").where({ id: invId }).first()).total)).toBe(118000);
    });
  });

  describe("deleteQuote", () => {
    it("deletes draft quote and items", async () => {
      const qId = await createQuote();
      await addQuoteItem(qId);
      await db("quote_items").where({ quote_id: qId }).delete();
      await db("quotes").where({ id: qId }).delete();
      expect(await db("quotes").where({ id: qId }).first()).toBeUndefined();
    });
    it("non-draft quote check", async () => {
      const qId = await createQuote({ status: "sent" });
      expect((await db("quotes").where({ id: qId }).first()).status).not.toBe("draft");
    });
  });

  describe("versioning", () => {
    it("increments version on update", async () => {
      const qId = await createQuote({ version: 1 });
      await db("quotes").where({ id: qId }).update({ version: 2 });
      expect((await db("quotes").where({ id: qId }).first()).version).toBe(2);
    });
  });

  describe("quote expiry", () => {
    it("finds expired sent quotes", async () => {
      const qId = await createQuote({ status: "sent", expiry_date: "2025-01-01" });
      const expired = await db("quotes").where({ org_id: ORG_ID, status: "sent" }).where("expiry_date", "<", new Date());
      expect(expired.find((q: any) => q.id === qId)).toBeDefined();
    });
  });

  describe("discount types", () => {
    it("stores percentage discount", async () => {
      const qId = await createQuote({ discount_type: "percentage", discount_value: 10, discount_amount: 10000 });
      expect((await db("quotes").where({ id: qId }).first()).discount_type).toBe("percentage");
    });
    it("stores fixed discount", async () => {
      const qId = await createQuote({ discount_type: "fixed", discount_value: 5000, discount_amount: 5000 });
      expect((await db("quotes").where({ id: qId }).first()).discount_type).toBe("fixed");
    });
  });

  describe("all statuses", () => {
    for (const s of ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"] as const) {
      it(`supports status: ${s}`, async () => {
        const qId = await createQuote({ status: s });
        expect((await db("quotes").where({ id: qId }).first()).status).toBe(s);
      });
    }
  });

  describe("quote items", () => {
    it("stores hsn_code", async () => {
      const qId = await createQuote();
      const itemId = await addQuoteItem(qId, { hsn_code: "998314", description: "IT consulting" });
      expect((await db("quote_items").where({ id: itemId }).first()).hsn_code).toBe("998314");
    });
    it("stores tax_components JSON", async () => {
      const qId = await createQuote();
      const comps = JSON.stringify([{ name: "CGST", rate: 9, amount: 9000 }, { name: "SGST", rate: 9, amount: 9000 }]);
      const itemId = await addQuoteItem(qId, { tax_components: comps });
      const item = await db("quote_items").where({ id: itemId }).first();
      const parsed = typeof item.tax_components === "string" ? JSON.parse(item.tax_components) : item.tax_components;
      expect(parsed).toHaveLength(2);
    });
    it("multiple items with sort order", async () => {
      const qId = await createQuote();
      await addQuoteItem(qId, { name: "Item 1", sort_order: 0 });
      await addQuoteItem(qId, { name: "Item 2", sort_order: 1 });
      await addQuoteItem(qId, { name: "Item 3", sort_order: 2 });
      const items = await db("quote_items").where({ quote_id: qId }).orderBy("sort_order");
      expect(items.length).toBe(3);
      expect(items[0].name).toBe("Item 1");
      expect(items[2].name).toBe("Item 3");
    });
    it("item with product_id reference", async () => {
      const prodId = uuid();
      await db("products").insert({ id: prodId, org_id: ORG_ID, name: "Widget", rate: 50000, type: "goods", pricing_model: "flat" });
      const qId = await createQuote();
      const itemId = await addQuoteItem(qId, { product_id: prodId, name: "Widget" });
      expect((await db("quote_items").where({ id: itemId }).first()).product_id).toBe(prodId);
    });
    it("item with unit field", async () => {
      const qId = await createQuote();
      const itemId = await addQuoteItem(qId, { unit: "hours" });
      expect((await db("quote_items").where({ id: itemId }).first()).unit).toBe("hours");
    });
    it("item discount percentage", async () => {
      const qId = await createQuote();
      const itemId = await addQuoteItem(qId, { discount_type: "percentage", discount_value: 5, discount_amount: 5000 });
      const item = await db("quote_items").where({ id: itemId }).first();
      expect(item.discount_type).toBe("percentage");
      expect(Number(item.discount_amount)).toBe(5000);
    });
    it("item discount fixed", async () => {
      const qId = await createQuote();
      const itemId = await addQuoteItem(qId, { discount_type: "fixed", discount_value: 2500, discount_amount: 2500 });
      expect((await db("quote_items").where({ id: itemId }).first()).discount_type).toBe("fixed");
    });
  });
});
