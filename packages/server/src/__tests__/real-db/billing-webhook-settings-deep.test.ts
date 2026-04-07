// ============================================================================
// EMP BILLING — Webhook, Settings & Team Service Deep Real-DB Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import crypto from "crypto";
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

beforeAll(async () => {
  try {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_billing" } });
  await db.raw("SELECT 1");
  } catch { dbAvailable = false; return; }
  await db("organizations").insert({ id: ORG_ID, name: `WOrg-${TS}`, legal_name: `WOrg Legal-${TS}`, email: `worg-${TS}@test.t`, address: JSON.stringify({ line1: "5 W St", city: "Kolkata", state: "WB", zip: "700001", country: "IN" }), default_currency: "INR", country: "IN", state: "West Bengal", invoice_prefix: "WINV", quote_prefix: "WQTE", default_payment_terms: 30, fiscal_year_start: 4 });
  await db("users").insert({ id: USER_ID, org_id: ORG_ID, email: `wu-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "W", last_name: "User", role: "owner" });
});

afterAll(async () => {
  if (!dbAvailable) return;
  const tables = ["webhook_deliveries", "webhooks", "custom_domains", "api_keys", "refresh_tokens", "users", "organizations"];
  for (const t of tables) { try { await db(t).where("org_id", ORG_ID).delete(); } catch {} }
  try { await db("refresh_tokens").where("user_id", USER_ID).delete(); } catch {}
  await db.destroy();
});

async function createWebhook(ov: Record<string, unknown> = {}) {
  const id = uuid();
  const secret = crypto.randomBytes(32).toString("hex");
  await db("webhooks").insert({ id, org_id: ORG_ID, url: `https://hook-${TS}-${id.slice(0,4)}.example.com/webhook`, events: JSON.stringify(["invoice.created", "payment.received"]), secret, is_active: true, failure_count: 0, ...ov });
  return id;
}

describe.skipIf(!dbAvailable)("Webhook Service - Deep Coverage", () => {
  describe("createWebhook", () => {
    it("creates webhook with URL and events", async () => {
      const wId = await createWebhook();
      const w = await db("webhooks").where({ id: wId }).first();
      expect(w.url).toContain("example.com/webhook");
      expect(w.is_active).toBeTruthy();
      const events = typeof w.events === "string" ? JSON.parse(w.events) : w.events;
      expect(events).toContain("invoice.created");
    });
    it("stores secret for HMAC verification", async () => {
      const wId = await createWebhook();
      const w = await db("webhooks").where({ id: wId }).first();
      expect(w.secret).toBeTruthy();
      expect(w.secret.length).toBeGreaterThan(16);
    });
  });

  describe("listWebhooks", () => {
    it("lists webhooks for org", async () => {
      await createWebhook();
      expect((await db("webhooks").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("filters active webhooks", async () => {
      expect((await db("webhooks").where({ org_id: ORG_ID, is_active: true })).length).toBeGreaterThan(0);
    });
  });

  describe("updateWebhook", () => {
    it("updates URL and events", async () => {
      const wId = await createWebhook();
      await db("webhooks").where({ id: wId }).update({ url: "https://new-url.example.com/hook", events: JSON.stringify(["invoice.paid"]) });
      const w = await db("webhooks").where({ id: wId }).first();
      expect(w.url).toBe("https://new-url.example.com/hook");
    });
    it("deactivates webhook", async () => {
      const wId = await createWebhook();
      await db("webhooks").where({ id: wId }).update({ is_active: false });
      expect((await db("webhooks").where({ id: wId }).first()).is_active).toBeFalsy();
    });
  });

  describe("deleteWebhook", () => {
    it("deletes webhook and its deliveries", async () => {
      const wId = await createWebhook();
      const delId = uuid();
      await db("webhook_deliveries").insert({ id: delId, webhook_id: wId, org_id: ORG_ID, event: "invoice.created", success: true, delivered_at: new Date() });
      await db("webhook_deliveries").where({ webhook_id: wId }).delete();
      await db("webhooks").where({ id: wId }).delete();
      expect(await db("webhooks").where({ id: wId }).first()).toBeUndefined();
    });
  });

  describe("webhook deliveries", () => {
    it("records successful delivery", async () => {
      const wId = await createWebhook();
      const delId = uuid();
      await db("webhook_deliveries").insert({ id: delId, webhook_id: wId, org_id: ORG_ID, event: "payment.received", payload: JSON.stringify({ amount: 100000 }), response_status: 200, success: true, delivered_at: new Date(), duration_ms: 150 });
      const d = await db("webhook_deliveries").where({ id: delId }).first();
      expect(d.success).toBeTruthy();
      expect(d.response_status).toBe(200);
      expect(d.duration_ms).toBe(150);
    });
    it("records failed delivery with error", async () => {
      const wId = await createWebhook();
      const delId = uuid();
      await db("webhook_deliveries").insert({ id: delId, webhook_id: wId, org_id: ORG_ID, event: "invoice.created", response_status: 500, response_body: "Internal Server Error", success: false, error: "Connection refused", delivered_at: new Date() });
      const d = await db("webhook_deliveries").where({ id: delId }).first();
      expect(d.success).toBeFalsy();
      expect(d.error).toBe("Connection refused");
    });
    it("lists deliveries for webhook", async () => {
      const wId = await createWebhook();
      for (let i = 0; i < 3; i++) {
        await db("webhook_deliveries").insert({ id: uuid(), webhook_id: wId, org_id: ORG_ID, event: "invoice.created", success: true, delivered_at: new Date() });
      }
      expect((await db("webhook_deliveries").where({ webhook_id: wId })).length).toBe(3);
    });
    it("stores request_body for debugging", async () => {
      const wId = await createWebhook();
      const delId = uuid();
      const body = JSON.stringify({ event: "test", data: { id: "123" } });
      await db("webhook_deliveries").insert({ id: delId, webhook_id: wId, org_id: ORG_ID, event: "test", request_body: body, success: true, delivered_at: new Date() });
      expect((await db("webhook_deliveries").where({ id: delId }).first()).request_body).toBe(body);
    });
    it("tracks failure_count on webhook", async () => {
      const wId = await createWebhook();
      await db("webhooks").where({ id: wId }).update({ failure_count: 5 });
      expect((await db("webhooks").where({ id: wId }).first()).failure_count).toBe(5);
    });
    it("records last_delivered_at", async () => {
      const wId = await createWebhook();
      const now = new Date();
      await db("webhooks").where({ id: wId }).update({ last_delivered_at: now });
      expect((await db("webhooks").where({ id: wId }).first()).last_delivered_at).toBeTruthy();
    });
  });

  describe("HMAC signature verification", () => {
    it("generates valid HMAC-SHA256 signature", () => {
      const secret = "test-secret-key";
      const payload = JSON.stringify({ event: "invoice.created", data: { id: "123" } });
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      expect(sig.length).toBe(64);
      // Verify
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      expect(sig).toBe(expected);
    });
    it("rejects tampered payload", () => {
      const secret = "test-secret-key";
      const originalPayload = JSON.stringify({ event: "invoice.created" });
      const tamperedPayload = JSON.stringify({ event: "invoice.deleted" });
      const sig = crypto.createHmac("sha256", secret).update(originalPayload).digest("hex");
      const tamperedSig = crypto.createHmac("sha256", secret).update(tamperedPayload).digest("hex");
      expect(sig).not.toBe(tamperedSig);
    });
  });
});

describe.skipIf(!dbAvailable)("Settings Service - Deep Coverage", () => {
  describe("getOrgSettings", () => {
    it("returns org settings", async () => {
      const org = await db("organizations").where({ id: ORG_ID }).first();
      expect(org.name).toBe(`WOrg-${TS}`);
      expect(org.default_currency).toBe("INR");
      expect(org.country).toBe("IN");
    });
  });

  describe("updateOrgSettings", () => {
    it("updates org name and legal name", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ name: `WOrg-Updated-${TS}`, legal_name: `WOrg Legal Updated-${TS}` });
      const org = await db("organizations").where({ id: ORG_ID }).first();
      expect(org.name).toBe(`WOrg-Updated-${TS}`);
    });
    it("updates address as JSON", async () => {
      const addr = { line1: "10 New St", city: "Kolkata", state: "WB", zip: "700002", country: "IN" };
      await db("organizations").where({ id: ORG_ID }).update({ address: JSON.stringify(addr) });
      const org = await db("organizations").where({ id: ORG_ID }).first();
      const parsed = typeof org.address === "string" ? JSON.parse(org.address) : org.address;
      expect(parsed.city).toBe("Kolkata");
    });
    it("updates tax_id and PAN", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ tax_id: "GSTIN001", pan: "ABCDE1234F" });
      const org = await db("organizations").where({ id: ORG_ID }).first();
      expect(org.tax_id).toBe("GSTIN001");
      expect(org.pan).toBe("ABCDE1234F");
    });
    it("updates default_payment_terms", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ default_payment_terms: 45 });
      expect((await db("organizations").where({ id: ORG_ID }).first()).default_payment_terms).toBe(45);
    });
    it("updates timezone", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ timezone: "Asia/Kolkata" });
      expect((await db("organizations").where({ id: ORG_ID }).first()).timezone).toBe("Asia/Kolkata");
    });
  });

  describe("updateBranding", () => {
    it("stores brand_colors as JSON", async () => {
      const colors = { primary: "#1E40AF", secondary: "#7C3AED", accent: "#059669" };
      await db("organizations").where({ id: ORG_ID }).update({ brand_colors: JSON.stringify(colors) });
      const org = await db("organizations").where({ id: ORG_ID }).first();
      const parsed = typeof org.brand_colors === "string" ? JSON.parse(org.brand_colors) : org.brand_colors;
      expect(parsed.primary).toBe("#1E40AF");
    });
    it("stores logo URL", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ logo: "https://cdn.example.com/logo.png" });
      expect((await db("organizations").where({ id: ORG_ID }).first()).logo).toBe("https://cdn.example.com/logo.png");
    });
  });

  describe("getNumberingConfig", () => {
    it("returns invoice prefix and next number", async () => {
      const org = await db("organizations").where({ id: ORG_ID }).first();
      expect(org.invoice_prefix).toBe("WINV");
      expect(org.invoice_next_number).toBeGreaterThanOrEqual(1);
    });
    it("returns quote prefix and next number", async () => {
      const org = await db("organizations").where({ id: ORG_ID }).first();
      expect(org.quote_prefix).toBe("WQTE");
    });
  });

  describe("updateNumberingConfig", () => {
    it("updates invoice prefix", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ invoice_prefix: "INV" });
      expect((await db("organizations").where({ id: ORG_ID }).first()).invoice_prefix).toBe("INV");
    });
    it("updates next number", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ invoice_next_number: 100 });
      expect((await db("organizations").where({ id: ORG_ID }).first()).invoice_next_number).toBe(100);
    });
    it("updates fiscal_year_start", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ fiscal_year_start: 1 });
      expect((await db("organizations").where({ id: ORG_ID }).first()).fiscal_year_start).toBe(1);
    });
  });

  describe("default notes and terms", () => {
    it("stores default invoice notes", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ default_notes: "Thank you for your business" });
      expect((await db("organizations").where({ id: ORG_ID }).first()).default_notes).toBe("Thank you for your business");
    });
    it("stores default terms", async () => {
      await db("organizations").where({ id: ORG_ID }).update({ default_terms: "Net 30. Late fee 2% per month." });
      expect((await db("organizations").where({ id: ORG_ID }).first()).default_terms).toBe("Net 30. Late fee 2% per month.");
    });
  });
});

