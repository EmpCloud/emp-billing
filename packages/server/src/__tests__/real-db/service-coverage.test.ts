// ============================================================================
// EMP BILLING - Real-DB Service-Coverage Tests
// Imports ACTUAL service functions so Vitest coverage tracks them.
// Mocks only side-effects (email queue, events, PDF, gateways).
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { v4 as uuid } from "uuid";

// -- Set env vars BEFORE config is loaded -----------------------------------
process.env.DB_PROVIDER = "mysql";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "empcloud";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "";
process.env.DB_NAME = "emp_billing";
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-jwt-secret-for-coverage";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-for-coverage";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

// -- Mock side-effects (BEFORE service imports) -----------------------------

vi.mock("../../jobs/queue", () => ({
  emailQueue: { add: vi.fn().mockResolvedValue({}) },
  recurringQueue: { add: vi.fn().mockResolvedValue({}) },
  reminderQueue: { add: vi.fn().mockResolvedValue({}) },
  pdfQueue: { add: vi.fn().mockResolvedValue({}) },
  scheduledReportQueue: { add: vi.fn().mockResolvedValue({}) },
  dunningQueue: { add: vi.fn().mockResolvedValue({}) },
  subscriptionQueue: { add: vi.fn().mockResolvedValue({}) },
  usageBillingQueue: { add: vi.fn().mockResolvedValue({}) },
  QUEUE_NAMES: {
    EMAIL: "email",
    RECURRING: "recurring-invoices",
    REMINDERS: "payment-reminders",
    PDF: "pdf-generation",
    SCHEDULED_REPORTS: "scheduled-reports",
    DUNNING: "dunning-retries",
    SUBSCRIPTIONS: "subscription-billing",
    USAGE_BILLING: "usage-billing",
  },
}));

vi.mock("../../events/index", () => ({
  emit: vi.fn(),
  on: vi.fn(),
}));

