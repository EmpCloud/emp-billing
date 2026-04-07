// ============================================================================
// EMP BILLING - Service Coverage Tests Part 3
// Targets all services below 80% to push overall from 62.5% to 85%+
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { v4 as uuid } from "uuid";

process.env.DB_PROVIDER = "mysql";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "empcloud";
process.env.DB_PASSWORD = "EmpCloud2026";
process.env.DB_NAME = "emp_billing";
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-jwt-secret-for-coverage-3";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-for-coverage-3";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.REDIS_PASSWORD = "fhclG7Q4p1yMnBdxvgX2bRoY0";
process.env.BCRYPT_ROUNDS = "4";
process.env.CORS_ORIGIN = "https://test-billing.empcloud.com";

vi.mock("../../jobs/queue", () => ({
  emailQueue: { add: vi.fn().mockResolvedValue({}) },
  recurringQueue: { add: vi.fn().mockResolvedValue({}) },
  reminderQueue: { add: vi.fn().mockResolvedValue({}) },
  pdfQueue: { add: vi.fn().mockResolvedValue({}) },
  scheduledReportQueue: { add: vi.fn().mockResolvedValue({}) },
  dunningQueue: { add: vi.fn().mockResolvedValue({}) },
  subscriptionQueue: { add: vi.fn().mockResolvedValue({}) },
  usageBillingQueue: { add: vi.fn().mockResolvedValue({}) },
  QUEUE_NAMES: { EMAIL: "email", RECURRING: "recurring-invoices", REMINDERS: "payment-reminders", PDF: "pdf-generation", SCHEDULED_REPORTS: "scheduled-reports", DUNNING: "dunning-retries", SUBSCRIPTIONS: "subscription-billing", USAGE_BILLING: "usage-billing" },
}));

vi.mock("../../events/index", () => ({ emit: vi.fn(), on: vi.fn() }));