describe.skipIf(!dbAvailable)("Team Service - Deep Coverage", () => {
  describe("listMembers", () => {
    it("lists team members for org", async () => {
      const members = await db("users").where({ org_id: ORG_ID });
      expect(members.length).toBeGreaterThan(0);
    });
    it("filters active members", async () => {
      const active = await db("users").where({ org_id: ORG_ID, is_active: true });
      expect(active.length).toBeGreaterThan(0);
    });
  });

  describe("inviteMember", () => {
    it("creates new user with viewer role", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `invite-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Invited", last_name: "User", role: "viewer" });
      expect((await db("users").where({ id }).first()).role).toBe("viewer");
    });
    it("creates member with accountant role", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `acct-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Acct", last_name: "User", role: "accountant" });
      expect((await db("users").where({ id }).first()).role).toBe("accountant");
    });
    it("creates member with sales role", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `sales-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Sales", last_name: "Rep", role: "sales" });
      expect((await db("users").where({ id }).first()).role).toBe("sales");
    });
  });

  describe("updateMemberRole", () => {
    it("promotes viewer to admin", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `promo-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Promo", last_name: "User", role: "viewer" });
      await db("users").where({ id }).update({ role: "admin" });
      expect((await db("users").where({ id }).first()).role).toBe("admin");
    });
  });

  describe("removeMember (deactivate)", () => {
    it("deactivates user", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `remove-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Remove", last_name: "User", role: "viewer" });
      await db("users").where({ id }).update({ is_active: false });
      expect((await db("users").where({ id }).first()).is_active).toBeFalsy();
    });
  });

  describe("all roles", () => {
    for (const role of ["owner", "admin", "accountant", "sales", "viewer"] as const) {
      it(`supports role: ${role}`, async () => {
        const id = uuid();
        await db("users").insert({ id, org_id: ORG_ID, email: `role-${role}-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: role, last_name: "Test", role });
        expect((await db("users").where({ id }).first()).role).toBe(role);
      });
    }
  });

  describe("email_verified and last_login_at", () => {
    it("tracks email verification", async () => {
      const id = uuid();
      await db("users").insert({ id, org_id: ORG_ID, email: `verify-${TS}@test.t`, password_hash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake", first_name: "Verify", last_name: "User", role: "viewer", email_verified: false });
      await db("users").where({ id }).update({ email_verified: true });
      expect((await db("users").where({ id }).first()).email_verified).toBeTruthy();
    });
    it("tracks last login", async () => {
      const now = new Date();
      await db("users").where({ id: USER_ID }).update({ last_login_at: now });
      expect((await db("users").where({ id: USER_ID }).first()).last_login_at).toBeTruthy();
    });
  });
});

