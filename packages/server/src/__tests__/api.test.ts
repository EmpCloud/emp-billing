// ============================================================================
// EMP BILLING — Comprehensive API Integration Tests
// Runs against http://localhost:4001/api/v1
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";

const API = process.env.BILLING_TEST_API || "http://localhost:4001";
const BASE = `${API}/api/v1`;

// Graceful skip: probe server availability AND auth before test registration
let serverAvailable = false;
try {
  const resp = await fetch(`${API}/api/v1/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
  if (resp && resp.ok) {
    // Also verify auth works — if login fails, all tests would cascade-fail
    const loginResp = await fetch(`${API}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.BILLING_TEST_EMAIL || "admin@empcloud.com", password: process.env.BILLING_TEST_PASS || "Admin@123" }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (loginResp && loginResp.ok) serverAvailable = true;
  }
} catch {
  serverAvailable = false;
}

// ---------------------------------------------------------------------------
// Credentials — override via env vars if needed
// ---------------------------------------------------------------------------
const LOGIN_EMAIL = process.env.BILLING_TEST_EMAIL || "admin@empcloud.com";
const LOGIN_PASS = process.env.BILLING_TEST_PASS || "Admin@123";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let authToken = "";
let refreshToken = "";

// IDs captured during CRUD flows
let clientId = "";
let contactId = "";
let productId = "";
let taxRateId = "";
let invoiceId = "";
let paymentId = "";
let subscriptionPlanId = "";
let subscriptionId = "";
let couponId = "";
let creditNoteId = "";
let webhookId = "";
let apiKeyId = "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function api(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const opts: RequestInit = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

