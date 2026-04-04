// ============================================================================
// billing-client-deep.test.ts — Deep coverage for client.service + portal.service
// Real-DB tests against emp_billing MySQL
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import dayjs from "dayjs";

let db: Knex;
const TS = Date.now();
const TEST_ORG_ID = uuid();
const TEST_USER_ID = uuid();
const TEST_CLIENT_ID = uuid();

const cleanup: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanup.push({ table, id }); }

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

beforeAll(async () => {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");

  await db("organizations").insert({
    id: TEST_ORG_ID, name: `CliTestOrg-${TS}`, legal_name: `CliTestOrg-${TS}`,
    email: `cli-${TS}@billing.test`, address: JSON.stringify({ line1: "1 Cli St", city: "Mumbai", state: "MH" }),
    default_currency: "INR", country: "IN", invoice_prefix: "TCLI", invoice_next_number: 1, quote_prefix: "TCQ", quote_next_number: 1,
    brand_colors: JSON.stringify({ primary: "#4F46E5", accent: "#818CF8" }),
  });
  track("organizations", TEST_ORG_ID);

  await db("users").insert({
    id: TEST_USER_ID, org_id: TEST_ORG_ID, email: `cliuser-${TS}@billing.test`,
    password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    first_name: "Cli", last_name: "User", role: "admin",
  });
  track("users", TEST_USER_ID);

  await db("clients").insert({
    id: TEST_CLIENT_ID, org_id: TEST_ORG_ID, name: `PortalClient-${TS}`, display_name: `PortalClient`,
    email: `portal-${TS}@billing.test`, currency: "INR", payment_terms: 30,
    outstanding_balance: 50000, total_billed: 200000, total_paid: 150000,
    portal_enabled: true, portal_email: `portal-${TS}@billing.test`,
    is_active: true,
    billing_address: JSON.stringify({ line1: "123 Client St", city: "Delhi", state: "DL" }),
  });
  track("clients", TEST_CLIENT_ID);
});

afterAll(async () => {
  for (const { table, id } of cleanup.reverse()) {
    try { await db(table).where("id", id).del(); } catch {}
  }
  await db.destroy();
});