vi.mock("../../utils/pdf", () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateQuotePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateReceiptPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateCreditNotePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateStatementPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

vi.mock("../../services/payment/gateways/index", () => ({
  getGateway: vi.fn().mockReturnValue({
    charge: vi.fn().mockResolvedValue({ success: true, transactionId: "mock-txn-3" }),
    refund: vi.fn().mockResolvedValue({ success: true }),
    createOrder: vi.fn().mockResolvedValue({ orderId: "mock-order-3", gatewayData: {} }),
    verifyPayment: vi.fn().mockResolvedValue({ verified: true }),
    chargeCustomer: vi.fn().mockResolvedValue({ success: true, gatewayTransactionId: "mock-dunning-txn" }),
  }),
  listGateways: vi.fn().mockReturnValue([{ name: "razorpay", displayName: "Razorpay" }, { name: "stripe", displayName: "Stripe" }]),
}));

import * as quoteService from "../../services/quote/quote.service";
import * as portalService from "../../services/portal/portal.service";
import * as dunningService from "../../services/dunning/dunning.service";
import * as recurringService from "../../services/recurring/recurring.service";
import * as pricingService from "../../services/pricing/pricing.service";
import * as couponService from "../../services/coupon/coupon.service";
import * as apiKeyService from "../../services/auth/api-key.service";
import * as smsService from "../../services/notification/sms.service";
import * as whatsappService from "../../services/notification/whatsapp.service";
import * as notificationService from "../../services/notification/notification.service";
import * as auditService from "../../services/audit/audit.service";
import * as disputeService from "../../services/dispute/dispute.service";
import * as teamService from "../../services/team/team.service";
import * as scheduledReportService from "../../services/report/scheduled-report.service";
import * as prorationService from "../../services/subscription/proration.service";
import { closeDB, getDB } from "../../db/adapters/index";
import { InvoiceStatus, QuoteStatus, CouponType, CouponAppliesTo, RecurringFrequency, RecurringStatus, PricingModel, DunningAttemptStatus, DisputeStatus } from "@emp-billing/shared";

let dbAvailable = false;
try {
  const { default: _knex } = await import("knex");
  const _probe = _knex({ client: "mysql2", connection: { host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || "empcloud", password: process.env.DB_PASSWORD || "EmpCloud2026", database: process.env.DB_NAME || "emp_billing" } });
  await _probe.raw("SELECT 1");
  await _probe.destroy();
  dbAvailable = true;
} catch {}
const U = String(Date.now()).slice(-6);
let ORG_ID: string;
let CLIENT_ID: string;
let INVOICE_ID: string;
let ADMIN_ID: string;
let _createdUserId: string | null = null;

beforeAll(async () => {
  let db: any;
  try { db = await getDB(); } catch { dbAvailable = false; return; }
  const orgs = await db.findMany("organizations", { where: {}, limit: 1 });
  ORG_ID = (orgs[0] as any)?.id;
  if (!ORG_ID) {
    ORG_ID = uuid();
    await db.create("organizations", { id: ORG_ID, name: "Cov3 Org", currency: "INR", createdAt: new Date(), updatedAt: new Date() });
  }
  const clients = await db.findMany("clients", { where: { org_id: ORG_ID }, limit: 1 });
  CLIENT_ID = (clients[0] as any)?.id;
  if (!CLIENT_ID) {
    CLIENT_ID = uuid();
    await db.create("clients", { id: CLIENT_ID, orgId: ORG_ID, name: "Cov3 Client", displayName: "Cov3 Client", email: `cov3-${U}@test.com`, currency: "INR", totalBilled: 0, totalPaid: 0, outstandingBalance: 0, createdAt: new Date(), updatedAt: new Date() });
  }
  // Always create a SENT invoice for this client (portal rejects draft/void)
  INVOICE_ID = uuid();
  await db.create("invoices", { id: INVOICE_ID, orgId: ORG_ID, clientId: CLIENT_ID, invoiceNumber: `COV3-${U}`, status: InvoiceStatus.SENT, issueDate: new Date(), dueDate: new Date(Date.now() + 30*86400000), currency: "INR", exchangeRate: 1, subtotal: 100000, discountAmount: 0, taxAmount: 0, total: 100000, amountPaid: 0, amountDue: 100000, tdsRate: 0, tdsAmount: 0, createdBy: "system", createdAt: new Date(), updatedAt: new Date() });
  // Ensure a user exists in this org for FK constraints (coupons.created_by, scheduled_reports.created_by)
  const users = await db.findMany("users", { where: { org_id: ORG_ID }, limit: 1 });
  ADMIN_ID = (users[0] as any)?.id;
  if (!ADMIN_ID) {
    ADMIN_ID = uuid();
    _createdUserId = ADMIN_ID;
    await db.create("users", { id: ADMIN_ID, orgId: ORG_ID, email: `cov3-${U}@test-user.com`, passwordHash: "$2b$04$placeholder", firstName: "Cov3", lastName: "Test", role: "admin", isActive: true, emailVerified: false, createdAt: new Date(), updatedAt: new Date() });
  }
}, 30000);

afterAll(async () => {
  if (!dbAvailable) return;
  const db = await getDB();
  try { await db.raw("DELETE FROM quote_items WHERE quote_id IN (SELECT id FROM quotes WHERE org_id = ? AND notes LIKE '%cov3%')", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM quotes WHERE org_id = ? AND notes LIKE '%cov3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM coupons WHERE org_id = ? AND code LIKE '%COV3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM dunning_attempts WHERE org_id = ?", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM disputes WHERE org_id = ? AND reason LIKE '%cov3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM recurring_profiles WHERE org_id = ? AND (created_by = 'cov3-user' OR created_by = ?)", [ORG_ID, ADMIN_ID]); } catch {}
  try { await db.raw("DELETE FROM api_keys WHERE org_id = ? AND name LIKE '%cov3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM scheduled_reports WHERE org_id = ? AND recipient_email LIKE '%cov3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM notifications WHERE org_id = ? AND title LIKE '%cov3%'", [ORG_ID]); } catch {}
  try { await db.raw("DELETE FROM invoice_items WHERE invoice_id = ?", [INVOICE_ID]); } catch {}
  try { await db.raw("DELETE FROM invoices WHERE id = ?", [INVOICE_ID]); } catch {}
  if (_createdUserId) { try { await db.raw("DELETE FROM users WHERE id = ?", [_createdUserId]); } catch {} }
  await closeDB();
}, 15000);

// QUOTE SERVICE (23.9% -> 85%+)
describe.skipIf(!dbAvailable)("Quote cov3", () => {
  let qId: string;
  it("listQuotes", async () => { expect((await quoteService.listQuotes(ORG_ID, { page: 1, limit: 5 }))).toHaveProperty("data"); });
  it("listQuotes status", async () => { expect((await quoteService.listQuotes(ORG_ID, { page: 1, limit: 5, status: QuoteStatus.DRAFT }))).toHaveProperty("data"); });
  it("listQuotes search", async () => { expect((await quoteService.listQuotes(ORG_ID, { page: 1, limit: 5, search: "zzz" })).data.length).toBe(0); });
  it("listQuotes dateRange", async () => { expect((await quoteService.listQuotes(ORG_ID, { page: 1, limit: 5, from: new Date("2020-01-01"), to: new Date("2020-12-31") }))).toHaveProperty("data"); });
  it("createQuote", async () => { const q = await quoteService.createQuote(ORG_ID, "cov3-user", { clientId: CLIENT_ID, issueDate: new Date(), expiryDate: new Date(Date.now() + 30*86400000), currency: "INR", items: [{ name: "Item", quantity: 2, rate: 50000 }] } as any); qId = q.id; expect(q.items.length).toBeGreaterThan(0); });
  it("getQuote", async () => { expect((await quoteService.getQuote(ORG_ID, qId)).items.length).toBeGreaterThan(0); });
  it("updateQuote items", async () => { expect((await quoteService.updateQuote(ORG_ID, qId, { notes: "cov3 updated", items: [{ name: "New", quantity: 3, rate: 60000 }] } as any)).notes).toBe("cov3 updated"); });
  it("updateQuote no items", async () => { expect((await quoteService.updateQuote(ORG_ID, qId, { terms: "Net 30" } as any)).terms).toBe("Net 30"); });
  it("sendQuote", async () => { expect((await quoteService.sendQuote(ORG_ID, qId)).status).toBe(QuoteStatus.SENT); });
  it("acceptQuote", async () => { expect((await quoteService.acceptQuote(ORG_ID, qId)).status).toBe(QuoteStatus.ACCEPTED); });
  it("acceptQuote again", async () => { await expect(quoteService.acceptQuote(ORG_ID, qId)).rejects.toThrow(); });
  it("convertToInvoice", async () => { const r = await quoteService.convertToInvoice(ORG_ID, qId, "cov3-user"); expect(r).toHaveProperty("invoiceId"); });
  it("convertToInvoice again", async () => { await expect(quoteService.convertToInvoice(ORG_ID, qId, "x")).rejects.toThrow(); });
  it("sendQuote converted", async () => { await expect(quoteService.sendQuote(ORG_ID, qId)).rejects.toThrow(); });
  it("updateQuote converted", async () => { await expect(quoteService.updateQuote(ORG_ID, qId, { notes: "x" } as any)).rejects.toThrow(); });
  it("declineQuote converted", async () => { await expect(quoteService.declineQuote(ORG_ID, qId)).rejects.toThrow(); });
  it("getQuote 404", async () => { await expect(quoteService.getQuote(ORG_ID, uuid())).rejects.toThrow(); });
  it("deleteQuote non-draft", async () => { await expect(quoteService.deleteQuote(ORG_ID, qId)).rejects.toThrow(); });
  it("decline flow", async () => {
    const q2 = await quoteService.createQuote(ORG_ID, "cov3-user", { clientId: CLIENT_ID, issueDate: new Date(), expiryDate: new Date(Date.now() + 30*86400000), currency: "INR", items: [{ name: "D", quantity: 1, rate: 10000 }] } as any);
    await quoteService.sendQuote(ORG_ID, q2.id);
    expect((await quoteService.declineQuote(ORG_ID, q2.id)).status).toBe(QuoteStatus.DECLINED);
    await expect(quoteService.declineQuote(ORG_ID, q2.id)).rejects.toThrow();
    await expect(quoteService.convertToInvoice(ORG_ID, q2.id, "x")).rejects.toThrow();
  });
  it("deleteQuote draft", async () => {
    const q3 = await quoteService.createQuote(ORG_ID, "cov3-user", { clientId: CLIENT_ID, issueDate: new Date(), expiryDate: new Date(Date.now() + 30*86400000), currency: "INR", items: [{ name: "Del", quantity: 1, rate: 5000 }] } as any);
    await quoteService.deleteQuote(ORG_ID, q3.id);
    await expect(quoteService.getQuote(ORG_ID, q3.id)).rejects.toThrow();
  });
});

// PORTAL SERVICE (24.7% -> 85%+)
describe.skipIf(!dbAvailable)("Portal cov3", () => {
  it("branding with org", async () => { expect((await portalService.getPortalBranding(ORG_ID))).toHaveProperty("orgName"); });
  it("branding no org", async () => { expect((await portalService.getPortalBranding()).orgName).toBe("EMP Billing"); });
  it("branding unknown", async () => { expect((await portalService.getPortalBranding(uuid())).orgName).toBe("EMP Billing"); });
  it("login bad", async () => { await expect(portalService.portalLogin("x@t.com", "bad")).rejects.toThrow(); });
  it("dashboard", async () => { expect((await portalService.getPortalDashboard(CLIENT_ID, ORG_ID))).toHaveProperty("outstandingBalance"); });
  it("invoices", async () => { expect((await portalService.getPortalInvoices(CLIENT_ID, ORG_ID, { page: 1, limit: 10 }))).toHaveProperty("data"); });
  it("invoice detail", async () => { expect((await portalService.getPortalInvoice(CLIENT_ID, ORG_ID, INVOICE_ID))).toHaveProperty("items"); });
  it("invoice wrong client", async () => { await expect(portalService.getPortalInvoice(uuid(), ORG_ID, INVOICE_ID)).rejects.toThrow(); });
  it("quotes", async () => { expect(Array.isArray(await portalService.getPortalQuotes(CLIENT_ID, ORG_ID))).toBe(true); });
  it("payments", async () => { expect(Array.isArray(await portalService.getPortalPayments(CLIENT_ID, ORG_ID))).toBe(true); });
  it("creditNotes", async () => { expect(Array.isArray(await portalService.getPortalCreditNotes(CLIENT_ID, ORG_ID))).toBe(true); });
  it("subscriptions", async () => { expect(Array.isArray(await portalService.getPortalSubscriptions(CLIENT_ID, ORG_ID))).toBe(true); });
  it("paymentMethod get", async () => { expect((await portalService.getPortalPaymentMethod(CLIENT_ID, ORG_ID))).toHaveProperty("hasPaymentMethod"); });
  it("paymentMethod update", async () => { expect((await portalService.updatePortalPaymentMethod(CLIENT_ID, ORG_ID, { paymentGateway: "stripe", paymentMethodId: "pm_test", last4: "4242", brand: "Visa" })).last4).toBe("4242"); });
  it("paymentMethod remove", async () => { expect((await portalService.removePortalPaymentMethod(CLIENT_ID, ORG_ID)).hasPaymentMethod).toBe(false); });
  it("acceptQuote 404", async () => { await expect(portalService.acceptPortalQuote(CLIENT_ID, ORG_ID, uuid())).rejects.toThrow(); });
  it("declineQuote 404", async () => { await expect(portalService.declinePortalQuote(CLIENT_ID, ORG_ID, uuid())).rejects.toThrow(); });
  it("getSub 404", async () => { await expect(portalService.getPortalSubscription(CLIENT_ID, ORG_ID, uuid())).rejects.toThrow(); });
});

// DUNNING SERVICE (30.4% -> 85%+)
describe.skipIf(!dbAvailable)("Dunning cov3", () => {
  it("getConfig", async () => { expect((await dunningService.getDunningConfig(ORG_ID))).toHaveProperty("maxRetries"); });
  it("updateConfig create", async () => { expect((await dunningService.updateDunningConfig(ORG_ID, { maxRetries: 3, retrySchedule: [1,3,5], gracePeriodDays: 2, cancelAfterAllRetries: true, sendReminderEmails: false })).maxRetries).toBe(3); });
  it("updateConfig update", async () => { expect((await dunningService.updateDunningConfig(ORG_ID, { maxRetries: 5, retrySchedule: [1,2,3,5,7] })).maxRetries).toBe(5); });
  it("createAttempt", async () => { const a = await dunningService.createDunningAttempt(ORG_ID, INVOICE_ID); expect(a.status).toBe(DunningAttemptStatus.PENDING); });
  it("listAttempts", async () => { expect((await dunningService.listDunningAttempts(ORG_ID, { page: 1, limit: 10 })).data.length).toBeGreaterThan(0); });
  it("listAttempts status", async () => { expect((await dunningService.listDunningAttempts(ORG_ID, { status: DunningAttemptStatus.PENDING }))).toHaveProperty("data"); });
  it("listAttempts invoiceId", async () => { expect((await dunningService.listDunningAttempts(ORG_ID, { invoiceId: INVOICE_ID })).data.length).toBeGreaterThan(0); });
  it("processAttempt 404", async () => { await expect(dunningService.processDunningAttempt(uuid(), ORG_ID)).rejects.toThrow(); });
});

// SMS SERVICE (31.6% -> 85%+)
describe.skipIf(!dbAvailable)("SMS cov3", () => {
  it("tpl invoice_sent", () => { expect(smsService.renderSMSTemplate("invoice_sent", { orgName: "X", invoiceNumber: "I-1", amount: "100", currency: "INR", dueDate: "1 Jan", portalUrl: "https://t" })).toContain("I-1"); });
  it("tpl payment_received", () => { expect(smsService.renderSMSTemplate("payment_received", { orgName: "X", invoiceNumber: "I-1", amount: "100", currency: "INR" })).toContain("Payment"); });
  it("tpl reminder overdue", () => { expect(smsService.renderSMSTemplate("payment_reminder", { orgName: "X", invoiceNumber: "I-2", amount: "100", currency: "INR", dueDate: "1 Jan 2020", daysOverdue: 5, portalUrl: "https://t" })).toContain("overdue"); });
  it("tpl reminder not overdue", () => { expect(smsService.renderSMSTemplate("payment_reminder", { orgName: "X", invoiceNumber: "I-3", amount: "100", currency: "INR", dueDate: "31 Dec 2030", daysOverdue: 0, portalUrl: "https://t" })).toContain("due on"); });
  it("setSMSProvider + sendSMS", async () => { smsService.setSMSProvider({ sendSMS: vi.fn().mockResolvedValue({ messageId: "m1", status: "queued" }) }); expect((await smsService.sendSMS("+91999", "Test")).messageId).toBe("m1"); });
  it("sendInvoiceSMS", async () => { smsService.setSMSProvider({ sendSMS: vi.fn().mockResolvedValue({ messageId: "m2", status: "queued" }) }); expect((await smsService.sendInvoiceSMS(ORG_ID, INVOICE_ID, "+91999")).status).toBe("queued"); });
  it("sendInvoiceSMS 404", async () => { expect((await smsService.sendInvoiceSMS(ORG_ID, uuid(), "+91999")).status).toBe("failed"); });
  it("sendPaymentReminderSMS", async () => { smsService.setSMSProvider({ sendSMS: vi.fn().mockResolvedValue({ messageId: "m3", status: "queued" }) }); expect((await smsService.sendPaymentReminderSMS(ORG_ID, INVOICE_ID, "+91999")).status).toBe("queued"); });
  it("sendPaymentReceivedSMS 404", async () => { expect((await smsService.sendPaymentReceivedSMS(ORG_ID, uuid(), "+91999")).status).toBe("failed"); });
  it("TwilioSMSProvider ctor", () => { expect(new smsService.TwilioSMSProvider("sid", "tok", "+1")).toBeDefined(); });
});

// WHATSAPP SERVICE (40% -> 85%+)
describe.skipIf(!dbAvailable)("WhatsApp cov3", () => {
  it("setProvider + send", async () => { whatsappService.setWhatsAppProvider({ sendWhatsApp: vi.fn().mockResolvedValue({ messageId: "w1", status: "queued" }) }); expect((await whatsappService.sendWhatsApp("+91999", "invoice_sent", { orgName: "X" })).messageId).toBe("w1"); });
  it("sendInvoiceWhatsApp", async () => { whatsappService.setWhatsAppProvider({ sendWhatsApp: vi.fn().mockResolvedValue({ messageId: "w2", status: "queued" }) }); expect((await whatsappService.sendInvoiceWhatsApp(ORG_ID, INVOICE_ID, "+91999")).status).toBe("queued"); });
  it("sendInvoiceWhatsApp 404", async () => { expect((await whatsappService.sendInvoiceWhatsApp(ORG_ID, uuid(), "+91999")).status).toBe("failed"); });
  it("sendPaymentReminderWhatsApp", async () => { whatsappService.setWhatsAppProvider({ sendWhatsApp: vi.fn().mockResolvedValue({ messageId: "w3", status: "queued" }) }); expect((await whatsappService.sendPaymentReminderWhatsApp(ORG_ID, INVOICE_ID, "+91999")).status).toBe("queued"); });
  it("sendPaymentReceivedWhatsApp 404", async () => { expect((await whatsappService.sendPaymentReceivedWhatsApp(ORG_ID, uuid(), "+91999")).status).toBe("failed"); });
  it("template param keys", () => { expect(whatsappService.WHATSAPP_TEMPLATE_PARAM_KEYS).toHaveProperty("invoice_sent"); });
  it("TwilioWhatsAppProvider", () => { expect(new whatsappService.TwilioWhatsAppProvider("sid", "tok", "+1")).toBeDefined(); });
  it("MetaWhatsAppProvider", () => { expect(new whatsappService.MetaWhatsAppProvider("pid", "at")).toBeDefined(); });
});

// PRICING SERVICE (34.4% -> 85%+)
describe.skipIf(!dbAvailable)("Pricing cov3", () => {
  it("FLAT", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.FLAT, rate: 1000 } as any, 5)).toBe(5000); });
  it("PER_SEAT", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.PER_SEAT, rate: 500 } as any, 10)).toBe(5000); });
  it("TIERED", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.TIERED, rate: 0, pricingTiers: [{ upTo: 10, unitPrice: 100 }, { upTo: 50, unitPrice: 80 }, { upTo: null, unitPrice: 50 }] } as any, 75)).toBe(5450); });
  it("VOLUME", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.VOLUME, rate: 0, pricingTiers: [{ upTo: 10, unitPrice: 100, flatFee: 500 }, { upTo: 50, unitPrice: 80 }, { upTo: null, unitPrice: 50 }] } as any, 30)).toBe(2400); });
  it("METERED tiers", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.METERED, rate: 100, pricingTiers: [{ upTo: null, unitPrice: 200 }] } as any, 5)).toBe(1000); });
  it("METERED no tiers", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.METERED, rate: 100, pricingTiers: [] } as any, 5)).toBe(500); });
  it("unknown", () => { expect(pricingService.calculatePrice({ pricingModel: "unknown", rate: 100 } as any, 3)).toBe(300); });
  it("breakdown", () => { expect(pricingService.getTieredPriceBreakdown([{ upTo: 10, unitPrice: 100 }, { upTo: null, unitPrice: 50 }] as any, 15).length).toBe(2); });
  it("breakdown empty", () => { expect(pricingService.getTieredPriceBreakdown([], 10).length).toBe(0); });
  it("VOLUME flatFee", () => { expect(pricingService.calculatePrice({ pricingModel: PricingModel.VOLUME, rate: 0, pricingTiers: [{ upTo: 10, unitPrice: 100, flatFee: 500 }] } as any, 5)).toBe(1000); });
  it("recordUsage", async () => {
    const db = await getDB(); const pid = uuid();
    await db.create("products", { id: pid, orgId: ORG_ID, name: "Cov3M", rate: 100, pricingModel: PricingModel.METERED, isActive: true, createdAt: new Date(), updatedAt: new Date() });
    expect((await pricingService.recordUsage(ORG_ID, { productId: pid, clientId: CLIENT_ID, quantity: 10, periodStart: new Date(), periodEnd: new Date(Date.now()+30*86400000) } as any))).toHaveProperty("id");
    try { await db.raw("DELETE FROM usage_records WHERE product_id = ?", [pid]); await db.raw("DELETE FROM products WHERE id = ?", [pid]); } catch {}
  });
  it("recordUsage non-metered", async () => {
    const db = await getDB(); const pid = uuid();
    await db.create("products", { id: pid, orgId: ORG_ID, name: "Cov3F", rate: 100, pricingModel: PricingModel.FLAT, isActive: true, createdAt: new Date(), updatedAt: new Date() });
    await expect(pricingService.recordUsage(ORG_ID, { productId: pid, clientId: CLIENT_ID, quantity: 5, periodStart: new Date(), periodEnd: new Date(Date.now()+30*86400000) } as any)).rejects.toThrow(/metered/i);
    try { await db.raw("DELETE FROM products WHERE id = ?", [pid]); } catch {}
  });
  it("listUsageRecords", async () => { expect((await pricingService.listUsageRecords(ORG_ID, { page: 1, limit: 5 } as any))).toHaveProperty("data"); });
  it("getUsageSummary 404", async () => { await expect(pricingService.getUsageSummary(ORG_ID, uuid(), CLIENT_ID, new Date(), new Date())).rejects.toThrow(); });
  it("reportUsage non-metered", async () => {
    const db = await getDB(); const pid = uuid();
    await db.create("products", { id: pid, orgId: ORG_ID, name: "Cov3F2", rate: 100, pricingModel: PricingModel.FLAT, isActive: true, createdAt: new Date(), updatedAt: new Date() });
    await expect(pricingService.reportUsage(ORG_ID, { productId: pid, clientId: CLIENT_ID, quantity: 5 } as any)).rejects.toThrow(/metered/i);
    try { await db.raw("DELETE FROM products WHERE id = ?", [pid]); } catch {}
  });
});