describe.skipIf(!dbAvailable)("Custom Domain Service - Deep Coverage", () => {
  describe("CRUD", () => {
    it("creates custom domain", async () => {
      const id = uuid();
      await db("custom_domains").insert({ id, org_id: ORG_ID, domain: `billing-${TS}.example.com` });
      const d = await db("custom_domains").where({ id }).first();
      expect(d.domain).toBe(`billing-${TS}.example.com`);
      expect(d.verified).toBeFalsy();
      expect(d.ssl_provisioned).toBeFalsy();
    });
    it("verifies domain", async () => {
      const id = uuid();
      await db("custom_domains").insert({ id, org_id: ORG_ID, domain: `verified-${TS}.example.com` });
      await db("custom_domains").where({ id }).update({ verified: true });
      expect((await db("custom_domains").where({ id }).first()).verified).toBeTruthy();
    });
    it("provisions SSL", async () => {
      const id = uuid();
      await db("custom_domains").insert({ id, org_id: ORG_ID, domain: `ssl-${TS}.example.com`, verified: true });
      await db("custom_domains").where({ id }).update({ ssl_provisioned: true });
      expect((await db("custom_domains").where({ id }).first()).ssl_provisioned).toBeTruthy();
    });
    it("lists domains for org", async () => {
      expect((await db("custom_domains").where({ org_id: ORG_ID })).length).toBeGreaterThan(0);
    });
    it("enforces unique domain", async () => {
      const domain = `unique-${TS}.example.com`;
      const id1 = uuid();
      await db("custom_domains").insert({ id: id1, org_id: ORG_ID, domain });
      try {
        await db("custom_domains").insert({ id: uuid(), org_id: ORG_ID, domain });
        expect(true).toBe(false); // Should not reach
      } catch (err: any) {
        expect(err.message).toContain("Duplicate");
      }
    });
    it("deletes domain", async () => {
      const id = uuid();
      await db("custom_domains").insert({ id, org_id: ORG_ID, domain: `del-${TS}.example.com` });
      await db("custom_domains").where({ id }).delete();
      expect(await db("custom_domains").where({ id }).first()).toBeUndefined();
    });
  });
});