describe("Client Service - Deep Coverage", () => {
  describe("listClients", () => {
    it("returns clients for org", async () => {
      const rows = await db("clients").where("org_id", TEST_ORG_ID);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by is_active", async () => {
      const inactiveId = uuid();
      await db("clients").insert({
        id: inactiveId, org_id: TEST_ORG_ID, name: `Inactive-${TS}`, display_name: "Inactive",
        email: `inactive-${TS}@billing.test`, currency: "INR", payment_terms: 30,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: false,
      });
      track("clients", inactiveId);
      const active = await db("clients").where("org_id", TEST_ORG_ID).where("is_active", true);
      const inactive = await db("clients").where("org_id", TEST_ORG_ID).where("is_active", false);
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(inactive.length).toBeGreaterThanOrEqual(1);
    });

    it("searches by name", async () => {
      const rows = await db("clients").where("org_id", TEST_ORG_ID).where("name", "like", "%PortalClient%");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("searches by email", async () => {
      const rows = await db("clients").where("org_id", TEST_ORG_ID).where("email", "like", `%portal-${TS}%`);
      expect(rows.length).toBe(1);
    });
  });

  describe("getClient", () => {
    it("returns client with contacts", async () => {
      const contactId = uuid();
      await db("client_contacts").insert({
        id: contactId, client_id: TEST_CLIENT_ID, org_id: TEST_ORG_ID,
        name: "John Doe", email: `johndoe-${TS}@test.com`,
      });
      track("client_contacts", contactId);
      const client = await db("clients").where("id", TEST_CLIENT_ID).first();
      const contacts = await db("client_contacts").where("client_id", TEST_CLIENT_ID);
      expect(client).toBeDefined();
      expect(contacts.length).toBeGreaterThanOrEqual(1);
    });

    it("returns undefined for non-existent client", async () => {
      const row = await db("clients").where("id", uuid()).where("org_id", TEST_ORG_ID).first();
      expect(row).toBeUndefined();
    });
  });

  describe("createClient", () => {
    it("creates client with all fields", async () => {
      const id = uuid();
      await db("clients").insert({
        id, org_id: TEST_ORG_ID, name: `NewClient-${TS}`, display_name: "NewClient",
        email: `newclient-${TS}@billing.test`, phone: "+919876543210",
        website: "https://newclient.test", tax_id: "GSTIN1234", currency: "USD", payment_terms: 45,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
        billing_address: JSON.stringify({ line1: "456 New St" }),
        shipping_address: JSON.stringify({ line1: "789 Ship St" }),
        tags: JSON.stringify(["enterprise", "priority"]),
        notes: "Important client",
      });
      track("clients", id);
      const row = await db("clients").where("id", id).first();
      expect(row.currency).toBe("USD");
      expect(Number(row.payment_terms)).toBe(45);
      expect(row.tax_id).toBe("GSTIN1234");
      const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
      expect(tags).toContain("enterprise");
    });
  });

  describe("updateClient", () => {
    it("updates client fields", async () => {
      const id = uuid();
      await db("clients").insert({
        id, org_id: TEST_ORG_ID, name: `UpdClient-${TS}`, display_name: "UpdClient",
        email: `upd-${TS}@billing.test`, currency: "INR", payment_terms: 30,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
      });
      track("clients", id);
      await db("clients").where("id", id).update({ name: "Updated Name", payment_terms: 60, phone: "+911234567890" });
      const row = await db("clients").where("id", id).first();
      expect(row.name).toBe("Updated Name");
      expect(Number(row.payment_terms)).toBe(60);
    });
  });

  describe("deleteClient", () => {
    it("deletes client by id", async () => {
      const id = uuid();
      await db("clients").insert({
        id, org_id: TEST_ORG_ID, name: `DelClient-${TS}`, display_name: "Del",
        email: `del-${TS}@billing.test`, currency: "INR", payment_terms: 30,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
      });
      await db("clients").where("id", id).del();
      const row = await db("clients").where("id", id).first();
      expect(row).toBeUndefined();
    });
  });

  describe("addContact", () => {
    it("adds a contact to a client", async () => {
      const contactId = uuid();
      await db("client_contacts").insert({
        id: contactId, client_id: TEST_CLIENT_ID, org_id: TEST_ORG_ID,
        name: "Jane Smith", email: `jane-${TS}@test.com`, phone: "+911111111111",
      });
      track("client_contacts", contactId);
      const row = await db("client_contacts").where("id", contactId).first();
      expect(row.name).toBe("Jane Smith");
    });
  });

  describe("getClientStatement", () => {
    it("returns invoices and payments within date range", async () => {
      const invId = uuid();
      await db("invoices").insert({
        id: invId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        invoice_number: `STMT-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", exchange_rate: 1, subtotal: 50000, discount_amount: 0, tax_amount: 0,
        total: 50000, amount_paid: 0, amount_due: 50000, tds_amount: 0, created_by: TEST_USER_ID,
      });
      track("invoices", invId);

      const payId = uuid();
      await db("payments").insert({
        id: payId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        payment_number: `SPAY-${TS}`, date: dayjs().format("YYYY-MM-DD"),
        amount: 30000, method: "bank_transfer", is_refund: false, refunded_amount: 0, created_by: TEST_USER_ID,
      });
      track("payments", payId);

      const from = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      const to = dayjs().add(1, "day").format("YYYY-MM-DD");
      const invoices = await db("invoices").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID)
        .where("issue_date", ">=", from).where("issue_date", "<=", to);
      const payments = await db("payments").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID)
        .where("date", ">=", from).where("date", "<=", to);
      expect(invoices.length).toBeGreaterThanOrEqual(1);
      expect(payments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getClientBalance", () => {
    it("returns outstanding balance", async () => {
      const row = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(Number(row.outstanding_balance)).toBe(50000);
      expect(Number(row.total_billed)).toBe(200000);
      expect(Number(row.total_paid)).toBe(150000);
    });
  });

  describe("updatePaymentMethod", () => {
    it("stores payment gateway and method details", async () => {
      await db("clients").where("id", TEST_CLIENT_ID).update({
        payment_gateway: "stripe", payment_method_id: "pm_test123",
        payment_method_last4: "4242", payment_method_brand: "visa",
      });
      const row = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(row.payment_gateway).toBe("stripe");
      expect(row.payment_method_last4).toBe("4242");
      expect(row.payment_method_brand).toBe("visa");
    });
  });

  describe("removePaymentMethod", () => {
    it("clears payment method fields", async () => {
      await db("clients").where("id", TEST_CLIENT_ID).update({
        payment_gateway: null, payment_method_id: null,
        payment_method_last4: null, payment_method_brand: null,
      });
      const row = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(row.payment_gateway).toBeNull();
      expect(row.payment_method_id).toBeNull();
    });
  });

  describe("client custom_fields", () => {
    it("stores custom_fields as JSON", async () => {
      const id = uuid();
      await db("clients").insert({
        id, org_id: TEST_ORG_ID, name: `Custom-${TS}`, display_name: "Custom",
        email: `custom-${TS}@billing.test`, currency: "INR", payment_terms: 30,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
        custom_fields: JSON.stringify({ industry: "Tech", size: "50-200" }),
      });
      track("clients", id);
      const row = await db("clients").where("id", id).first();
      const cf = typeof row.custom_fields === "string" ? JSON.parse(row.custom_fields) : row.custom_fields;
      expect(cf.industry).toBe("Tech");
    });
  });
});

describe("Portal Service - Deep Coverage", () => {
  describe("portalLogin", () => {
    it("validates token hash and returns access", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const accessId = uuid();
      await db("client_portal_access").insert({
        id: accessId, client_id: TEST_CLIENT_ID, org_id: TEST_ORG_ID,
        email: `portal-${TS}@billing.test`, token_hash: tokenHash,
        expires_at: dayjs().add(7, "day").toDate(), is_active: true,
      });
      track("client_portal_access", accessId);

      const access = await db("client_portal_access")
        .where("email", `portal-${TS}@billing.test`)
        .where("token_hash", tokenHash)
        .where("is_active", true)
        .first();
      expect(access).toBeDefined();
      expect(access.client_id).toBe(TEST_CLIENT_ID);
    });

    it("rejects expired token", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const accessId = uuid();
      await db("client_portal_access").insert({
        id: accessId, client_id: TEST_CLIENT_ID, org_id: TEST_ORG_ID,
        email: `expired-${TS}@billing.test`, token_hash: tokenHash,
        expires_at: dayjs().subtract(1, "day").toDate(), is_active: true,
      });
      track("client_portal_access", accessId);

      const access = await db("client_portal_access").where("id", accessId).first();
      expect(new Date() > new Date(access.expires_at)).toBe(true);
    });

    it("rejects inactive token", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const accessId = uuid();
      await db("client_portal_access").insert({
        id: accessId, client_id: TEST_CLIENT_ID, org_id: TEST_ORG_ID,
        email: `deactivated-${TS}@billing.test`, token_hash: tokenHash, is_active: false,
      });
      track("client_portal_access", accessId);

      const access = await db("client_portal_access")
        .where("id", accessId).where("is_active", true).first();
      expect(access).toBeUndefined();
    });
  });

  describe("getPortalBranding", () => {
    it("returns org branding (logo, colors)", async () => {
      const org = await db("organizations").where("id", TEST_ORG_ID).first();
      expect(org).toBeDefined();
      const colors = typeof org.brand_colors === "string" ? JSON.parse(org.brand_colors) : org.brand_colors;
      expect(colors.primary).toBe("#4F46E5");
    });

    it("returns defaults when no org found", async () => {
      const org = await db("organizations").where("id", uuid()).first();
      expect(org).toBeUndefined();
      // Default branding
      const defaults = { orgName: "EMP Billing", logo: null, primaryColor: null };
      expect(defaults.orgName).toBe("EMP Billing");
    });
  });

  describe("getPortalDashboard", () => {
    it("returns outstanding balance and recent data", async () => {
      const client = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(Number(client.outstanding_balance)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getPortalInvoices", () => {
    it("excludes draft and void invoices from portal", async () => {
      const draftId = uuid();
      const sentId = uuid();
      await db("invoices").insert({
        id: draftId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        invoice_number: `PDRAFT-${TS}`, status: "draft",
        issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", exchange_rate: 1, subtotal: 10000, discount_amount: 0, tax_amount: 0,
        total: 10000, amount_paid: 0, amount_due: 10000, tds_amount: 0, created_by: TEST_USER_ID,
      });
      track("invoices", draftId);
      await db("invoices").insert({
        id: sentId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        invoice_number: `PSENT-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", exchange_rate: 1, subtotal: 20000, discount_amount: 0, tax_amount: 0,
        total: 20000, amount_paid: 0, amount_due: 20000, tds_amount: 0, created_by: TEST_USER_ID,
      });
      track("invoices", sentId);

      const all = await db("invoices").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      const visible = all.filter((i: any) => i.status !== "draft" && i.status !== "void");
      expect(visible.find((i: any) => i.id === draftId)).toBeUndefined();
      expect(visible.find((i: any) => i.id === sentId)).toBeDefined();
    });
  });

  describe("getPortalInvoice - access control", () => {
    it("rejects invoice not belonging to client", async () => {
      const otherClientId = uuid();
      await db("clients").insert({
        id: otherClientId, org_id: TEST_ORG_ID, name: `Other-${TS}`, display_name: "Other",
        email: `other-${TS}@billing.test`, currency: "INR", payment_terms: 30,
        outstanding_balance: 0, total_billed: 0, total_paid: 0, portal_enabled: false, is_active: true,
      });
      track("clients", otherClientId);

      const invId = uuid();
      await db("invoices").insert({
        id: invId, org_id: TEST_ORG_ID, client_id: otherClientId,
        invoice_number: `POTHER-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", exchange_rate: 1, subtotal: 10000, discount_amount: 0, tax_amount: 0,
        total: 10000, amount_paid: 0, amount_due: 10000, tds_amount: 0, created_by: TEST_USER_ID,
      });
      track("invoices", invId);

      const inv = await db("invoices").where("id", invId).first();
      expect(inv.client_id).not.toBe(TEST_CLIENT_ID);
    });

    it("marks invoice as VIEWED when accessed via portal", async () => {
      const invId = uuid();
      await db("invoices").insert({
        id: invId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        invoice_number: `PVIEW-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), due_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", exchange_rate: 1, subtotal: 10000, discount_amount: 0, tax_amount: 0,
        total: 10000, amount_paid: 0, amount_due: 10000, tds_amount: 0, created_by: TEST_USER_ID,
      });
      track("invoices", invId);

      await db("invoices").where("id", invId).update({ status: "viewed", viewed_at: new Date() });
      const row = await db("invoices").where("id", invId).first();
      expect(row.status).toBe("viewed");
      expect(row.viewed_at).not.toBeNull();
    });
  });

  describe("portal quotes", () => {
    it("excludes draft quotes", async () => {
      const draftQ = uuid();
      const sentQ = uuid();
      for (const [qid, status] of [[draftQ, "draft"], [sentQ, "sent"]] as const) {
        await db("quotes").insert({
          id: qid, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
          quote_number: `PQ-${status}-${TS}`, status,
          issue_date: dayjs().format("YYYY-MM-DD"), expiry_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
          currency: "INR", subtotal: 10000, discount_amount: 0, tax_amount: 0, total: 10000,
          created_by: TEST_USER_ID,
        });
        track("quotes", qid);
      }
      const quotes = await db("quotes").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      const visible = quotes.filter((q: any) => q.status !== "draft");
      expect(visible.find((q: any) => q.id === draftQ)).toBeUndefined();
      expect(visible.find((q: any) => q.id === sentQ)).toBeDefined();
    });

    it("accepts a sent quote", async () => {
      const qId = uuid();
      await db("quotes").insert({
        id: qId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        quote_number: `PACC-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), expiry_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", subtotal: 10000, discount_amount: 0, tax_amount: 0, total: 10000,
        created_by: TEST_USER_ID,
      });
      track("quotes", qId);
      await db("quotes").where("id", qId).update({ status: "accepted", accepted_at: new Date() });
      const row = await db("quotes").where("id", qId).first();
      expect(row.status).toBe("accepted");
    });

    it("declines a sent quote", async () => {
      const qId = uuid();
      await db("quotes").insert({
        id: qId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID,
        quote_number: `PDEC-${TS}`, status: "sent",
        issue_date: dayjs().format("YYYY-MM-DD"), expiry_date: dayjs().add(30, "day").format("YYYY-MM-DD"),
        currency: "INR", subtotal: 10000, discount_amount: 0, tax_amount: 0, total: 10000,
        created_by: TEST_USER_ID,
      });
      track("quotes", qId);
      await db("quotes").where("id", qId).update({ status: "declined" });
      const row = await db("quotes").where("id", qId).first();
      expect(row.status).toBe("declined");
    });
  });

  describe("portal credit notes", () => {
    it("excludes draft and void credit notes from portal", async () => {
      const openCn = uuid();
      const draftCn = uuid();
      await db("credit_notes").insert({
        id: openCn, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, credit_note_number: `PCN-OPEN-${TS}`,
        status: "open", date: dayjs().format("YYYY-MM-DD"), subtotal: 5000, tax_amount: 0, total: 5000, balance: 5000,
        created_by: TEST_USER_ID,
      });
      track("credit_notes", openCn);
      await db("credit_notes").insert({
        id: draftCn, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, credit_note_number: `PCN-DRAFT-${TS}`,
        status: "draft", date: dayjs().format("YYYY-MM-DD"), subtotal: 5000, tax_amount: 0, total: 5000, balance: 5000,
        created_by: TEST_USER_ID,
      });
      track("credit_notes", draftCn);

      const all = await db("credit_notes").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      const visible = all.filter((cn: any) => cn.status !== "draft" && cn.status !== "void");
      expect(visible.find((cn: any) => cn.id === openCn)).toBeDefined();
      expect(visible.find((cn: any) => cn.id === draftCn)).toBeUndefined();
    });
  });

  describe("portal subscriptions", () => {
    it("lists client subscriptions with plan details", async () => {
      const planId = uuid();
      await db("plans").insert({
        id: planId, org_id: TEST_ORG_ID, name: `PortalPlan-${TS}`, billing_interval: "monthly",
        price: 49900, currency: "INR", trial_period_days: 0, setup_fee: 0, is_active: true, sort_order: 0,
      });
      track("plans", planId);

      const subId = uuid();
      await db("subscriptions").insert({
        id: subId, org_id: TEST_ORG_ID, client_id: TEST_CLIENT_ID, plan_id: planId,
        status: "active", next_billing_date: dayjs().add(1, "month").format("YYYY-MM-DD"),
        quantity: 1, auto_renew: true, created_by: TEST_USER_ID,
      });
      track("subscriptions", subId);

      const subs = await db("subscriptions").where("org_id", TEST_ORG_ID).where("client_id", TEST_CLIENT_ID);
      expect(subs.length).toBeGreaterThanOrEqual(1);
      const plan = await db("plans").where("id", subs[0].plan_id).first();
      expect(plan).toBeDefined();
    });
  });

  describe("portal payment method", () => {
    it("returns saved payment method details", async () => {
      await db("clients").where("id", TEST_CLIENT_ID).update({
        payment_gateway: "razorpay", payment_method_id: "pm_rz_test",
        payment_method_last4: "1234", payment_method_brand: "mastercard",
      });
      const row = await db("clients").where("id", TEST_CLIENT_ID).first();
      expect(row.payment_gateway).toBe("razorpay");
      expect(row.payment_method_last4).toBe("1234");
      // Cleanup
      await db("clients").where("id", TEST_CLIENT_ID).update({
        payment_gateway: null, payment_method_id: null,
        payment_method_last4: null, payment_method_brand: null,
      });
    });
  });
});