// API KEY SERVICE (38.3% -> 85%+)
describe.skipIf(!dbAvailable)("ApiKey cov3", () => {
  let rawKey: string, keyId: string;
  it("create", async () => { const r = await apiKeyService.createApiKey(ORG_ID, `cov3-key-${U}`, ["invoices:read"], new Date(Date.now()+365*86400000)); rawKey = r.rawKey; keyId = r.apiKey.id; expect(rawKey).toContain("empb_live_"); });
  it("list", async () => { expect((await apiKeyService.listApiKeys(ORG_ID)).find(k => k.id === keyId)).toBeDefined(); });
  it("validate", async () => { expect((await apiKeyService.validateApiKey(rawKey)).orgId).toBe(ORG_ID); });
  it("validate invalid", async () => { await expect(apiKeyService.validateApiKey("empb_live_invalid")).rejects.toThrow(); });
  it("revoke", async () => { await apiKeyService.revokeApiKey(ORG_ID, keyId); await expect(apiKeyService.validateApiKey(rawKey)).rejects.toThrow(/revoked/i); });
  it("revoke 404", async () => { await expect(apiKeyService.revokeApiKey(ORG_ID, uuid())).rejects.toThrow(); });
});

// RECURRING SERVICE (40.9% -> 85%+)
describe.skipIf(!dbAvailable)("Recurring cov3", () => {
  let pId: string;
  it("monthly", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.MONTHLY).getMonth()).toBe(1); });
  it("weekly", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.WEEKLY).getDate()).toBe(22); });
  it("daily", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.DAILY).getDate()).toBe(16); });
  it("quarterly", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.QUARTERLY).getMonth()).toBe(3); });
  it("half_yearly", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.HALF_YEARLY).getMonth()).toBe(6); });
  it("yearly", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.YEARLY).getFullYear()).toBe(2027); });
  it("custom", () => { expect(recurringService.computeNextDate(new Date("2026-01-15"), RecurringFrequency.CUSTOM, 14).getDate()).toBe(29); });
  it("custom no days", () => { expect(() => recurringService.computeNextDate(new Date(), RecurringFrequency.CUSTOM)).toThrow(); });
  it("create", async () => { const p = await recurringService.createProfile(ORG_ID, ADMIN_ID, { clientId: CLIENT_ID, type: "invoice", frequency: RecurringFrequency.MONTHLY, startDate: new Date(), templateData: { items: [] } } as any); pId = p.id; });
  it("get", async () => { expect((await recurringService.getProfile(ORG_ID, pId)).id).toBe(pId); });
  it("list", async () => { expect((await recurringService.listProfiles(ORG_ID, {})).data.length).toBeGreaterThan(0); });
  it("update", async () => { expect(Boolean((await recurringService.updateProfile(ORG_ID, pId, { frequency: RecurringFrequency.WEEKLY, autoSend: true } as any)).autoSend)).toBe(true); });
  it("pause", async () => { expect((await recurringService.pauseProfile(ORG_ID, pId)).status).toBe(RecurringStatus.PAUSED); });
  it("pause again", async () => { await expect(recurringService.pauseProfile(ORG_ID, pId)).rejects.toThrow(); });
  it("resume", async () => { expect((await recurringService.resumeProfile(ORG_ID, pId)).status).toBe(RecurringStatus.ACTIVE); });
  it("resume again", async () => { await expect(recurringService.resumeProfile(ORG_ID, pId)).rejects.toThrow(); });
  it("executions", async () => { expect(Array.isArray(await recurringService.getExecutions(ORG_ID, pId))).toBe(true); });
  it("delete", async () => { await recurringService.deleteProfile(ORG_ID, pId); await expect(recurringService.getProfile(ORG_ID, pId)).rejects.toThrow(); });
});