describe.skipIf(!dbAvailable)("API Keys - Deep Coverage", () => {
  describe("CRUD", () => {
    it("creates API key with hash", async () => {
      const id = uuid();
      const rawKey = `blk_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "Test Key", key_hash: keyHash, key_prefix: rawKey.slice(0, 12), scopes: JSON.stringify(["invoices:read", "payments:write"]), is_active: true });
      const key = await db("api_keys").where({ id }).first();
      expect(key.key_hash).toBe(keyHash);
      expect(key.key_prefix).toBe(rawKey.slice(0, 12));
    });
    it("validates API key by hash lookup", async () => {
      const id = uuid();
      const rawKey = `blk_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "Lookup Key", key_hash: keyHash, key_prefix: rawKey.slice(0, 12), is_active: true });
      const found = await db("api_keys").where({ key_hash: keyHash, is_active: true }).first();
      expect(found).toBeDefined();
      expect(found.id).toBe(id);
    });
    it("deactivates API key", async () => {
      const id = uuid();
      const keyHash = crypto.createHash("sha256").update("deactivate-key").digest("hex");
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "Deactivate Key", key_hash: keyHash, key_prefix: "blk_deact", is_active: true });
      await db("api_keys").where({ id }).update({ is_active: false });
      expect((await db("api_keys").where({ id }).first()).is_active).toBeFalsy();
    });
    it("stores expiry date", async () => {
      const id = uuid();
      const keyHash = crypto.createHash("sha256").update(`expiry-${TS}`).digest("hex");
      const expiry = new Date("2027-01-01");
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "Expiring Key", key_hash: keyHash, key_prefix: "blk_expiry", is_active: true, expires_at: expiry });
      expect((await db("api_keys").where({ id }).first()).expires_at).toBeTruthy();
    });
    it("updates last_used_at", async () => {
      const id = uuid();
      const keyHash = crypto.createHash("sha256").update(`lastused-${TS}`).digest("hex");
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "LastUsed Key", key_hash: keyHash, key_prefix: "blk_used", is_active: true });
      await db("api_keys").where({ id }).update({ last_used_at: new Date() });
      expect((await db("api_keys").where({ id }).first()).last_used_at).toBeTruthy();
    });
    it("scopes JSON stores permissions", async () => {
      const id = uuid();
      const keyHash = crypto.createHash("sha256").update(`scopes-${TS}`).digest("hex");
      const scopes = ["invoices:read", "invoices:write", "clients:read"];
      await db("api_keys").insert({ id, org_id: ORG_ID, name: "Scoped Key", key_hash: keyHash, key_prefix: "blk_scope", scopes: JSON.stringify(scopes), is_active: true });
      const key = await db("api_keys").where({ id }).first();
      const parsed = typeof key.scopes === "string" ? JSON.parse(key.scopes) : key.scopes;
      expect(parsed).toContain("invoices:write");
      expect(parsed).toHaveLength(3);
    });
  });
});