vi.mock("../../utils/pdf", () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateQuotePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateReceiptPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateCreditNotePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  generateStatementPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

vi.mock("../../services/payment/gateways/index", () => ({
  getGateway: vi.fn().mockReturnValue({
    charge: vi.fn().mockResolvedValue({ success: true, transactionId: "mock-txn" }),
    refund: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

// -- Import actual services -------------------------------------------------
import * as invoiceService from "../../services/invoice/invoice.service";
import * as paymentService from "../../services/payment/payment.service";
import * as couponService from "../../services/coupon/coupon.service";
import * as dunningService from "../../services/dunning/dunning.service";
import * as portalService from "../../services/portal/portal.service";
import * as subscriptionService from "../../services/subscription/subscription.service";
import { closeDB, getDB } from "../../db/adapters/index";
import {
  InvoiceStatus,
  CouponType,
  CouponAppliesTo,
  PaymentMethod,
  DunningAttemptStatus,
  BillingInterval,
  PricingModel,
  SubscriptionStatus,
} from "@emp-billing/shared";

// -- Test constants ---------------------------------------------------------
let dbAvailable = false;
try {
  const { default: _knex } = await import("knex");
  const _probe = _knex({ client: "mysql2", connection: { host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || "empcloud", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "emp_billing" } });
  await _probe.raw("SELECT 1");
  await _probe.destroy();
  dbAvailable = true;
} catch {}
const TS = Date.now();
const TEST_ORG_ID = uuid();
const TEST_USER_ID = uuid();
const TEST_CLIENT_ID = uuid();

// -- Setup & Teardown -------------------------------------------------------

beforeAll(async () => {
  let db: any;
  try { db = await getDB(); } catch { dbAvailable = false; return; }

  await db.create("organizations", {
    id: TEST_ORG_ID,
    name: `SvcTestOrg-${TS}`,
    legalName: `SvcTestOrg Legal-${TS}`,
    email: `svctest-${TS}@billing.test`,
    address: JSON.stringify({ line1: "1 Test Ave", city: "Mumbai", state: "MH", zip: "400001", country: "IN" }),
    defaultCurrency: "INR",
    country: "IN",
    invoicePrefix: "SVC",
    invoiceNextNumber: 1,
    quotePrefix: "SQT",
    quoteNextNumber: 1,
  });

  await db.create("users", {
    id: TEST_USER_ID,
    orgId: TEST_ORG_ID,
    email: `svcuser-${TS}@billing.test`,
    passwordHash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
    firstName: "Svc",
    lastName: "Tester",
    role: "admin",
  });

  await db.create("clients", {
    id: TEST_CLIENT_ID,
    orgId: TEST_ORG_ID,
    name: `SvcClient-${TS}`,
    displayName: `Svc Client ${TS}`,
    email: `svcclient-${TS}@billing.test`,
    currency: "INR",
    paymentTerms: 30,
    outstandingBalance: 0,
    totalBilled: 0,
    totalPaid: 0,
  });
}, 30000);

afterAll(async () => {
  if (!dbAvailable) return;
  const db = await getDB();

  const orgTables = [
    "subscription_events", "coupon_redemptions", "payment_allocations",
    "dunning_attempts", "dunning_configs", "credit_note_items", "invoice_items",
    "disputes", "notifications", "audit_logs", "api_keys", "payments",
    "credit_notes", "quotes", "coupons", "subscriptions", "plans", "invoices",
  ];
  for (const table of orgTables) {
    try { await db.deleteMany(table, { org_id: TEST_ORG_ID }); } catch { /* ignore */ }
  }
  try { await db.deleteMany("client_portal_access", { org_id: TEST_ORG_ID }); } catch { /* ignore */ }
  try {
    await db.delete("clients", TEST_CLIENT_ID);
    await db.delete("users", TEST_USER_ID);
    await db.delete("organizations", TEST_ORG_ID);
  } catch { /* ignore */ }

  await closeDB();
}, 30000);

// ============================================================================
// 1. INVOICE SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("InvoiceService -- real DB", () => {
  let createdInvoiceId: string;

  it("createInvoice -- creates invoice with items", async () => {
    const result = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [
        { name: "Consulting", quantity: 2, rate: 50000 },
        { name: "Support", quantity: 1, rate: 25000 },
      ],
    } as any);

    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    expect(result.items).toHaveLength(2);
    expect(result.status).toBe(InvoiceStatus.DRAFT);
    createdInvoiceId = result.id;
  });

  it("getInvoice -- retrieves invoice with items", async () => {
    const inv = await invoiceService.getInvoice(TEST_ORG_ID, createdInvoiceId);
    expect(inv.id).toBe(createdInvoiceId);
    expect(inv.items).toHaveLength(2);
  });

  it("listInvoices -- paginates invoices", async () => {
    const result = await invoiceService.listInvoices(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("sendInvoice -- transitions DRAFT to SENT", async () => {
    const sent = await invoiceService.sendInvoice(TEST_ORG_ID, createdInvoiceId);
    expect(sent.status).toBe(InvoiceStatus.SENT);
  });

  it("getInvoice -- reflects SENT status", async () => {
    const inv = await invoiceService.getInvoice(TEST_ORG_ID, createdInvoiceId);
    expect(inv.status).toBe(InvoiceStatus.SENT);
  });

  it("duplicateInvoice -- clones an invoice", async () => {
    const dup = await invoiceService.duplicateInvoice(TEST_ORG_ID, createdInvoiceId, TEST_USER_ID);
    expect(dup.id).not.toBe(createdInvoiceId);
    expect(dup.status).toBe(InvoiceStatus.DRAFT);
    expect(dup.items).toHaveLength(2);
  });

  it("listInvoices -- search filter works", async () => {
    const inv = await invoiceService.getInvoice(TEST_ORG_ID, createdInvoiceId);
    const result = await invoiceService.listInvoices(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      search: inv.invoiceNumber,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].invoiceNumber).toBe(inv.invoiceNumber);
  });

  it("getInvoicePayments -- returns empty for unpaid invoice", async () => {
    const payments = await invoiceService.getInvoicePayments(TEST_ORG_ID, createdInvoiceId);
    expect(payments).toEqual([]);
  });

  it("markOverdueInvoices -- marks past-due sent invoices", async () => {
    const overdue = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(Date.now() - 60 * 86400000),
      dueDate: new Date(Date.now() - 10 * 86400000),
      items: [{ name: "Old service", quantity: 1, rate: 10000 }],
    } as any);
    await invoiceService.sendInvoice(TEST_ORG_ID, overdue.id);
    const count = await invoiceService.markOverdueInvoices(TEST_ORG_ID);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("voidInvoice -- transitions to VOID", async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [{ name: "Void test", quantity: 1, rate: 5000 }],
    } as any);
    await invoiceService.sendInvoice(TEST_ORG_ID, inv.id);
    const voided = await invoiceService.voidInvoice(TEST_ORG_ID, inv.id);
    expect(voided.status).toBe(InvoiceStatus.VOID);
  });

  it("deleteInvoice -- removes draft invoice", async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [{ name: "Delete test", quantity: 1, rate: 1000 }],
    } as any);
    await invoiceService.deleteInvoice(TEST_ORG_ID, inv.id);
    await expect(invoiceService.getInvoice(TEST_ORG_ID, inv.id)).rejects.toThrow();
  });

  it("getInvoicePdf -- returns a PDF buffer", async () => {
    const buf = await invoiceService.getInvoicePdf(TEST_ORG_ID, createdInvoiceId);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it("getInvoice -- throws for non-existent id", async () => {
    await expect(invoiceService.getInvoice(TEST_ORG_ID, uuid())).rejects.toThrow();
  });
});