// DISPUTE SERVICE (41.1% -> 85%+)
describe.skipIf(!dbAvailable)("Dispute cov3", () => {
  let dId: string;
  it("list", async () => { expect((await disputeService.listDisputes(ORG_ID, { page: 1, limit: 10 } as any))).toHaveProperty("data"); });
  it("create", async () => { const d = await disputeService.createDispute(ORG_ID, CLIENT_ID, { invoiceId: INVOICE_ID, reason: "cov3 dispute" }); dId = d.id; expect(d.status).toBe(DisputeStatus.OPEN); });
  it("get", async () => { expect((await disputeService.getDispute(ORG_ID, dId)).reason).toContain("cov3"); });
  it("update resolve", async () => { expect((await disputeService.updateDispute(ORG_ID, dId, { status: DisputeStatus.RESOLVED, resolution: "Done", adminNotes: "Notes" }, ADMIN_ID)).resolvedBy).toBe(ADMIN_ID); });
  it("get 404", async () => { await expect(disputeService.getDispute(ORG_ID, uuid())).rejects.toThrow(); });
  it("create no invoice", async () => { expect((await disputeService.createDispute(ORG_ID, CLIENT_ID, { reason: "cov3 general" }))).toHaveProperty("id"); });
});

// COUPON SERVICE (45.8% -> 85%+)
describe.skipIf(!dbAvailable)("Coupon cov3", () => {
  let cId: string;
  it("create", async () => { const c = await couponService.createCoupon(ORG_ID, ADMIN_ID, { code: `COV3-${U}`, name: "Cov3", type: CouponType.PERCENTAGE, value: 10, appliesTo: CouponAppliesTo.INVOICE, validFrom: new Date() } as any); cId = c.id; });
  it("list", async () => { expect((await couponService.listCoupons(ORG_ID, { page: 1, limit: 10 } as any))).toHaveProperty("data"); });
  it("list search", async () => { expect((await couponService.listCoupons(ORG_ID, { page: 1, limit: 10, search: "COV3" } as any)).data.length).toBeGreaterThan(0); });
  it("get", async () => { expect((await couponService.getCoupon(ORG_ID, cId)).value).toBe(10); });
  it("update", async () => { expect((await couponService.updateCoupon(ORG_ID, cId, { name: "Updated" } as any)).name).toBe("Updated"); });
  it("validate", async () => { const r = await couponService.validateCoupon(ORG_ID, `COV3-${U}`, 100000); expect(r.valid).toBe(true); });
  it("validate invalid", async () => { await expect(couponService.validateCoupon(ORG_ID, "NONEXIST")).rejects.toThrow(); });
  it("create dup", async () => { await expect(couponService.createCoupon(ORG_ID, ADMIN_ID, { code: `COV3-${U}`, name: "Dup", type: CouponType.PERCENTAGE, value: 5, appliesTo: CouponAppliesTo.INVOICE, validFrom: new Date() } as any)).rejects.toThrow(); });
  it("delete", async () => { await couponService.deleteCoupon(ORG_ID, cId); await expect(couponService.validateCoupon(ORG_ID, `COV3-${U}`)).rejects.toThrow(/active/i); });
});

