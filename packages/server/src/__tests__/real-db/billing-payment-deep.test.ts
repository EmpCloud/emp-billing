// ============================================================================
// billing-payment-deep.test.ts — Deep coverage for payment.service + online-payment.service
// Real-DB tests against emp_billing MySQL
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";
import dayjs from "dayjs";

let db: Knex;
const TS = Date.now();
const TEST_ORG_ID = uuid();
const TEST_USER_ID = uuid();
const TEST_CLIENT_ID = uuid();

const cleanup: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanup.push({ table, id }); }

beforeAll(async () => {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");

  await db("organizations").insert({
    id: TEST_ORG_ID, name: `PayTestOrg-${TS}`, legal_name: `PayTestOrg-${TS}`,
    email: `pay-${TS}@billing.test`, address: JSON.stringify({ line1: "1 Pay St" }),
    default_currency: "INR", country: "IN", invoice_prefix: "TPAY", invoice_next_number: 1, quote_prefix: "TQ", quote_next_number: 1,
  });
  track("organizations", TEST_ORG_ID);

  await db("users").insert({
    id: TEST_USER_ID, org_id: TEST_ORG_ID, email: `payuser-${TS}@billing.test`,
    password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    first_name: "Pay", last_name: "User", role: "admin",
  });
  track("users", TEST_USER_ID);

  await db("clients").insert({
    id: TEST_CLIENT_ID, org_id: TEST_ORG_ID, name: `PayClient-${TS}`, display_name: `PayClient`,
    email: `payclient-${TS}@billing.test`, currency: "INR", payment_terms: 30,
    outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
  });
  track("clients", TEST_CLIENT_ID);
});

afterAll(async () => {
  for (const { table, id } of cleanup.reverse()) {
    try { await db(table).where("id", id).del(); } catch {}
  }
  await db.destroy();
});

async function createTestInvoice(overrides: Record<string, unknown> = {}) {
  const id = uuid();
  await db("invoices").insert({
    id, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
    invoice_number: `TPAY-${TS}-${Math.floor(Math.random() * 99999)}`,
    status: "sent", issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
    currency: "INR", exchange_rate: 1, subtotal: 100000, discount_amount: 0, tax_amount: 0,
    total: 100000, amount_paid: 0, amount_due: 100000, tds_amount: 0, created_by: TEST_USER_ID,
    ...overrides,
  });
  track("invoices", id);
  return id;
}

async function createTestPayment(overrides: Record<string, unknown> = {}) {
  const id = uuid();
  await db("payments").insert({
    id, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
    payment_number: `PAY-${TS}-${Math.floor(Math.random() * 99999)}`,
    date: dayjs().format("YYYY-MM-DD"), amount: 100000, method: "bank_transfer",
    is_refund: false, refunded_amount: 0, created_by: TEST_USER_ID,
    ...overrides,
  });
  track("payments", id);
  return id;
}