// ============================================================================
// 2. PAYMENT SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("PaymentService -- real DB", () => {
  let invoiceId: string;
  let paymentId: string;

  beforeAll(async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [{ name: "Payment test service", quantity: 1, rate: 100000 }],
    } as any);
    await invoiceService.sendInvoice(TEST_ORG_ID, inv.id);
    invoiceId = inv.id;
  });

  it("recordPayment -- partial payment", async () => {
    const payment = await paymentService.recordPayment(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      invoiceId,
      amount: 50000,
      method: PaymentMethod.BANK_TRANSFER,
      date: new Date(),
    } as any);
    expect(payment).toBeTruthy();
    expect(payment.amount).toBe(50000);
    paymentId = payment.id;

    const inv = await invoiceService.getInvoice(TEST_ORG_ID, invoiceId);
    expect(inv.status).toBe(InvoiceStatus.PARTIALLY_PAID);
  });

  it("getPayment -- retrieves payment", async () => {
    const p = await paymentService.getPayment(TEST_ORG_ID, paymentId);
    expect(p.id).toBe(paymentId);
    expect(p.amount).toBe(50000);
  });

  it("listPayments -- returns paginated results", async () => {
    const result = await paymentService.listPayments(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("listPayments -- filter by client", async () => {
    const result = await paymentService.listPayments(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      clientId: TEST_CLIENT_ID,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((p: any) => expect(p.clientId).toBe(TEST_CLIENT_ID));
  });

  it("recordPayment -- full payment closes invoice", async () => {
    const inv = await invoiceService.getInvoice(TEST_ORG_ID, invoiceId);
    const remaining = inv.amountDue;

    const payment = await paymentService.recordPayment(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      invoiceId,
      amount: remaining,
      method: PaymentMethod.CASH,
      date: new Date(),
    } as any);
    expect(payment).toBeTruthy();

    const paid = await invoiceService.getInvoice(TEST_ORG_ID, invoiceId);
    expect(paid.status).toBe(InvoiceStatus.PAID);
  });

  it("getInvoicePayments -- returns payments for invoice", async () => {
    const payments = await invoiceService.getInvoicePayments(TEST_ORG_ID, invoiceId);
    expect(payments.length).toBeGreaterThanOrEqual(2);
  });

  it("refundPayment -- creates a refund", async () => {
    const refund = await paymentService.refundPayment(TEST_ORG_ID, paymentId, TEST_USER_ID, {
      amount: 10000,
      reason: "Service coverage test refund",
    } as any);
    expect(refund.isRefund).toBeTruthy();
    expect(refund.amount).toBe(10000);
  });

  it("refundPayment -- rejects over-refund", async () => {
    await expect(
      paymentService.refundPayment(TEST_ORG_ID, paymentId, TEST_USER_ID, {
        amount: 999999,
      } as any)
    ).rejects.toThrow();
  });

  it("getPayment -- throws for non-existent id", async () => {
    await expect(paymentService.getPayment(TEST_ORG_ID, uuid())).rejects.toThrow();
  });

  it("recordPayment -- without invoice (on-account)", async () => {
    const payment = await paymentService.recordPayment(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      amount: 5000,
      method: PaymentMethod.CASH,
      date: new Date(),
    } as any);
    expect(payment).toBeTruthy();
    expect(payment.amount).toBe(5000);
  });

  it("deletePayment -- removes payment and reverses allocation", async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [{ name: "Delete pay test", quantity: 1, rate: 20000 }],
    } as any);
    await invoiceService.sendInvoice(TEST_ORG_ID, inv.id);
    const pay = await paymentService.recordPayment(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      invoiceId: inv.id,
      amount: 20000,
      method: PaymentMethod.BANK_TRANSFER,
      date: new Date(),
    } as any);
    await paymentService.deletePayment(TEST_ORG_ID, pay.id);
    await expect(paymentService.getPayment(TEST_ORG_ID, pay.id)).rejects.toThrow();
  });
});