// AUDIT SERVICE (46.4% -> 85%+)
describe.skipIf(!dbAvailable)("Audit cov3", () => {
  it("list", async () => { expect((await auditService.listAuditLogs(ORG_ID, { page: 1, limit: 5 }))).toHaveProperty("data"); });
  it("list entity", async () => { expect((await auditService.listAuditLogs(ORG_ID, { page: 1, limit: 5, entityType: "invoice" }))).toHaveProperty("data"); });
  it("list dates", async () => { expect((await auditService.listAuditLogs(ORG_ID, { page: 1, limit: 5, from: new Date("2020-01-01"), to: new Date("2030-12-31") }))).toHaveProperty("data"); });
  it("list userId", async () => { expect((await auditService.listAuditLogs(ORG_ID, { page: 1, limit: 5, userId: "none" })).data.length).toBe(0); });
});

// NOTIFICATION SERVICE (48% -> 85%+)
describe.skipIf(!dbAvailable)("Notification cov3", () => {
  it("create", async () => { expect((await notificationService.createNotification(ORG_ID, { type: "invoice_created" as any, title: "cov3 notif", message: "Test" }))).toHaveProperty("id"); });
  it("dispatch in_app", async () => { await notificationService.dispatchNotification({ orgId: ORG_ID, type: "invoice_created" as any, title: "cov3 d", message: "Test", channels: ["in_app"] }); });
  it("dispatch sms+wa", async () => {
    smsService.setSMSProvider({ sendSMS: vi.fn().mockResolvedValue({ messageId: "x", status: "queued" }) });
    whatsappService.setWhatsAppProvider({ sendWhatsApp: vi.fn().mockResolvedValue({ messageId: "x", status: "queued" }) });
    await notificationService.dispatchNotification({ orgId: ORG_ID, type: "invoice_sent" as any, title: "cov3 multi", message: "m", channels: ["in_app", "sms", "whatsapp"], clientPhone: "+91999", invoiceId: INVOICE_ID });
  });
  it("dispatch payment_received", async () => { await notificationService.dispatchNotification({ orgId: ORG_ID, type: "payment_received" as any, title: "cov3 pay", message: "p", channels: ["sms", "whatsapp"], clientPhone: "+91999", paymentId: uuid() }); });
  it("dispatch overdue", async () => { await notificationService.dispatchNotification({ orgId: ORG_ID, type: "invoice_overdue" as any, title: "cov3 od", message: "o", channels: ["sms", "whatsapp"], clientPhone: "+91999", invoiceId: INVOICE_ID }); });
  it("dispatch unknown type", async () => { await notificationService.dispatchNotification({ orgId: ORG_ID, type: "trial_ending" as any, title: "cov3 t", message: "t", channels: ["sms", "whatsapp"], clientPhone: "+91999" }); });
});

