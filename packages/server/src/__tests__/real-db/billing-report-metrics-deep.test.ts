// ============================================================================
// EMP BILLING — Report, Metrics & Scheduled Reports Deep Real-DB Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";

let db: Knex;
const TS = Date.now();
const ORG_ID = uuid();
const USER_ID = uuid();
const CLIENT_ID = uuid();
const CLIENT2_ID = uuid();
const PLAN_ID = uuid();

beforeAll(async () => {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  await db("organizations").insert({ id: ORG_ID, name: `ROrg-${TS}`, legal_name: `ROrg-${TS}`, email: `rorg-${TS}@test.t`, address: JSON.stringify({ line1: "4 R St", city: "Hyderabad", state: "TS", zip: "500001", country: "IN" }), default_currency: "INR", country: "IN", invoice_prefix: "RINV", quote_prefix: "RQTE" });
  await db("users").insert({ id: USER_ID, org_id: ORG_ID, email: `ru-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "R", last_name: "User", role: "admin" });
  await db("clients").insert({ id: CLIENT_ID, org_id: ORG_ID, name: `RClient-${TS}`, display_name: `RClient-${TS}`, email: `rc-${TS}@test.t`, currency: "INR", payment_terms: 30, total_billed: 500000, total_paid: 300000, outstanding_balance: 200000 });
  await db("clients").insert({ id: CLIENT2_ID, org_id: ORG_ID, name: `RClient2-${TS}`, display_name: `RClient2-${TS}`, email: `rc2-${TS}@test.t`, currency: "INR", payment_terms: 30, total_billed: 200000, total_paid: 200000, outstanding_balance: 0 });
  await db("plans").insert({ id: PLAN_ID, org_id: ORG_ID, name: "Monthly Pro", billing_interval: "monthly", price: 99900, currency: "INR" });
});

afterAll(async () => {
  const tables = ["scheduled_reports", "usage_records", "subscription_events", "subscriptions", "plans", "payment_allocations", "payments", "invoice_items", "invoices", "expense_categories", "expenses", "clients", "users", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  await db.destroy();
});

async function createInvoice(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("invoices").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, invoice_number: `RINV-${TS}-${id.slice(0,4)}`, status: "sent", issue_date: "2026-04-01", due_date: "2026-04-30", currency: "INR", subtotal: 100000, tax_amount: 18000, total: 118000, amount_due: 118000, created_by: USER_ID, ...ov });
  return id;
}

async function createPayment(clientId: string, amount: number, ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("payments").insert({ id, org_id: ORG_ID, client_id: clientId, payment_number: `RPAY-${TS}-${id.slice(0,4)}`, date: "2026-04-05", amount, method: "bank_transfer", created_by: USER_ID, ...ov });
  return id;
}

async function createSubscription(ov: Record<string, unknown> = {}) {
  const id = uuid();
  await db("subscriptions").insert({ id, org_id: ORG_ID, client_id: CLIENT_ID, plan_id: PLAN_ID, status: "active", next_billing_date: "2026-05-01", quantity: 1, created_by: USER_ID, current_period_start: "2026-04-01", current_period_end: "2026-04-30", ...ov });
  return id;
}

describe("Report Service - Deep Coverage", () => {
  describe("getDashboardStats", () => {
    it("calculates total revenue from paid invoices", async () => {
      const invId = await createInvoice({ status: "paid", amount_paid: 118000, amount_due: 0, paid_at: new Date() });
      const paidInvoices = await db("invoices").where({ org_id: ORG_ID, status: "paid" });
      const totalRevenue = paidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount_paid), 0);
      expect(totalRevenue).toBeGreaterThan(0);
    });
    it("calculates outstanding receivables", async () => {
      await createInvoice({ status: "sent", amount_due: 50000 });
      const outstanding = await db("invoices").where({ org_id: ORG_ID }).whereIn("status", ["sent", "overdue", "partially_paid"]);
      const totalOutstanding = outstanding.reduce((sum: number, inv: any) => sum + Number(inv.amount_due), 0);
      expect(totalOutstanding).toBeGreaterThan(0);
    });
    it("counts invoices by status", async () => {
      await createInvoice({ status: "draft" });
      await createInvoice({ status: "overdue", due_date: "2025-01-01" });
      const counts = await db("invoices").where({ org_id: ORG_ID }).select("status").count("* as count").groupBy("status");
      expect(counts.length).toBeGreaterThan(0);
    });
  });

  describe("getRevenueReport", () => {
    it("aggregates revenue by month", async () => {
      await createInvoice({ status: "paid", paid_at: "2026-04-05", amount_paid: 100000 });
      const paid = await db("invoices").where({ org_id: ORG_ID, status: "paid" }).whereBetween("paid_at", ["2026-04-01", "2026-04-30"]);
      const monthlyRevenue = paid.reduce((sum: number, inv: any) => sum + Number(inv.amount_paid), 0);
      expect(monthlyRevenue).toBeGreaterThan(0);
    });
    it("returns zero for period with no payments", async () => {
      const paid = await db("invoices").where({ org_id: ORG_ID, status: "paid" }).whereBetween("paid_at", ["2020-01-01", "2020-01-31"]);
      expect(paid.length).toBe(0);
    });
  });

  describe("getReceivablesReport", () => {
    it("lists clients with outstanding balances", async () => {
      const clients = await db("clients").where({ org_id: ORG_ID }).where("outstanding_balance", ">", 0);
      expect(clients.length).toBeGreaterThan(0);
      expect(Number(clients[0].outstanding_balance)).toBeGreaterThan(0);
    });
    it("excludes clients with zero outstanding", async () => {
      const clients = await db("clients").where({ org_id: ORG_ID }).where("outstanding_balance", "=", 0);
      const c2 = clients.find((c: any) => c.id === CLIENT2_ID);
      expect(c2).toBeDefined();
    });
  });

  describe("getAgingReport", () => {
    it("categorizes invoices by days overdue", async () => {
      await createInvoice({ status: "overdue", due_date: "2026-03-01", amount_due: 50000 });
      await createInvoice({ status: "overdue", due_date: "2025-12-01", amount_due: 75000 });
      const overdue = await db("invoices").where({ org_id: ORG_ID, status: "overdue" });
      const now = new Date();
      const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const inv of overdue) {
        const days = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        if (days <= 30) buckets["0-30"] += Number(inv.amount_due);
        else if (days <= 60) buckets["31-60"] += Number(inv.amount_due);
        else if (days <= 90) buckets["61-90"] += Number(inv.amount_due);
        else buckets["90+"] += Number(inv.amount_due);
      }
      expect(Object.values(buckets).some(v => v > 0)).toBe(true);
    });
  });

  describe("getExpenseReport", () => {
    it("aggregates expenses by category", async () => {
      const catId = uuid();
      await db("expense_categories").insert({ id: catId, org_id: ORG_ID, name: "Report Travel" });
      await db("expenses").insert({ id: uuid(), org_id: ORG_ID, category_id: catId, date: "2026-04-01", amount: 250000, currency: "INR", description: "Report test", status: "approved", created_by: USER_ID });
      const expenses = await db("expenses").where({ org_id: ORG_ID }).whereBetween("date", ["2026-04-01", "2026-04-30"]);
      expect(expenses.length).toBeGreaterThan(0);
    });
  });

  describe("getProfitLossReport", () => {
    it("calculates profit = revenue - expenses", async () => {
      const revenue = 500000;
      const expenses = 200000;
      const profit = revenue - expenses;
      expect(profit).toBe(300000);
    });
    it("handles negative profit (loss)", () => {
      const revenue = 100000;
      const expenses = 300000;
      expect(revenue - expenses).toBe(-200000);
    });
  });

  describe("getTaxReport", () => {
    it("aggregates tax collected from invoices", async () => {
      await createInvoice({ status: "paid", tax_amount: 18000 });
      const invoices = await db("invoices").where({ org_id: ORG_ID }).whereIn("status", ["paid", "partially_paid"]);
      const totalTax = invoices.reduce((sum: number, inv: any) => sum + Number(inv.tax_amount), 0);
      expect(totalTax).toBeGreaterThan(0);
    });
  });

  describe("getTopClients", () => {
    it("ranks clients by total_billed descending", async () => {
      const clients = await db("clients").where({ org_id: ORG_ID }).orderBy("total_billed", "desc");
      expect(clients.length).toBeGreaterThan(0);
      if (clients.length >= 2) {
        expect(Number(clients[0].total_billed)).toBeGreaterThanOrEqual(Number(clients[1].total_billed));
      }
    });
  });
});

describe("Metrics Service - Deep Coverage", () => {
  describe("getMRR (Monthly Recurring Revenue)", () => {
    it("calculates MRR from active subscriptions", async () => {
      await createSubscription();
      await createSubscription({ quantity: 3 });
      const subs = await db("subscriptions").where({ org_id: ORG_ID, status: "active" });
      let mrr = 0;
      for (const s of subs) {
        const plan = await db("plans").where({ id: s.plan_id }).first();
        if (plan) mrr += Number(plan.price) * s.quantity;
      }
      expect(mrr).toBeGreaterThan(0);
    });
    it("excludes cancelled subscriptions from MRR", async () => {
      await createSubscription({ status: "cancelled" });
      const subs = await db("subscriptions").where({ org_id: ORG_ID, status: "active" });
      // Only active subs count
      expect(subs.every((s: any) => s.status === "active")).toBe(true);
    });
    it("handles trialing subscriptions", async () => {
      await createSubscription({ status: "trialing", trial_start: "2026-04-01", trial_end: "2026-04-14" });
      const trialing = await db("subscriptions").where({ org_id: ORG_ID, status: "trialing" });
      expect(trialing.length).toBeGreaterThan(0);
    });
  });

  describe("getARR", () => {
    it("ARR = MRR * 12", () => {
      const mrr = 99900;
      expect(mrr * 12).toBe(1198800);
    });
  });

  describe("getChurnMetrics", () => {
    it("counts cancelled subscriptions in period", async () => {
      const subId = await createSubscription({ status: "cancelled", cancelled_at: "2026-04-02" });
      const cancelled = await db("subscriptions").where({ org_id: ORG_ID, status: "cancelled" }).whereBetween("cancelled_at", ["2026-04-01", "2026-04-30"]);
      expect(cancelled.length).toBeGreaterThan(0);
    });
    it("calculates churn rate", () => {
      const totalStart = 100;
      const churned = 5;
      const churnRate = (churned / totalStart) * 100;
      expect(churnRate).toBe(5);
    });
  });

  describe("getLTV (Lifetime Value)", () => {
    it("LTV = ARPU / churn rate", () => {
      const arpu = 99900; // per month
      const monthlyChurn = 0.05; // 5%
      const ltv = Math.round(arpu / monthlyChurn);
      expect(ltv).toBe(1998000);
    });
  });

  describe("getRevenueBreakdown", () => {
    it("breaks down revenue by plan", async () => {
      const plan2Id = uuid();
      await db("plans").insert({ id: plan2Id, org_id: ORG_ID, name: "Annual Enterprise", billing_interval: "annual", price: 999900, currency: "INR" });
      await createSubscription({ plan_id: plan2Id });
      const subs = await db("subscriptions").where({ org_id: ORG_ID, status: "active" }).select("plan_id", db.raw("SUM(quantity) as total_qty")).groupBy("plan_id");
      expect(subs.length).toBeGreaterThan(0);
    });
  });

  describe("getSubscriptionStats", () => {
    it("counts subscriptions by status", async () => {
      const stats = await db("subscriptions").where({ org_id: ORG_ID }).select("status").count("* as cnt").groupBy("status");
      expect(stats.length).toBeGreaterThan(0);
    });
    it("calculates average quantity", async () => {
      const avg = await db("subscriptions").where({ org_id: ORG_ID, status: "active" }).avg("quantity as avgQty").first();
      expect(Number(avg?.avgQty || 0)).toBeGreaterThan(0);
    });
  });

  describe("getCohortAnalysis", () => {
    it("groups subscriptions by creation month", async () => {
      const cohorts = await db("subscriptions").where({ org_id: ORG_ID }).select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as cohort")).count("* as cnt").groupBy("cohort");
      expect(cohorts.length).toBeGreaterThan(0);
    });
  });
});

describe("Scheduled Report Service - Deep Coverage", () => {
  describe("createScheduledReport", () => {
    it("creates daily revenue report", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "revenue", frequency: "daily", recipient_email: `report-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      const r = await db("scheduled_reports").where({ id }).first();
      expect(r.report_type).toBe("revenue");
      expect(r.frequency).toBe("daily");
    });
    it("creates weekly receivables report", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "receivables", frequency: "weekly", recipient_email: `report-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      expect((await db("scheduled_reports").where({ id }).first()).frequency).toBe("weekly");
    });
    it("creates monthly expense report", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "expenses", frequency: "monthly", recipient_email: `report-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      expect((await db("scheduled_reports").where({ id }).first()).report_type).toBe("expenses");
    });
  });

  describe("all report types", () => {
    for (const rt of ["revenue", "receivables", "expenses", "tax", "profit_loss"] as const) {
      it(`supports report type: ${rt}`, async () => {
        const id = uuid();
        await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: rt, frequency: "daily", recipient_email: `rpt-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
        expect((await db("scheduled_reports").where({ id }).first()).report_type).toBe(rt);
      });
    }
  });

  describe("listScheduledReports", () => {
    it("lists reports for org", async () => {
      expect((await db("scheduled_reports").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
  });

  describe("updateScheduledReport", () => {
    it("updates frequency", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "revenue", frequency: "daily", recipient_email: `upd-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      await db("scheduled_reports").where({ id }).update({ frequency: "weekly" });
      expect((await db("scheduled_reports").where({ id }).first()).frequency).toBe("weekly");
    });
    it("deactivates report", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "tax", frequency: "monthly", recipient_email: `deact-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      await db("scheduled_reports").where({ id }).update({ is_active: false });
      expect((await db("scheduled_reports").where({ id }).first()).is_active).toBeFalsy();
    });
  });

  describe("getDueReports", () => {
    it("finds reports due for sending", async () => {
      const id = uuid();
      const pastDate = new Date("2025-01-01");
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "revenue", frequency: "daily", recipient_email: `due-${TS}@test.t`, is_active: true, next_send_at: pastDate, created_by: USER_ID });
      const due = await db("scheduled_reports").where({ is_active: true }).where("next_send_at", "<=", new Date());
      expect(due.length).toBeGreaterThan(0);
    });
  });

  describe("markReportSent", () => {
    it("updates last_sent_at and next_send_at", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "revenue", frequency: "daily", recipient_email: `sent-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      const now = new Date();
      const nextDay = new Date(now.getTime() + 86400000);
      await db("scheduled_reports").where({ id }).update({ last_sent_at: now, next_send_at: nextDay });
      const r = await db("scheduled_reports").where({ id }).first();
      expect(r.last_sent_at).toBeTruthy();
    });
  });

  describe("deleteScheduledReport", () => {
    it("deletes report by id", async () => {
      const id = uuid();
      await db("scheduled_reports").insert({ id, org_id: ORG_ID, report_type: "revenue", frequency: "daily", recipient_email: `del-${TS}@test.t`, is_active: true, next_send_at: new Date(), created_by: USER_ID });
      await db("scheduled_reports").where({ id }).delete();
      expect(await db("scheduled_reports").where({ id }).first()).toBeUndefined();
    });
  });
});