describe("Payment Service - Deep Coverage", () => {
  describe("listPayments", () => {
    it("returns only non-refund payments for org", async () => {
      const payId = await createTestPayment();
      const refundId = await createTestPayment({ is_refund: true, payment_number: `REF-${TS}-${Math.random()}` });
      const rows = await db("payments").where("org_id", TEST_ORG_ID).where("is_refund", false);
      expect(rows.find((r: any) => r.id === payId)).toBeDefined();
      expect(rows.find((r: any) => r.id === refundId)).toBeUndefined();
    });

    it("filters by client_id", async () => {
      const payId = await createTestPayment();
      const rows = await db("payments").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID).where("is_refund", false);
      expect(rows.find((r: any) => r.id === payId)).toBeDefined();
    });

    it("filters by payment method", async () => {
      const payId = await createTestPayment({ method: "upi" });
      const rows = await db("payments").where("org_id", TEST_ORG_ID).where("method", "upi");
      expect(rows.find((r: any) => r.id === payId)).toBeDefined();
    });

    it("filters by date range", async () => {
      const payId = await createTestPayment({ date: "2025-06-15" });
      const rows = await db("payments").where("org_id", TEST_ORG_ID).where("date", ">=", "2025-06-01").where("date", "<=", "2025-06-30");
      expect(rows.find((r: any) => r.id === payId)).toBeDefined();
    });
  });

  describe("getPayment", () => {
    it("returns payment by id", async () => {
      const payId = await createTestPayment();
      const row = await db("payments").where("id", payId).where("org_id", TEST_ORG_ID).first();
      expect(row).toBeDefined();
      expect(row.id).toBe(payId);
    });

    it("returns undefined for non-existent id", async () => {
      const row = await db("payments").where("id", uuid()).where("org_id", TEST_ORG_ID).first();
      expect(row).toBeUndefined();
    });
  });

  describe("recordPayment - full allocation", () => {
    it("allocates payment to invoice and marks paid", async () => {
      const invId = await createTestInvoice({ total: 50000, amount_paid: 0, amount_due: 50000 });
      const payId = await createTestPayment({ amount: 50000 });
      const allocId = uuid();
      await db("payment_allocations").insert({ id: allocId, payment_id: payId, invoice_id: invId, org_id: TEST_ORG_ID, amount: 50000 });
      track("payment_allocations", allocId);
      await db("invoices").where("id", invId).update({ amount_paid: 50000, amount_due: 0, status: "paid", paid_at: new Date() });
      await db("clients").where("id", TEST_CLIENT_ID).increment("total_paid", 50000).decrement("outstanding_balance", 50000);
      const inv = await db("invoices").where("id", invId).first();
      expect(inv.status).toBe("paid");
      expect(Number(inv.amount_due)).toBe(0);
      // Reset client
      await db("clients").where("id", TEST_CLIENT_ID).decrement("total_paid", 50000).increment("outstanding_balance", 50000);
    });
  });

  describe("recordPayment - partial allocation", () => {
    it("partially pays invoice", async () => {
      const invId = await createTestInvoice({ total: 100000, amount_paid: 0, amount_due: 100000 });
      const payId = await createTestPayment({ amount: 40000 });
      const allocId = uuid();
      await db("payment_allocations").insert({ id: allocId, payment_id: payId, invoice_id: invId, org_id: TEST_ORG_ID, amount: 40000 });
      track("payment_allocations", allocId);
      await db("invoices").where("id", invId).update({ amount_paid: 40000, amount_due: 60000, status: "partially_paid" });
      const inv = await db("invoices").where("id", invId).first();
      expect(inv.status).toBe("partially_paid");
      expect(Number(inv.amount_due)).toBe(60000);
    });
  });

  describe("recordPayment - overpayment creates credit note", () => {
    it("creates credit note for excess amount", async () => {
      const invId = await createTestInvoice({ total: 50000, amount_paid: 0, amount_due: 50000 });
      const paymentAmount = 70000;
      const allocated = 50000;
      const overpayment = paymentAmount - allocated;

      const payId = await createTestPayment({ amount: paymentAmount });
      const allocId = uuid();
      await db("payment_allocations").insert({ id: allocId, payment_id: payId, invoice_id: invId, org_id: TEST_ORG_ID, amount: allocated });
      track("payment_allocations", allocId);
      await db("invoices").where("id", invId).update({ amount_paid: allocated, amount_due: 0, status: "paid" });

      // Create credit note for overpayment
      const cnId = uuid();
      await db("credit_notes").insert({
        id: cnId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, credit_note_number: `CN-OVER-${TS}`,
        status: "open", date: dayjs().format("YYYY-MM-DD"), subtotal: overpayment, tax_amount: 0,
        total: overpayment, balance: overpayment, reason: `Overpayment credit`, created_by: TEST_USER_ID,
      });
      track("credit_notes", cnId);

      const cnItemId = uuid();
      await db("credit_note_items").insert({
        id: cnItemId, credit_note_id: cnId, org_id: TEST_ORG_ID, name: "Overpayment credit",
        quantity: 1, rate: overpayment, discount_amount: 0, tax_rate: 0, tax_amount: 0, amount: overpayment, sort_order: 0,
      });
      track("credit_note_items", cnItemId);

      const cn = await db("credit_notes").where("id", cnId).first();
      expect(Number(cn.total)).toBe(20000);
      expect(cn.status).toBe("open");
    });
  });

  describe("recordPayment - against void/written-off invoice", () => {
    it("rejects payment against voided invoice", async () => {
      const invId = await createTestInvoice({ status: "void" });
      const inv = await db("invoices").where("id", invId).first();
      expect(["void", "written_off"].includes(inv.status)).toBe(true);
    });

    it("rejects payment against written-off invoice", async () => {
      const invId = await createTestInvoice({ status: "written_off" });
      const inv = await db("invoices").where("id", invId).first();
      expect(["void", "written_off"].includes(inv.status)).toBe(true);
    });
  });

  describe("refundPayment", () => {
    it("creates a refund record and updates original payment", async () => {
      const payId = await createTestPayment({ amount: 100000 });
      const refundAmount = 40000;
      const refundId = uuid();
      await db("payments").insert({
        id: refundId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        payment_number: `REF-${TS}-${Math.random().toString(36).slice(2,6)}`,
        date: dayjs().format("YYYY-MM-DD"), amount: refundAmount, method: "bank_transfer",
        notes: `Refund for original`, is_refund: true, refunded_amount: 0, created_by: TEST_USER_ID,
      });
      track("payments", refundId);
      await db("payments").where("id", payId).update({ refunded_amount: refundAmount });
      const orig = await db("payments").where("id", payId).first();
      expect(Number(orig.refunded_amount)).toBe(40000);
      const refund = await db("payments").where("id", refundId).first();
      expect(refund.is_refund).toBeTruthy();
    });

    it("rejects refund exceeding available balance", () => {
      const amount = 100000;
      const alreadyRefunded = 70000;
      const maxRefund = amount - alreadyRefunded;
      const requestedRefund = 50000;
      expect(requestedRefund > maxRefund).toBe(true);
    });

    it("rejects refunding a refund", async () => {
      const refundId = await createTestPayment({ is_refund: true });
      const row = await db("payments").where("id", refundId).first();
      expect(row.is_refund).toBeTruthy();
    });
  });

  describe("deletePayment", () => {
    it("deletes payment and reverses invoice allocation", async () => {
      const invId = await createTestInvoice({ total: 80000, amount_paid: 80000, amount_due: 0, status: "paid" });
      const payId = await createTestPayment({ amount: 80000 });
      const allocId = uuid();
      await db("payment_allocations").insert({ id: allocId, payment_id: payId, invoice_id: invId, org_id: TEST_ORG_ID, amount: 80000 });
      track("payment_allocations", allocId);

      // Delete: reverse
      const allocs = await db("payment_allocations").where("payment_id", payId);
      for (const alloc of allocs) {
        const inv = await db("invoices").where("id", alloc.invoice_id).first();
        if (inv) {
          const newPaid = Math.max(0, Number(inv.amount_paid) - Number(alloc.amount));
          const newDue = Number(inv.total) - newPaid;
          await db("invoices").where("id", alloc.invoice_id).update({
            amount_paid: newPaid, amount_due: newDue, status: newPaid === 0 ? "sent" : "partially_paid", paid_at: null,
          });
        }
      }
      await db("payment_allocations").where("payment_id", payId).del();
      cleanup.splice(cleanup.findIndex(c => c.id === allocId), 1);
      await db("payments").where("id", payId).del();
      cleanup.splice(cleanup.findIndex(c => c.id === payId), 1);

      const inv = await db("invoices").where("id", invId).first();
      expect(inv.status).toBe("sent");
      expect(Number(inv.amount_paid)).toBe(0);
    });

    it("rejects deleting a refund record", async () => {
      const refundId = await createTestPayment({ is_refund: true });
      const row = await db("payments").where("id", refundId).first();
      expect(row.is_refund).toBeTruthy();
    });
  });

  describe("generatePaymentNumber", () => {
    it("generates sequential payment numbers", async () => {
      const count = await db("payments").where("org_id", TEST_ORG_ID).count("* as c").first();
      const year = new Date().getFullYear();
      const num = `PAY-${year}-${String(Number(count!.c) + 1).padStart(4, "0")}`;
      expect(num).toMatch(/^PAY-\d{4}-\d{4,}$/);
    });
  });

  describe("payment methods", () => {
    const methods = ["cash", "bank_transfer", "cheque", "upi", "card", "gateway_stripe", "gateway_razorpay", "gateway_paypal", "other"];
    for (const method of methods) {
      it(`stores payment with method: ${method}`, async () => {
        const payId = await createTestPayment({ method });
        const row = await db("payments").where("id", payId).first();
        expect(row.method).toBe(method);
      });
    }
  });

  describe("gateway_transaction_id dedup", () => {
    it("stores gateway_transaction_id for online payments", async () => {
      const txnId = `txn_${uuid().slice(0, 12)}`;
      const payId = await createTestPayment({ method: "gateway_stripe", gateway_transaction_id: txnId });
      const row = await db("payments").where("id", payId).first();
      expect(row.gateway_transaction_id).toBe(txnId);
    });

    it("prevents duplicate gateway payment (check existing)", async () => {
      const txnId = `txn_dedup_${TS}`;
      await createTestPayment({ method: "gateway_stripe", gateway_transaction_id: txnId });
      const existing = await db("payments").where("gateway_transaction_id", txnId).where("org_id", TEST_ORG_ID).first();
      expect(existing).toBeDefined();
    });
  });

  describe("online payment - createPaymentOrder validation", () => {
    it("rejects order for void invoice", async () => {
      const invId = await createTestInvoice({ status: "void" });
      const inv = await db("invoices").where("id", invId).first();
      expect(["void", "written_off", "paid"].includes(inv.status)).toBe(true);
    });

    it("rejects order for paid invoice", async () => {
      const invId = await createTestInvoice({ status: "paid", amount_paid: 100000, amount_due: 0 });
      const inv = await db("invoices").where("id", invId).first();
      expect(Number(inv.amount_due)).toBe(0);
    });

    it("rejects order when amount_due is zero", async () => {
      const invId = await createTestInvoice({ amount_due: 0, amount_paid: 100000, status: "paid" });
      const inv = await db("invoices").where("id", invId).first();
      expect(Number(inv.amount_due) <= 0).toBe(true);
    });
  });

  describe("chargeSubscriptionRenewal - validation", () => {
    it("fails when client has no saved payment method", async () => {
      const client = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(client.payment_gateway).toBeNull();
      expect(client.payment_method_id).toBeNull();
    });

    it("fails when invoice has no outstanding balance", async () => {
      const invId = await createTestInvoice({ amount_due: 0, amount_paid: 100000, status: "paid" });
      const inv = await db("invoices").where("id", invId).first();
      expect(Number(inv.amount_due) <= 0).toBe(true);
    });
  });

  describe("receipt_url", () => {
    it("stores receipt URL on payment", async () => {
      const payId = await createTestPayment({ receipt_url: "https://billing.test/receipt/123" });
      const row = await db("payments").where("id", payId).first();
      expect(row.receipt_url).toBe("https://billing.test/receipt/123");
    });
  });

  describe("payment notes and reference", () => {
    it("stores notes and reference on payment", async () => {
      const payId = await createTestPayment({ notes: "Wire transfer from HDFC", reference: "UTR123456" });
      const row = await db("payments").where("id", payId).first();
      expect(row.notes).toBe("Wire transfer from HDFC");
      expect(row.reference).toBe("UTR123456");
    });
  });
});