// PRORATION SERVICE (41.5% -> 85%+)
describe.skipIf(!dbAvailable)("Proration cov3", () => {
  it("upgrade", () => { const now = new Date(); const r = prorationService.calculateProration({ currentPeriodStart: new Date(now.getTime()-15*86400000), currentPeriodEnd: new Date(now.getTime()+15*86400000), quantity: 1 } as any, { price: 10000, currency: "INR" } as any, { price: 20000, currency: "INR" } as any); expect(r.isUpgrade).toBe(true); });
  it("downgrade", () => { const now = new Date(); const r = prorationService.calculateProration({ currentPeriodStart: new Date(now.getTime()-15*86400000), currentPeriodEnd: new Date(now.getTime()+15*86400000), quantity: 1 } as any, { price: 20000, currency: "INR" } as any, { price: 10000, currency: "INR" } as any); expect(r.isUpgrade).toBe(false); });
  it("zero remaining", () => { expect(prorationService.calculateProration({ currentPeriodStart: new Date(), currentPeriodEnd: new Date(), quantity: 1 } as any, { price: 10000, currency: "INR" } as any, { price: 20000, currency: "INR" } as any).netAmount).toBe(0); });
});

// SCHEDULED REPORT SERVICE (29.9% -> 85%+)
describe.skipIf(!dbAvailable)("ScheduledReport cov3", () => {
  let rId: string;
  it("computeNext daily", () => { expect(scheduledReportService.computeNextSendAt("daily" as any).getHours()).toBe(8); });
  it("computeNext weekly", () => { expect(scheduledReportService.computeNextSendAt("weekly" as any).getDay()).toBe(1); });
  it("computeNext monthly", () => { expect(scheduledReportService.computeNextSendAt("monthly" as any).getDate()).toBe(1); });
  it("create", async () => { const r = await scheduledReportService.createScheduledReport(ORG_ID, ADMIN_ID, { reportType: "revenue", frequency: "weekly" as any, recipientEmail: `cov3-${U}@test.com` }); rId = r.id; });
  it("list", async () => { expect((await scheduledReportService.listScheduledReports(ORG_ID)).length).toBeGreaterThan(0); });
  it("update", async () => { expect(await scheduledReportService.updateScheduledReport(ORG_ID, rId, { frequency: "daily" as any })).toBeDefined(); });
  it("getDue", async () => { expect(Array.isArray(await scheduledReportService.getDueReports())).toBe(true); });
  it("delete", async () => { await scheduledReportService.deleteScheduledReport(ORG_ID, rId); });
});

// TEAM SERVICE (30% -> 85%+)
describe.skipIf(!dbAvailable)("Team cov3", () => {
  it("list", async () => { expect(Array.isArray(await teamService.listMembers(ORG_ID))).toBe(true); });
  it("removeMember self", async () => { if (ADMIN_ID) await expect(teamService.removeMember(ORG_ID, ADMIN_ID, ADMIN_ID)).rejects.toThrow(/yourself/); });
  it("removeMember 404", async () => { await expect(teamService.removeMember(ORG_ID, uuid(), "x")).rejects.toThrow(); });
});