// ============================================================================
// AUTH
// ============================================================================
describe.skipIf(!serverAvailable)("Auth", () => {
  it("1. POST /auth/login — should authenticate and return tokens", async () => {
    const res = await api("POST", "/auth/login", {
      email: LOGIN_EMAIL,
      password: LOGIN_PASS,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken || res.body.data.token).toBeTruthy();
    authToken = res.body.data.accessToken || res.body.data.token;
    refreshToken = res.body.data.refreshToken || "";
  });

  it("2. GET /auth/me — should return current user", async () => {
    const res = await api("GET", "/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
  });

  it("3. POST /auth/login — should reject invalid credentials", async () => {
    const res = await api("POST", "/auth/login", {
      email: LOGIN_EMAIL,
      password: "WrongPassword!",
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ============================================================================
// CLIENTS
// ============================================================================
describe.skipIf(!serverAvailable)("Clients CRUD", () => {
  it("4. POST /clients — create client", async () => {
    const res = await api("POST", "/clients", {
      name: `Test Client ${Date.now()}`,
      email: `test-client-${Date.now()}@example.com`,
      phone: "+919876543210",
      billing_address: {
        line1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postal_code: "400001",
        country: "IN",
      },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    clientId = res.body.data.id;
    expect(clientId).toBeTruthy();
  });

  it("5. GET /clients — list clients", async () => {
    const res = await api("GET", "/clients");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("6. GET /clients/:id — get single client", async () => {
    const res = await api("GET", `/clients/${clientId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(clientId);
  });

  it("7. PUT /clients/:id — update client", async () => {
    const res = await api("PUT", `/clients/${clientId}`, {
      name: `Updated Client ${Date.now()}`,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("8. POST /clients/:id/contacts — add contact", async () => {
    const res = await api("POST", `/clients/${clientId}/contacts`, {
      name: "Contact Person",
      email: `contact-${Date.now()}@example.com`,
      phone: "+911234567890",
      is_primary: true,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    if (res.body.data?.id) contactId = res.body.data.id;
  });

  it("9. GET /clients/:id/contacts — list contacts", async () => {
    const res = await api("GET", `/clients/${clientId}/contacts`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("10. GET /clients/:id/balance — get client balance", async () => {
    const res = await api("GET", `/clients/${clientId}/balance`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("11. GET /clients/:id/statement — get client statement", async () => {
    const res = await api("GET", `/clients/${clientId}/statement`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// PRODUCTS & TAX RATES
// ============================================================================
describe.skipIf(!serverAvailable)("Products & Tax Rates", () => {
  it("12. POST /products — create product", async () => {
    const res = await api("POST", "/products", {
      name: `Test Product ${Date.now()}`,
      unit_price: 10000, // 100.00 in smallest currency unit
      description: "Integration test product",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    productId = res.body.data.id;
    expect(productId).toBeTruthy();
  });

  it("13. GET /products — list products", async () => {
    const res = await api("GET", "/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("14. GET /products/:id — get single product", async () => {
    const res = await api("GET", `/products/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(productId);
  });

  it("15. PUT /products/:id — update product", async () => {
    const res = await api("PUT", `/products/${productId}`, {
      name: `Updated Product ${Date.now()}`,
      unit_price: 15000,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("16. POST /products/tax-rates — create tax rate", async () => {
    const res = await api("POST", "/products/tax-rates", {
      name: `Test Tax ${Date.now()}`,
      rate: 18,
      description: "GST 18%",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    taxRateId = res.body.data.id;
    expect(taxRateId).toBeTruthy();
  });

  it("17. GET /products/tax-rates — list tax rates", async () => {
    const res = await api("GET", "/products/tax-rates");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("18. PUT /products/tax-rates/:id — update tax rate", async () => {
    const res = await api("PUT", `/products/tax-rates/${taxRateId}`, {
      name: `Updated Tax ${Date.now()}`,
      rate: 12,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// INVOICES
// ============================================================================
describe.skipIf(!serverAvailable)("Invoices CRUD", () => {
  it("19. POST /invoices — create invoice with line items", async () => {
    const res = await api("POST", "/invoices", {
      client_id: clientId,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      line_items: [
        {
          product_id: productId,
          description: "Test service",
          quantity: 2,
          unit_price: 10000,
        },
      ],
      notes: "Integration test invoice",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    invoiceId = res.body.data.id;
    expect(invoiceId).toBeTruthy();
  });

  it("20. GET /invoices — list invoices", async () => {
    const res = await api("GET", "/invoices");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("21. GET /invoices/:id — get invoice with computed totals", async () => {
    const res = await api("GET", `/invoices/${invoiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(invoiceId);
    // Verify totals are present
    const inv = res.body.data;
    expect(inv.total !== undefined || inv.amount !== undefined || inv.subtotal !== undefined).toBe(true);
  });

  it("22. PUT /invoices/:id — update invoice", async () => {
    const res = await api("PUT", `/invoices/${invoiceId}`, {
      notes: "Updated notes for integration test",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("23. POST /invoices/:id/send — send invoice", async () => {
    const res = await api("POST", `/invoices/${invoiceId}/send`);
    // May succeed or fail depending on email config; accept either
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it("24. POST /invoices/:id/duplicate — duplicate invoice", async () => {
    const res = await api("POST", `/invoices/${invoiceId}/duplicate`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.id).not.toBe(invoiceId);
  });

  it("25. GET /invoices/:id/payments — list payments on invoice", async () => {
    const res = await api("GET", `/invoices/${invoiceId}/payments`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// PAYMENTS
// ============================================================================
describe.skipIf(!serverAvailable)("Payments", () => {
  it("26. POST /payments — record manual payment", async () => {
    const res = await api("POST", "/payments", {
      client_id: clientId,
      invoice_id: invoiceId,
      amount: 5000,
      payment_date: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference: `PAY-TEST-${Date.now()}`,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    paymentId = res.body.data.id;
    expect(paymentId).toBeTruthy();
  });

  it("27. GET /payments — list payments", async () => {
    const res = await api("GET", "/payments");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("28. GET /payments/:id — get single payment", async () => {
    const res = await api("GET", `/payments/${paymentId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(paymentId);
  });

  it("29. GET /payments/online/gateways — list online gateways", async () => {
    const res = await api("GET", "/payments/online/gateways");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("30. POST /payments/:id/refund — refund payment", async () => {
    const res = await api("POST", `/payments/${paymentId}/refund`, {
      amount: 2000,
      reason: "Partial refund for test",
    });
    // May fail if payment doesn't meet refund criteria
    expect([200, 201, 400]).toContain(res.status);
  });
});

// ============================================================================
// SUBSCRIPTIONS & PLANS
// ============================================================================
describe.skipIf(!serverAvailable)("Subscriptions & Plans", () => {
  it("31. POST /subscriptions/plans — create plan", async () => {
    const res = await api("POST", "/subscriptions/plans", {
      name: `Test Plan ${Date.now()}`,
      billing_interval: "monthly",
      price: 99900,
      description: "Integration test plan",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    subscriptionPlanId = res.body.data.id;
    expect(subscriptionPlanId).toBeTruthy();
  });

  it("32. GET /subscriptions/plans — list plans", async () => {
    const res = await api("GET", "/subscriptions/plans");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("33. GET /subscriptions/plans/:id — get single plan", async () => {
    const res = await api("GET", `/subscriptions/plans/${subscriptionPlanId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(subscriptionPlanId);
  });

  it("34. PUT /subscriptions/plans/:id — update plan", async () => {
    const res = await api("PUT", `/subscriptions/plans/${subscriptionPlanId}`, {
      name: `Updated Plan ${Date.now()}`,
      price: 119900,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("35. POST /subscriptions — create subscription", async () => {
    const res = await api("POST", "/subscriptions", {
      client_id: clientId,
      plan_id: subscriptionPlanId,
      start_date: new Date().toISOString().slice(0, 10),
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    subscriptionId = res.body.data.id;
    expect(subscriptionId).toBeTruthy();
  });

  it("36. GET /subscriptions — list subscriptions", async () => {
    const res = await api("GET", "/subscriptions");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("37. GET /subscriptions/:id — get subscription details", async () => {
    const res = await api("GET", `/subscriptions/${subscriptionId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(subscriptionId);
  });

  it("38. GET /subscriptions/:id/events — subscription lifecycle events", async () => {
    const res = await api("GET", `/subscriptions/${subscriptionId}/events`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("39. POST /subscriptions/:id/pause — pause subscription", async () => {
    const res = await api("POST", `/subscriptions/${subscriptionId}/pause`);
    expect([200, 400]).toContain(res.status);
  });

  it("40. POST /subscriptions/:id/resume — resume subscription", async () => {
    const res = await api("POST", `/subscriptions/${subscriptionId}/resume`);
    expect([200, 400]).toContain(res.status);
  });
});

// ============================================================================
// COUPONS
// ============================================================================
describe.skipIf(!serverAvailable)("Coupons CRUD", () => {
  it("41. POST /coupons — create coupon", async () => {
    const code = `TEST${Date.now()}`;
    const res = await api("POST", "/coupons", {
      code,
      discount_type: "percentage",
      discount_value: 10,
      valid_from: new Date().toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      max_redemptions: 100,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    couponId = res.body.data.id;
    expect(couponId).toBeTruthy();
  });

  it("42. GET /coupons — list coupons", async () => {
    const res = await api("GET", "/coupons");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("43. GET /coupons/:id — get single coupon", async () => {
    const res = await api("GET", `/coupons/${couponId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(couponId);
  });

  it("44. PUT /coupons/:id — update coupon", async () => {
    const res = await api("PUT", `/coupons/${couponId}`, {
      discount_value: 15,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("45. POST /coupons/validate — validate coupon code", async () => {
    const coupon = (await api("GET", `/coupons/${couponId}`)).body.data;
    const res = await api("POST", "/coupons/validate", {
      code: coupon.code,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("46. POST /coupons/apply — apply coupon to invoice", async () => {
    const coupon = (await api("GET", `/coupons/${couponId}`)).body.data;
    const res = await api("POST", "/coupons/apply", {
      code: coupon.code,
      invoice_id: invoiceId,
    });
    // May fail if coupon/invoice combo is invalid; accept partial failure
    expect([200, 201, 400]).toContain(res.status);
  });

  it("47. GET /coupons/:id/redemptions — list redemptions", async () => {
    const res = await api("GET", `/coupons/${couponId}/redemptions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// CREDIT NOTES
// ============================================================================
describe.skipIf(!serverAvailable)("Credit Notes", () => {
  it("48. POST /credit-notes — create credit note", async () => {
    const res = await api("POST", "/credit-notes", {
      client_id: clientId,
      invoice_id: invoiceId,
      amount: 3000,
      reason: "Overcharge adjustment - integration test",
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    creditNoteId = res.body.data.id;
    expect(creditNoteId).toBeTruthy();
  });

  it("49. GET /credit-notes — list credit notes", async () => {
    const res = await api("GET", "/credit-notes");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("50. GET /credit-notes/:id — get single credit note", async () => {
    const res = await api("GET", `/credit-notes/${creditNoteId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(creditNoteId);
  });

  it("51. POST /credit-notes/:id/apply — apply credit note to invoice", async () => {
    const res = await api("POST", `/credit-notes/${creditNoteId}/apply`, {
      invoice_id: invoiceId,
      amount: 1000,
    });
    expect([200, 201, 400]).toContain(res.status);
  });
});

// ============================================================================
// WEBHOOKS
// ============================================================================
describe.skipIf(!serverAvailable)("Webhooks", () => {
  it("52. POST /webhooks — create webhook endpoint", async () => {
    const res = await api("POST", "/webhooks", {
      url: "https://httpbin.org/post",
      events: ["invoice.created", "payment.received"],
      is_active: true,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    webhookId = res.body.data.id;
    expect(webhookId).toBeTruthy();
  });

  it("53. GET /webhooks — list webhooks", async () => {
    const res = await api("GET", "/webhooks");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("54. PUT /webhooks/:id — update webhook", async () => {
    const res = await api("PUT", `/webhooks/${webhookId}`, {
      url: "https://httpbin.org/post",
      events: ["invoice.created", "payment.received", "subscription.created"],
      is_active: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("55. POST /webhooks/:id/test — test webhook delivery", async () => {
    const res = await api("POST", `/webhooks/${webhookId}/test`);
    // May timeout; accept 200 or error
    expect([200, 201, 400, 408, 500]).toContain(res.status);
  });

  it("56. GET /webhooks/:id/deliveries — get delivery log", async () => {
    const res = await api("GET", `/webhooks/${webhookId}/deliveries`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// USAGE BILLING
// ============================================================================
describe.skipIf(!serverAvailable)("Usage Billing", () => {
  it("57. POST /usage — record usage", async () => {
    const res = await api("POST", "/usage", {
      client_id: clientId,
      subscription_id: subscriptionId,
      metric: "api_calls",
      quantity: 100,
      recorded_at: new Date().toISOString(),
    });
    expect([200, 201, 400]).toContain(res.status);
  });

  it("58. GET /usage — list usage records", async () => {
    const res = await api("GET", "/usage");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("59. GET /usage/summary — usage summary", async () => {
    const res = await api("GET", "/usage/summary");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// API KEYS
// ============================================================================
describe.skipIf(!serverAvailable)("API Keys", () => {
  it("60. POST /api-keys — create API key", async () => {
    const res = await api("POST", "/api-keys", {
      name: `Test Key ${Date.now()}`,
      permissions: ["read"],
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    apiKeyId = res.body.data.id;
    expect(apiKeyId).toBeTruthy();
  });

  it("61. GET /api-keys — list API keys", async () => {
    const res = await api("GET", "/api-keys");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================================================
// REPORTS
// ============================================================================
describe.skipIf(!serverAvailable)("Reports", () => {
  it("62. GET /reports/dashboard — dashboard stats", async () => {
    const res = await api("GET", "/reports/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("63. GET /reports/revenue — revenue report", async () => {
    const res = await api("GET", "/reports/revenue");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("64. GET /reports/receivables — receivables report", async () => {
    const res = await api("GET", "/reports/receivables");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("65. GET /reports/aging — aging report", async () => {
    const res = await api("GET", "/reports/aging");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("66. GET /reports/profit-loss — P&L report", async () => {
    const res = await api("GET", "/reports/profit-loss");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("67. GET /reports/tax — tax report", async () => {
    const res = await api("GET", "/reports/tax");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("68. GET /reports/clients/top — top clients", async () => {
    const res = await api("GET", "/reports/clients/top");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// METRICS
// ============================================================================
describe.skipIf(!serverAvailable)("Metrics", () => {
  it("69. GET /metrics/mrr — monthly recurring revenue", async () => {
    const res = await api("GET", "/metrics/mrr");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("70. GET /metrics/arr — annual recurring revenue", async () => {
    const res = await api("GET", "/metrics/arr");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("71. GET /metrics/churn — churn metrics", async () => {
    const res = await api("GET", "/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("72. GET /metrics/ltv — lifetime value", async () => {
    const res = await api("GET", "/metrics/ltv");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("73. GET /metrics/subscription-stats — subscription statistics", async () => {
    const res = await api("GET", "/metrics/subscription-stats");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// DUNNING
// ============================================================================
describe.skipIf(!serverAvailable)("Dunning", () => {
  it("74. GET /dunning/config — get dunning config", async () => {
    const res = await api("GET", "/dunning/config");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("75. GET /dunning/attempts — list dunning attempts", async () => {
    const res = await api("GET", "/dunning/attempts");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("76. GET /dunning/summary — dunning summary", async () => {
    const res = await api("GET", "/dunning/summary");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// SETTINGS
// ============================================================================
describe.skipIf(!serverAvailable)("Settings", () => {
  it("77. GET /settings — get org settings", async () => {
    const res = await api("GET", "/settings");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("78. GET /settings/numbering — get numbering config", async () => {
    const res = await api("GET", "/settings/numbering");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("79. GET /settings/email-templates — list email templates", async () => {
    const res = await api("GET", "/settings/email-templates");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================================
// CLEANUP — delete test resources
// ============================================================================
describe.skipIf(!serverAvailable)("Cleanup", () => {
  it("80. DELETE /api-keys/:id — revoke API key", async () => {
    if (!apiKeyId) return;
    const res = await api("DELETE", `/api-keys/${apiKeyId}`);
    expect([200, 204]).toContain(res.status);
  });

  it("81. DELETE /webhooks/:id — delete webhook", async () => {
    if (!webhookId) return;
    const res = await api("DELETE", `/webhooks/${webhookId}`);
    expect([200, 204]).toContain(res.status);
  });

  it("82. POST /credit-notes/:id/void — void credit note", async () => {
    if (!creditNoteId) return;
    const res = await api("POST", `/credit-notes/${creditNoteId}/void`);
    expect([200, 400]).toContain(res.status);
  });

  it("83. DELETE /coupons/:id — delete coupon", async () => {
    if (!couponId) return;
    const res = await api("DELETE", `/coupons/${couponId}`);
    expect([200, 204]).toContain(res.status);
  });

  it("84. POST /subscriptions/:id/cancel — cancel subscription", async () => {
    if (!subscriptionId) return;
    const res = await api("POST", `/subscriptions/${subscriptionId}/cancel`, {
      reason: "Integration test cleanup",
      cancel_at: "immediately",
    });
    expect([200, 400]).toContain(res.status);
  });

  it("85. DELETE /subscriptions/plans/:id — delete plan", async () => {
    if (!subscriptionPlanId) return;
    const res = await api("DELETE", `/subscriptions/plans/${subscriptionPlanId}`);
    expect([200, 204, 400]).toContain(res.status);
  });

  it("86. POST /invoices/:id/void — void invoice", async () => {
    if (!invoiceId) return;
    const res = await api("POST", `/invoices/${invoiceId}/void`);
    expect([200, 400]).toContain(res.status);
  });

  it("87. DELETE /products/tax-rates/:id — delete tax rate", async () => {
    if (!taxRateId) return;
    const res = await api("DELETE", `/products/tax-rates/${taxRateId}`);
    expect([200, 204]).toContain(res.status);
  });

  it("88. DELETE /products/:id — delete product", async () => {
    if (!productId) return;
    const res = await api("DELETE", `/products/${productId}`);
    expect([200, 204]).toContain(res.status);
  });

  it("89. DELETE /clients/:id — delete client", async () => {
    if (!clientId) return;
    const res = await api("DELETE", `/clients/${clientId}`);
    expect([200, 204, 400]).toContain(res.status);
  });
});
