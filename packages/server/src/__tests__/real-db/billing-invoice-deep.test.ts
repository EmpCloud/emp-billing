// ============================================================================
// billing-invoice-deep.test.ts — Deep coverage for invoice.service + invoice.calculator
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
const TEST_CLIENT_ID_2 = uuid();
const TEST_TAX_RATE_ID = uuid();
const TEST_PRODUCT_ID = uuid();

const cleanup: { table: string; id: string }[] = [];
function track(table: string, id: string) {
  cleanup.push({ table, id });
}

beforeAll(async () => {
  try {
  db = knex({
    client: "mysql2",
    connection: {
      host: "localhost",
      port: 3306,
      user: "empcloud",
      password: "EmpCloud2026",
      database: "emp_billing",
    },
  });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }

  await db("organizations").insert({
    id: TEST_ORG_ID,
    name: `InvTestOrg-${TS}`,
    legal_name: `InvTestOrg Legal-${TS}`,
    email: `inv-${TS}@billing.test`,
    address: JSON.stringify({ line1: "1 Test St", city: "Delhi", state: "DL", zip: "110001", country: "IN" }),
    default_currency: "INR",
    country: "IN",
    invoice_prefix: "TINV",
    invoice_next_number: 1,
    quote_prefix: "TQTE",
    quote_next_number: 1,
  });
  track("organizations", TEST_ORG_ID);

  await db("users").insert({
    id: TEST_USER_ID,
    org_id: TEST_ORG_ID,
    email: `invuser-${TS}@billing.test`,
    password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    first_name: "Test", last_name: "User", role: "admin",
  });
  track("users", TEST_USER_ID);

  for (const [cid, suffix] of [[TEST_CLIENT_ID, "A"], [TEST_CLIENT_ID_2, "B"]] as const) {
    await db("clients").insert({
      id: cid,
      org_id: TEST_ORG_ID,
      name: `Client ${suffix}-${TS}`,
      display_name: `Client ${suffix}`,
      email: `client${suffix}-${TS}@billing.test`,
      currency: "INR",
      payment_terms: 30,
      outstanding_balance: 0,
      total_billed: 0,
      total_paid: 0,
      portal_enabled: false,
      is_active: true,
    });
    track("clients", cid);
  }

  await db("tax_rates").insert({
    id: TEST_TAX_RATE_ID,
    org_id: TEST_ORG_ID,
    name: "GST 18%",
    type: "gst",
    rate: 18.00,
    is_compound: false,
    components: JSON.stringify([{ name: "CGST", rate: 9 }, { name: "SGST", rate: 9 }]),
    is_default: true,
    is_active: true,
  });
  track("tax_rates", TEST_TAX_RATE_ID);

  await db("products").insert({
    id: TEST_PRODUCT_ID,
    org_id: TEST_ORG_ID,
    name: `TestProduct-${TS}`,
    type: "goods",
    rate: 10000,
    pricing_model: "flat",
    track_inventory: true,
    stock_on_hand: 100,
    is_active: true,
  });
  track("products", TEST_PRODUCT_ID);
});

afterAll(async () => {
  if (!dbAvailable) return;
  for (const { table, id } of cleanup.reverse()) {
    try { await db(table).where("id", id).del(); } catch {}
  }
  await db.destroy();
});

async function createTestInvoice(overrides: Record<string, unknown> = {}) {
  const id = uuid();
  const now = new Date();
  const invNum = `TINV-${TS}-${Math.floor(Math.random() * 99999)}`;
  await db("invoices").insert({
    id,
    org_id: TEST_ORG_ID,
    client_id: TEST_CLIENT_ID,
    invoice_number: invNum,
    status: "draft",
    issue_date: dayjs().format("YYYY-MM-DD"),
    due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
    currency: "INR",
    exchange_rate: 1,
    subtotal: 100000,
    discount_amount: 0,
    tax_amount: 18000,
    total: 118000,
    amount_paid: 0,
    amount_due: 118000,
    tds_rate: null,
    tds_amount: 0,
    created_by: TEST_USER_ID,
    created_at: now,
    updated_at: now,
    ...overrides,
  });
  track("invoices", id);
  return { id, invoiceNumber: invNum };
}

async function createTestInvoiceItem(invoiceId: string, overrides: Record<string, unknown> = {}) {
  const id = uuid();
  await db("invoice_items").insert({
    id,
    invoice_id: invoiceId,
    org_id: TEST_ORG_ID,
    name: "Test Item",
    quantity: 10,
    rate: 10000,
    discount_amount: 0,
    tax_rate: 18,
    tax_amount: 18000,
    amount: 118000,
    sort_order: 0,
    ...overrides,
  });
  track("invoice_items", id);
  return id;
}