// ============================================================================
// 3. COUPON SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("CouponService -- real DB", () => {
  let couponId: string;
  const couponCode = `SVC${TS}`;

  it("createCoupon -- percentage coupon", async () => {
    const coupon = await couponService.createCoupon(TEST_ORG_ID, TEST_USER_ID, {
      code: couponCode,
      name: "Svc Test Coupon",
      type: CouponType.PERCENTAGE,
      value: 10,
      appliesTo: CouponAppliesTo.ALL,
      validFrom: new Date(),
    } as any);
    expect(coupon).toBeTruthy();
    expect(coupon.code).toBe(couponCode.toUpperCase());
    expect(coupon.type).toBe(CouponType.PERCENTAGE);
    expect(coupon.value).toBe(10);
    couponId = coupon.id;
  });

  it("getCoupon -- retrieves by id", async () => {
    const c = await couponService.getCoupon(TEST_ORG_ID, couponId);
    expect(c.id).toBe(couponId);
    expect(c.code).toBe(couponCode.toUpperCase());
  });

  it("listCoupons -- paginates", async () => {
    const result = await couponService.listCoupons(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("listCoupons -- search filter", async () => {
    const result = await couponService.listCoupons(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      search: couponCode,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("updateCoupon -- changes name and value", async () => {
    const updated = await couponService.updateCoupon(TEST_ORG_ID, couponId, {
      name: "Updated Svc Coupon",
      value: 15,
    } as any);
    expect(updated.name).toBe("Updated Svc Coupon");
    expect(updated.value).toBe(15);
  });

  it("createCoupon -- fixed amount coupon", async () => {
    const coupon = await couponService.createCoupon(TEST_ORG_ID, TEST_USER_ID, {
      code: `FIX${TS}`,
      name: "Fixed Coupon",
      type: CouponType.FIXED_AMOUNT,
      value: 5000,
      currency: "INR",
      appliesTo: CouponAppliesTo.ALL,
      validFrom: new Date(),
      maxRedemptions: 5,
      minAmount: 10000,
    } as any);
    expect(coupon.type).toBe(CouponType.FIXED_AMOUNT);
    expect(coupon.value).toBe(5000);
    expect(coupon.maxRedemptions).toBe(5);
  });

  it("createCoupon -- rejects duplicate code", async () => {
    await expect(
      couponService.createCoupon(TEST_ORG_ID, TEST_USER_ID, {
        code: couponCode,
        name: "Duplicate",
        type: CouponType.PERCENTAGE,
        value: 5,
        appliesTo: CouponAppliesTo.ALL,
        validFrom: new Date(),
      } as any)
    ).rejects.toThrow();
  });

  it("validateCoupon -- valid coupon returns discount", async () => {
    const result = await couponService.validateCoupon(
      TEST_ORG_ID,
      couponCode,
      100000,
      TEST_CLIENT_ID
    );
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(15000);
  });

  it("validateCoupon -- throws for invalid code", async () => {
    await expect(
      couponService.validateCoupon(TEST_ORG_ID, "NONEXISTENT999", 100000)
    ).rejects.toThrow();
  });

  it("applyCoupon -- applies coupon to invoice", async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      items: [{ name: "Coupon test item", quantity: 1, rate: 100000 }],
    } as any);

    const redemption = await couponService.applyCoupon(
      TEST_ORG_ID,
      couponCode,
      inv.id,
      TEST_CLIENT_ID
    );
    expect(redemption).toBeTruthy();
    expect(redemption.discountAmount).toBeGreaterThan(0);
  });

  it("getRedemptions -- lists redemptions for coupon", async () => {
    const result = await couponService.getRedemptions(TEST_ORG_ID, couponId);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteCoupon -- deactivates coupon", async () => {
    await couponService.deleteCoupon(TEST_ORG_ID, couponId);
    const c = await couponService.getCoupon(TEST_ORG_ID, couponId);
    expect(c.isActive).toBeFalsy();
  });

  it("validateCoupon -- rejects deactivated coupon", async () => {
    await expect(
      couponService.validateCoupon(TEST_ORG_ID, couponCode, 100000)
    ).rejects.toThrow();
  });

  it("getCoupon -- throws for non-existent id", async () => {
    await expect(couponService.getCoupon(TEST_ORG_ID, uuid())).rejects.toThrow();
  });
});

// ============================================================================
// 4. DUNNING SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("DunningService -- real DB", () => {
  let attemptId: string;
  let dunningInvoiceId: string;

  beforeAll(async () => {
    const inv = await invoiceService.createInvoice(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      currency: "INR",
      issueDate: new Date(Date.now() - 30 * 86400000),
      dueDate: new Date(Date.now() - 5 * 86400000),
      items: [{ name: "Dunning test service", quantity: 1, rate: 75000 }],
    } as any);
    await invoiceService.sendInvoice(TEST_ORG_ID, inv.id);
    dunningInvoiceId = inv.id;
  });

  it("getDunningConfig -- returns defaults for new org", async () => {
    const config = await dunningService.getDunningConfig(TEST_ORG_ID);
    expect(config).toBeTruthy();
    expect(config.maxRetries).toBe(4);
    expect(config.retrySchedule).toEqual([1, 3, 5, 7]);
    expect(config.gracePeriodDays).toBe(3);
    expect(config.cancelAfterAllRetries).toBeTruthy();
    expect(config.sendReminderEmails).toBeTruthy();
  });

  it("updateDunningConfig -- creates config for new org", async () => {
    const config = await dunningService.updateDunningConfig(TEST_ORG_ID, {
      maxRetries: 3,
      retrySchedule: [2, 4, 6],
      gracePeriodDays: 5,
      cancelAfterAllRetries: false,
      sendReminderEmails: true,
    });
    expect(config.maxRetries).toBe(3);
    expect(config.gracePeriodDays).toBe(5);
  });

  it("updateDunningConfig -- updates existing config", async () => {
    const config = await dunningService.updateDunningConfig(TEST_ORG_ID, {
      maxRetries: 5,
      retrySchedule: [1, 2, 3, 5, 7],
      gracePeriodDays: 2,
      cancelAfterAllRetries: true,
      sendReminderEmails: false,
    });
    expect(config.maxRetries).toBe(5);
    expect(config.gracePeriodDays).toBe(2);
  });

  it("createDunningAttempt -- creates pending attempt", async () => {
    const attempt = await dunningService.createDunningAttempt(
      TEST_ORG_ID,
      dunningInvoiceId
    );
    expect(attempt).toBeTruthy();
    expect(attempt.status).toBe(DunningAttemptStatus.PENDING);
    expect(attempt.attemptNumber).toBe(1);
    attemptId = attempt.id;
  });

  it("listDunningAttempts -- paginates", async () => {
    const result = await dunningService.listDunningAttempts(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("listDunningAttempts -- filter by status", async () => {
    const result = await dunningService.listDunningAttempts(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      status: DunningAttemptStatus.PENDING,
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    result.data.forEach((a: any) => expect(a.status).toBe(DunningAttemptStatus.PENDING));
  });

  it("listDunningAttempts -- filter by invoiceId", async () => {
    const result = await dunningService.listDunningAttempts(TEST_ORG_ID, {
      page: 1,
      limit: 10,
      invoiceId: dunningInvoiceId,
    });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("getDunningSummary -- returns summary stats", async () => {
    const summary = await dunningService.getDunningSummary(TEST_ORG_ID);
    expect(summary).toBeTruthy();
    expect(typeof summary.totalPending).toBe("number");
    expect(typeof summary.failedThisMonth).toBe("number");
    expect(typeof summary.recoveredAmount).toBe("number");
    expect(summary.totalPending).toBeGreaterThanOrEqual(1);
  });

  it("processDunningAttempt -- processes a pending attempt", async () => {
    await expect(
      dunningService.processDunningAttempt(attemptId, TEST_ORG_ID)
    ).resolves.not.toThrow();
  });

  it("processDunningAttempt -- throws for non-existent id", async () => {
    await expect(
      dunningService.processDunningAttempt(uuid(), TEST_ORG_ID)
    ).rejects.toThrow();
  });
});

// ============================================================================
// 5. PORTAL SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("PortalService -- real DB", () => {
  it("getPortalBranding -- returns defaults when no orgId", async () => {
    const branding = await portalService.getPortalBranding();
    expect(branding.orgName).toBe("EMP Billing");
    expect(branding.logo).toBeNull();
    expect(branding.primaryColor).toBeNull();
  });

  it("getPortalBranding -- returns org branding", async () => {
    const branding = await portalService.getPortalBranding(TEST_ORG_ID);
    expect(branding.orgName).toContain("SvcTestOrg");
  });

  it("getPortalBranding -- returns defaults for non-existent org", async () => {
    const branding = await portalService.getPortalBranding(uuid());
    expect(branding.orgName).toBe("EMP Billing");
  });

  it("portalLogin -- rejects invalid credentials", async () => {
    await expect(
      portalService.portalLogin("fake@test.com", "invalid-token")
    ).rejects.toThrow();
  });

  it("portalLogin -- rejects with wrong org scope", async () => {
    await expect(
      portalService.portalLogin("fake@test.com", "invalid-token", TEST_ORG_ID)
    ).rejects.toThrow();
  });

  it("getPortalDashboard -- throws for non-existent client", async () => {
    await expect(
      portalService.getPortalDashboard(uuid(), TEST_ORG_ID)
    ).rejects.toThrow();
  });

  it("getPortalDashboard -- returns dashboard for valid client", async () => {
    const dashboard = await portalService.getPortalDashboard(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(dashboard).toBeTruthy();
    expect(typeof dashboard.outstandingBalance).toBe("number");
    expect(dashboard.currency).toBe("INR");
    expect(Array.isArray(dashboard.recentInvoices)).toBe(true);
    expect(Array.isArray(dashboard.recentPayments)).toBe(true);
    expect(typeof dashboard.pendingQuotesCount).toBe("number");
  });

  it("getPortalInvoices -- returns paginated invoices", async () => {
    const result = await portalService.getPortalInvoices(TEST_CLIENT_ID, TEST_ORG_ID, {
      page: 1,
      limit: 10,
    });
    expect(result).toBeTruthy();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("getPortalInvoice -- throws for non-existent invoice", async () => {
    await expect(
      portalService.getPortalInvoice(TEST_CLIENT_ID, TEST_ORG_ID, uuid())
    ).rejects.toThrow();
  });

  it("getPortalQuotes -- returns client quotes", async () => {
    const quotes = await portalService.getPortalQuotes(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(Array.isArray(quotes)).toBe(true);
  });

  it("getPortalPayments -- returns client payments", async () => {
    const payments = await portalService.getPortalPayments(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(Array.isArray(payments)).toBe(true);
  });

  it("getPortalCreditNotes -- returns client credit notes", async () => {
    const notes = await portalService.getPortalCreditNotes(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(Array.isArray(notes)).toBe(true);
  });

  it("getPortalSubscriptions -- returns subscriptions with plans", async () => {
    const subs = await portalService.getPortalSubscriptions(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(Array.isArray(subs)).toBe(true);
  });

  it("getPortalSubscription -- throws for non-existent", async () => {
    await expect(
      portalService.getPortalSubscription(TEST_CLIENT_ID, TEST_ORG_ID, uuid())
    ).rejects.toThrow();
  });

  it("getPortalPlans -- returns available plans", async () => {
    const plans = await portalService.getPortalPlans(TEST_ORG_ID);
    expect(Array.isArray(plans)).toBe(true);
  });

  it("getPortalInvoicePdf -- throws for non-existent invoice", async () => {
    await expect(
      portalService.getPortalInvoicePdf(TEST_CLIENT_ID, TEST_ORG_ID, uuid())
    ).rejects.toThrow();
  });

  it("portalChangePlan -- throws for non-existent subscription", async () => {
    await expect(
      portalService.portalChangePlan(TEST_CLIENT_ID, TEST_ORG_ID, uuid(), uuid())
    ).rejects.toThrow();
  });

  it("portalCancelSubscription -- throws for non-existent subscription", async () => {
    await expect(
      portalService.portalCancelSubscription(TEST_CLIENT_ID, TEST_ORG_ID, uuid())
    ).rejects.toThrow();
  });

  it("getPortalPaymentMethod -- returns null for no method", async () => {
    const method = await portalService.getPortalPaymentMethod(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(method !== undefined).toBe(true);
  });

  it("removePortalPaymentMethod -- works for client without method", async () => {
    await expect(
      portalService.removePortalPaymentMethod(TEST_CLIENT_ID, TEST_ORG_ID)
    ).resolves.not.toThrow();
  });

  it("getPortalStatement -- returns statement data", async () => {
    const statement = await portalService.getPortalStatement(TEST_CLIENT_ID, TEST_ORG_ID);
    expect(statement).toBeTruthy();
  });
});

// ============================================================================
// 6. SUBSCRIPTION SERVICE
// ============================================================================

describe.skipIf(!dbAvailable)("SubscriptionService -- real DB", () => {
  let planId: string;
  let subscriptionId: string;

  it("createPlan -- creates a monthly plan", async () => {
    const plan = await subscriptionService.createPlan(TEST_ORG_ID, {
      name: `SvcPlan-${TS}`,
      billingInterval: BillingInterval.MONTHLY,
      price: 99900,
      currency: "INR",
    } as any);
    expect(plan).toBeTruthy();
    expect(plan.name).toContain("SvcPlan");
    planId = plan.id;
  });

  it("listPlans -- returns plans for org", async () => {
    const plans = await subscriptionService.listPlans(TEST_ORG_ID);
    expect(plans.length).toBeGreaterThanOrEqual(1);
  });

  it("getPlan -- retrieves plan by id", async () => {
    const plan = await subscriptionService.getPlan(TEST_ORG_ID, planId);
    expect(plan.id).toBe(planId);
  });

  it("updatePlan -- changes plan name", async () => {
    const updated = await subscriptionService.updatePlan(TEST_ORG_ID, planId, {
      name: `SvcPlanUpdated-${TS}`,
    } as any);
    expect(updated.name).toContain("SvcPlanUpdated");
  });

  it("createSubscription -- creates subscription", async () => {
    const sub = await subscriptionService.createSubscription(TEST_ORG_ID, TEST_USER_ID, {
      clientId: TEST_CLIENT_ID,
      planId,
      startDate: new Date(),
    } as any);
    expect(sub).toBeTruthy();
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    subscriptionId = sub.id;
  });

  it("listSubscriptions -- paginates", async () => {
    const result = await subscriptionService.listSubscriptions(TEST_ORG_ID, {
      page: 1,
      limit: 10,
    } as any);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("getSubscription -- retrieves with events", async () => {
    const sub = await subscriptionService.getSubscription(TEST_ORG_ID, subscriptionId);
    expect(sub.id).toBe(subscriptionId);
  });

  it("getSubscriptionEvents -- returns events", async () => {
    const events = await subscriptionService.getSubscriptionEvents(TEST_ORG_ID, subscriptionId);
    expect(Array.isArray(events)).toBe(true);
  });

  it("pauseSubscription -- pauses active subscription", async () => {
    const paused = await subscriptionService.pauseSubscription(TEST_ORG_ID, subscriptionId);
    expect(paused.status).toBe(SubscriptionStatus.PAUSED);
  });

  it("resumeSubscription -- resumes paused subscription", async () => {
    const resumed = await subscriptionService.resumeSubscription(TEST_ORG_ID, subscriptionId);
    expect(resumed.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("cancelSubscription -- cancels subscription", async () => {
    const cancelled = await subscriptionService.cancelSubscription(TEST_ORG_ID, subscriptionId, {
      reason: "Service coverage test",
      cancelImmediately: true,
    } as any);
    expect(cancelled.status).toBe(SubscriptionStatus.CANCELLED);
  });

  it("deletePlan -- soft-deletes plan (isActive=false)", async () => {
    await subscriptionService.deletePlan(TEST_ORG_ID, planId);
    const plan = await subscriptionService.getPlan(TEST_ORG_ID, planId);
    expect(plan.isActive).toBeFalsy();
  });
});