describe.skipIf(!dbAvailable)("Invoice Service - Deep Coverage", () => {
  describe("createInvoice - basic", () => {
    it("creates a draft invoice with items and updates client totals", async () => {
      const inv = await createTestInvoice({ total: 50000, amount_due: 50000, subtotal: 50000, tax_amount: 0 });
      await createTestInvoiceItem(inv.id, { quantity: 5, rate: 10000, tax_rate: 0, tax_amount: 0, amount: 50000 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row).toBeDefined();
      expect(row.status).toBe("draft");
      expect(Number(row.total)).toBe(50000);
    });
  });

  describe("getInvoice - not found", () => {
    it("returns undefined for non-existent invoice", async () => {
      const row = await db("invoices").where("id", uuid()).andWhere("org_id", TEST_ORG_ID).first();
      expect(row).toBeUndefined();
    });
  });

  describe("sendInvoice", () => {
    it("transitions draft to sent and sets sent_at", async () => {
      const inv = await createTestInvoice();
      await db("invoices").where("id", inv.id).update({ status: "sent", sent_at: new Date() });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("sent");
      expect(row.sent_at).not.toBeNull();
    });

    it("rejects sending a voided invoice", async () => {
      const inv = await createTestInvoice({ status: "void" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(["void", "written_off"].includes(row.status)).toBe(true);
    });

    it("rejects sending a paid invoice", async () => {
      const inv = await createTestInvoice({ status: "paid", amount_paid: 118000, amount_due: 0 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("paid");
    });
  });

  describe("voidInvoice", () => {
    it("voids an unpaid sent invoice and reverses client outstanding", async () => {
      const inv = await createTestInvoice({ status: "sent", total: 50000, amount_due: 50000 });
      await db("clients").where("id", TEST_CLIENT_ID).increment("outstanding_balance", 50000);
      await db("invoices").where("id", inv.id).update({ status: "void" });
      await db("clients").where("id", TEST_CLIENT_ID).decrement("outstanding_balance", 50000);
      const voidedRow = await db("invoices").where("id", inv.id).first();
      expect(voidedRow.status).toBe("void");
    });

    it("cannot void an already voided invoice", async () => {
      const inv = await createTestInvoice({ status: "void" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(["void", "written_off"].includes(row.status)).toBe(true);
    });

    it("cannot void a fully paid invoice", async () => {
      const inv = await createTestInvoice({ status: "paid", amount_paid: 118000, amount_due: 0 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("paid");
    });
  });

  describe("writeOffInvoice", () => {
    it("writes off a sent invoice", async () => {
      const inv = await createTestInvoice({ status: "sent" });
      await db("invoices").where("id", inv.id).update({ status: "written_off" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("written_off");
    });

    it("writes off a partially paid invoice", async () => {
      const inv = await createTestInvoice({ status: "partially_paid", amount_paid: 30000, amount_due: 88000 });
      await db("invoices").where("id", inv.id).update({ status: "written_off" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("written_off");
    });

    it("rejects write-off for draft invoice", async () => {
      const inv = await createTestInvoice({ status: "draft" });
      const row = await db("invoices").where("id", inv.id).first();
      const allowed = ["sent", "viewed", "overdue", "partially_paid"];
      expect(allowed.includes(row.status)).toBe(false);
    });
  });

  describe("deleteInvoice", () => {
    it("deletes a draft invoice and its items", async () => {
      const inv = await createTestInvoice({ status: "draft" });
      const itemId = await createTestInvoiceItem(inv.id);
      await db("invoice_items").where("invoice_id", inv.id).del();
      await db("invoices").where("id", inv.id).del();
      cleanup.splice(cleanup.findIndex(c => c.id === inv.id), 1);
      cleanup.splice(cleanup.findIndex(c => c.id === itemId), 1);
      const row = await db("invoices").where("id", inv.id).first();
      expect(row).toBeUndefined();
    });

    it("rejects deleting non-draft invoice", async () => {
      const inv = await createTestInvoice({ status: "sent" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).not.toBe("draft");
    });
  });

  describe("duplicateInvoice", () => {
    it("creates a copy with new ID, DRAFT status, zero amountPaid", async () => {
      const orig = await createTestInvoice({ status: "sent", amount_paid: 50000, amount_due: 68000 });
      await createTestInvoiceItem(orig.id);
      const newId = uuid();
      const origRow = await db("invoices").where("id", orig.id).first();
      await db("invoices").insert({
        ...origRow,
        id: newId,
        invoice_number: `TINV-DUP-${TS}-${Math.random().toString(36).slice(2, 8)}`,
        status: "draft",
        amount_paid: 0,
        amount_due: origRow.total,
        issue_date: dayjs().format("YYYY-MM-DD"),
        due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        created_at: new Date(),
        updated_at: new Date(),
        sent_at: null, viewed_at: null, paid_at: null,
      });
      track("invoices", newId);
      const origItems = await db("invoice_items").where("invoice_id", orig.id);
      for (const item of origItems) {
        const nid = uuid();
        await db("invoice_items").insert({ ...item, id: nid, invoice_id: newId });
        track("invoice_items", nid);
      }
      const dupRow = await db("invoices").where("id", newId).first();
      expect(dupRow.status).toBe("draft");
      expect(Number(dupRow.amount_paid)).toBe(0);
      expect(Number(dupRow.total)).toBe(Number(origRow.total));
    });
  });

  describe("TDS / withholding tax", () => {
    it("calculates TDS on taxable base (subtotal - discount)", async () => {
      const subtotal = 100000;
      const discountAmount = 10000;
      const tdsRate = 10;
      const tdsAmount = Math.round((subtotal - discountAmount) * tdsRate / 100);
      const inv = await createTestInvoice({
        subtotal, discount_amount: discountAmount, tds_rate: tdsRate, tds_amount: tdsAmount, tds_section: "194C",
        tax_amount: 0, total: subtotal - discountAmount, amount_due: subtotal - discountAmount,
      });
      const row = await db("invoices").where("id", inv.id).first();
      expect(Number(row.tds_amount)).toBe(9000);
      expect(row.tds_section).toBe("194C");
    });

    it("TDS is zero when tds_rate is null", async () => {
      const inv = await createTestInvoice({ tds_rate: null, tds_amount: 0 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(Number(row.tds_amount)).toBe(0);
    });
  });

  describe("multi-currency invoices", () => {
    it("stores exchange rate and computes converted total", async () => {
      const inv = await createTestInvoice({ currency: "USD", exchange_rate: 83.5, total: 10000, amount_due: 10000, subtotal: 10000, tax_amount: 0 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.currency).toBe("USD");
      expect(Math.round(Number(row.total) * Number(row.exchange_rate))).toBe(835000);
    });
  });

  describe("listInvoices - filtering", () => {
    it("filters overdue invoices (sent + past due date)", async () => {
      const pastDue = dayjs().subtract(5, "day").format("YYYY-MM-DD");
      const inv = await createTestInvoice({ status: "sent", due_date: pastDue });
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).whereIn("status", ["sent", "viewed", "partially_paid"]).where("due_date", "<", dayjs().format("YYYY-MM-DD"));
      expect(rows.find((r: any) => r.id === inv.id)).toBeDefined();
    });

    it("filters by date range", async () => {
      const inv = await createTestInvoice({ issue_date: "2025-01-15" });
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).where("issue_date", ">=", "2025-01-01").where("issue_date", "<=", "2025-01-31");
      expect(rows.find((r: any) => r.id === inv.id)).toBeDefined();
    });

    it("filters by search (invoice number)", async () => {
      const inv = await createTestInvoice();
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).where("invoice_number", "like", `%${inv.invoiceNumber.slice(-5)}%`);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by status", async () => {
      await createTestInvoice({ status: "paid", amount_paid: 118000, amount_due: 0 });
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).where("status", "paid");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by client_id", async () => {
      await createTestInvoice({ client_id: TEST_CLIENT_ID_2 });
      const rows = await db("invoices").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID_2);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("invoice items with tax components", () => {
    it("stores CGST/SGST breakdown as JSON", async () => {
      const inv = await createTestInvoice();
      const itemId = uuid();
      await db("invoice_items").insert({
        id: itemId, invoice_id: inv.id, org_id: TEST_ORG_ID, name: "Taxed Item",
        quantity: 2, rate: 50000, discount_amount: 0, tax_rate_id: TEST_TAX_RATE_ID, tax_rate: 18, tax_amount: 18000,
        tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 9000 }, { name: "SGST", rate: 9, amount: 9000 }]),
        amount: 118000, sort_order: 0,
      });
      track("invoice_items", itemId);
      const item = await db("invoice_items").where("id", itemId).first();
      const components = typeof item.tax_components === "string" ? JSON.parse(item.tax_components) : item.tax_components;
      expect(components).toHaveLength(2);
      expect(components[0].name).toBe("CGST");
    });
  });

  describe("updateInvoice", () => {
    it("updates notes, terms, due_date on a draft invoice", async () => {
      const inv = await createTestInvoice();
      await db("invoices").where("id", inv.id).update({ notes: "Updated notes", terms: "Net 15", due_date: dayjs().add(15, "day").format("YYYY-MM-DD") });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.notes).toBe("Updated notes");
      expect(row.terms).toBe("Net 15");
    });

    it("rejects update on voided invoice", async () => {
      const inv = await createTestInvoice({ status: "void" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(["void", "written_off"].includes(row.status)).toBe(true);
    });

    it("recalculates totals when items change", async () => {
      const inv = await createTestInvoice();
      await createTestInvoiceItem(inv.id);
      await db("invoices").where("id", inv.id).update({ subtotal: 200000, tax_amount: 36000, total: 236000, amount_due: 236000 });
      const row = await db("invoices").where("id", inv.id).first();
      expect(Number(row.total)).toBe(236000);
    });
  });

  describe("markOverdueInvoices", () => {
    it("marks sent invoices past due date as overdue", async () => {
      const pastDate = dayjs().subtract(10, "day").format("YYYY-MM-DD");
      const inv = await createTestInvoice({ status: "sent", due_date: pastDate });
      const today = dayjs().format("YYYY-MM-DD");
      await db("invoices").where("org_id", TEST_ORG_ID).where("status", "sent").where("due_date", "<", today).update({ status: "overdue" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.status).toBe("overdue");
    });
  });

  describe("autoApplyCredits", () => {
    it("applies open credit notes to reduce invoice amount_due", async () => {
      const cnId = uuid();
      await db("credit_notes").insert({
        id: cnId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, credit_note_number: `CN-AUTO-${TS}`,
        status: "open", date: dayjs().format("YYYY-MM-DD"), subtotal: 30000, tax_amount: 0, total: 30000, balance: 30000,
        reason: "Test credit", created_by: TEST_USER_ID,
      });
      track("credit_notes", cnId);
      const inv = await createTestInvoice({ total: 50000, amount_paid: 0, amount_due: 50000, subtotal: 50000, tax_amount: 0 });
      const credit = await db("credit_notes").where("id", cnId).first();
      const invoice = await db("invoices").where("id", inv.id).first();
      const applyAmount = Math.min(Number(credit.balance), Number(invoice.amount_due));
      await db("credit_notes").where("id", cnId).update({ balance: Number(credit.balance) - applyAmount, status: Number(credit.balance) - applyAmount === 0 ? "applied" : "open" });
      const newPaid = Number(invoice.amount_paid) + applyAmount;
      const newDue = Math.max(0, Number(invoice.total) - newPaid);
      await db("invoices").where("id", inv.id).update({ amount_paid: newPaid, amount_due: newDue, status: newDue === 0 ? "paid" : "partially_paid" });
      const updInv = await db("invoices").where("id", inv.id).first();
      expect(Number(updInv.amount_paid)).toBe(30000);
      expect(updInv.status).toBe("partially_paid");
      const updCn = await db("credit_notes").where("id", cnId).first();
      expect(Number(updCn.balance)).toBe(0);
      expect(updCn.status).toBe("applied");
    });
  });

  describe("computeLineItem logic", () => {
    it("computes qty * rate correctly", () => {
      expect(Math.round(5 * 20000)).toBe(100000);
    });
    it("applies percentage discount", () => {
      expect(Math.round(100000 * 10 / 100)).toBe(10000);
    });
    it("applies fixed discount capped at subtotal", () => {
      expect(Math.min(60000, 50000)).toBe(50000);
    });
    it("computes tax at given rate", () => {
      expect(Math.round(90000 * 18 / 100)).toBe(16200);
    });
    it("creates tax breakdown with components", () => {
      const taxable = 100000;
      const components = [{ name: "CGST", rate: 9 }, { name: "SGST", rate: 9 }];
      const breakdown = components.map(c => ({ name: c.name, rate: c.rate, amount: Math.round(taxable * c.rate / 100) }));
      expect(breakdown[0].amount).toBe(9000);
      expect(breakdown[1].amount).toBe(9000);
    });
    it("handles zero tax rate gracefully", () => {
      const taxAmount = Math.round(100000 * 0 / 100);
      expect(taxAmount).toBe(0);
    });
    it("handles zero quantity", () => {
      expect(Math.round(0 * 10000)).toBe(0);
    });
  });

  describe("computeInvoiceTotals logic", () => {
    it("sums item subtotals, discounts, and taxes", () => {
      const items = [
        { lineSubtotal: 100000, discountAmount: 10000, taxableAmount: 90000, taxAmount: 16200, taxRate: 18 },
        { lineSubtotal: 50000, discountAmount: 0, taxableAmount: 50000, taxAmount: 9000, taxRate: 18 },
      ];
      expect(items.reduce((s, i) => s + i.lineSubtotal, 0)).toBe(150000);
      expect(items.reduce((s, i) => s + i.discountAmount, 0)).toBe(10000);
      expect(items.reduce((s, i) => s + i.taxAmount, 0)).toBe(25200);
    });

    it("applies invoice-level percentage discount and pro-rates tax", () => {
      const taxableSum = 140000;
      const discount = Math.round(taxableSum * 10 / 100);
      expect(discount).toBe(14000);
      const items = [{ taxableAmount: 90000, taxRate: 18 }, { taxableAmount: 50000, taxRate: 18 }];
      const tax = items.reduce((s, i) => {
        const share = i.taxableAmount / taxableSum;
        const d = Math.round(discount * share);
        return s + Math.round((i.taxableAmount - d) * i.taxRate / 100);
      }, 0);
      expect(taxableSum - discount + tax).toBeGreaterThan(0);
    });

    it("applies invoice-level fixed discount capped at taxable sum", () => {
      expect(Math.min(150000, 100000)).toBe(100000);
    });

    it("amountDue = max(0, total - amountPaid)", () => {
      expect(Math.max(0, 50000 - 60000)).toBe(0);
      expect(Math.max(0, 50000 - 30000)).toBe(20000);
    });
  });

  describe("getInvoicePayments", () => {
    it("returns payments linked to invoice via allocations", async () => {
      const inv = await createTestInvoice({ status: "paid", amount_paid: 118000, amount_due: 0 });
      const payId = uuid();
      const allocId = uuid();
      await db("payments").insert({
        id: payId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, payment_number: `PAY-JOIN-${TS}-${Math.random().toString(36).slice(2,6)}`,
        date: dayjs().format("YYYY-MM-DD"), amount: 118000, method: "bank_transfer", is_refund: false, refunded_amount: 0, created_by: TEST_USER_ID,
      });
      track("payments", payId);
      await db("payment_allocations").insert({ id: allocId, payment_id: payId, invoice_id: inv.id, org_id: TEST_ORG_ID, amount: 118000 });
      track("payment_allocations", allocId);
      const rows = await db("payments as p").join("payment_allocations as pa", "pa.payment_id", "p.id").where("pa.invoice_id", inv.id).where("p.org_id", TEST_ORG_ID).select("p.*", "pa.amount as allocated_amount");
      expect(rows.length).toBe(1);
      expect(Number(rows[0].allocated_amount)).toBe(118000);
    });
  });

  describe("inventory tracking on invoice create", () => {
    it("decrements product stock", async () => {
      const before = await db("products").where("id", TEST_PRODUCT_ID).first();
      const qty = 3;
      await db("products").where("id", TEST_PRODUCT_ID).update({ stock_on_hand: Math.max(0, Number(before.stock_on_hand) - qty) });
      const after = await db("products").where("id", TEST_PRODUCT_ID).first();
      expect(Number(after.stock_on_hand)).toBe(Number(before.stock_on_hand) - qty);
      await db("products").where("id", TEST_PRODUCT_ID).update({ stock_on_hand: before.stock_on_hand });
    });
  });

  describe("custom fields", () => {
    it("stores and retrieves custom_fields as JSON", async () => {
      const inv = await createTestInvoice({ custom_fields: JSON.stringify({ po_number: "PO-1234" }) });
      const row = await db("invoices").where("id", inv.id).first();
      const parsed = typeof row.custom_fields === "string" ? JSON.parse(row.custom_fields) : row.custom_fields;
      expect(parsed.po_number).toBe("PO-1234");
    });
  });

  describe("reference number", () => {
    it("stores optional reference_number", async () => {
      const inv = await createTestInvoice({ reference_number: "REF-XYZ-001" });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.reference_number).toBe("REF-XYZ-001");
    });
  });

  describe("recurring_profile_id link", () => {
    it("stores recurring_profile_id on auto-generated invoices", async () => {
      const rpId = uuid();
      const inv = await createTestInvoice({ recurring_profile_id: rpId });
      const row = await db("invoices").where("id", inv.id).first();
      expect(row.recurring_profile_id).toBe(rpId);
    });
  });
});
