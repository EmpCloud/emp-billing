import { chromium, type Page, type BrowserContext } from "playwright";

const BASE = "http://localhost:4001";
let passed = 0;
let failed = 0;

function log(icon: string, msg: string) {
  console.log(`${icon} ${msg}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    log("[PASS]", name);
  } catch (e: any) {
    failed++;
    log("[FAIL]", `${name}: ${e.message}`);
  }
  // Small delay between tests to avoid rate limiting
  await new Promise((r) => setTimeout(r, 1500));
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill("admin@acme.com");
    const passInput = await page.$('input[type="password"]');
    if (passInput) await passInput.fill("Admin@123");
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  }
  await page.waitForTimeout(1000);
}

/** Helper: call API from page context (reuses logged-in session token). */
async function api(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const token = localStorage.getItem("access_token");
      const opts: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      let data: any;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      }
      return { status: res.status, data, contentType: ct };
    },
    { method, path, body },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\n=== Logging in ===\n");
  await login(page);
  console.log(`Logged in. URL: ${page.url()}\n`);

  // -------------------------------------------------------------------
  // Fetch a client ID and an invoice ID we can use across tests
  // -------------------------------------------------------------------
  const clientsRes = await api(page, "GET", "/api/v1/clients?limit=1");
  const clientId: string | undefined = clientsRes.data?.data?.[0]?.id;
  if (!clientId) {
    console.log("[WARN] No clients found — some tests may be skipped.");
  }

  const invoicesRes = await api(page, "GET", "/api/v1/invoices?limit=1");
  const invoiceId: string | undefined = invoicesRes.data?.data?.[0]?.id;

  // ====================================================================
  // CREDIT NOTES
  // ====================================================================
  console.log("\n=== Credit Notes ===\n");

  // 1. Credit note list page loads
  await test("1. Credit note list page loads", async () => {
    await page.goto(`${BASE}/credit-notes`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("credit")) {
      throw new Error("Credit notes page content not found");
    }
  });

  // 2. Status filter works
  await test("2. Credit note status filter works", async () => {
    const res = await api(page, "GET", "/api/v1/credit-notes?status=open");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data?.success) throw new Error("API returned success=false");
  });

  // 3. Create credit note succeeds (via API)
  let creditNoteId: string | undefined;
  await test("3. Create credit note succeeds", async () => {
    if (!clientId) throw new Error("No client available — cannot create credit note");
    const res = await api(page, "POST", "/api/v1/credit-notes", {
      clientId,
      date: new Date().toISOString(),
      items: [
        { name: "E2E Test Item", quantity: 1, rate: 100000 },
      ],
      reason: "E2E test credit note",
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data?.success) throw new Error(`API failed: ${JSON.stringify(res.data)}`);
    creditNoteId = res.data.data.id;
  });

  // 4. Credit note detail page loads
  await test("4. Credit note detail page loads", async () => {
    if (!creditNoteId) throw new Error("No credit note ID available");
    const res = await api(page, "GET", `/api/v1/credit-notes/${creditNoteId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data?.data?.id) throw new Error("Detail response missing id");
  });

  // 5. Download credit note PDF returns 200
  await test("5. Download credit note PDF returns 200", async () => {
    if (!creditNoteId) throw new Error("No credit note ID available");
    const res = await api(page, "GET", `/api/v1/credit-notes/${creditNoteId}/pdf`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 6. Apply credit note to invoice
  await test("6. Apply credit note to invoice", async () => {
    if (!creditNoteId) throw new Error("No credit note ID available");
    if (!invoiceId) throw new Error("No invoice available to apply credit note");
    const res = await api(page, "POST", `/api/v1/credit-notes/${creditNoteId}/apply`, {
      invoiceId,
      amount: 50000, // apply partial amount (500.00 in smallest unit)
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 7. Void credit note — create a fresh one since previous may be partially applied
  let voidCreditNoteId: string | undefined;
  await test("7. Void credit note", async () => {
    if (!clientId) throw new Error("No client available");
    // Create a fresh credit note to void
    const createRes = await api(page, "POST", "/api/v1/credit-notes", {
      clientId,
      date: new Date().toISOString(),
      items: [{ name: "Void Test Item", quantity: 1, rate: 20000 }],
      reason: "To be voided",
    });
    if (!createRes.data?.success) throw new Error(`Create failed: ${JSON.stringify(createRes.data)}`);
    voidCreditNoteId = createRes.data.data.id;

    const res = await api(page, "POST", `/api/v1/credit-notes/${voidCreditNoteId}/void`);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 8. Delete draft credit note
  await test("8. Delete draft credit note", async () => {
    if (!clientId) throw new Error("No client available");
    // Create a draft credit note then delete it
    const createRes = await api(page, "POST", "/api/v1/credit-notes", {
      clientId,
      date: new Date().toISOString(),
      items: [{ name: "Delete Test Item", quantity: 1, rate: 10000 }],
      reason: "To be deleted",
    });
    if (!createRes.data?.success) throw new Error(`Create failed: ${JSON.stringify(createRes.data)}`);
    const id = createRes.data.data.id;

    const res = await api(page, "DELETE", `/api/v1/credit-notes/${id}`);
    if (res.status !== 200 && res.status !== 204) {
      throw new Error(`Expected 200/204, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // Verify it is gone (should 404)
    const getRes = await api(page, "GET", `/api/v1/credit-notes/${id}`);
    if (getRes.status !== 404) {
      throw new Error(`Expected 404 after delete, got ${getRes.status}`);
    }
  });

  // ====================================================================
  // RECURRING INVOICES
  // ====================================================================
  console.log("\n=== Recurring Invoices ===\n");

  // 9. Recurring list page loads
  await test("9. Recurring list page loads", async () => {
    await page.goto(`${BASE}/recurring`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("recurring")) {
      throw new Error("Recurring page content not found");
    }
  });

  // 10. Status filter works (active/paused/completed/cancelled)
  await test("10. Recurring status filter works", async () => {
    for (const status of ["active", "paused", "completed", "cancelled"]) {
      const res = await api(page, "GET", `/api/v1/recurring?status=${status}`);
      if (res.status !== 200) throw new Error(`Filter '${status}' returned ${res.status}`);
      if (!res.data?.success) throw new Error(`Filter '${status}' returned success=false`);
    }
  });

  // 11. Create recurring profile succeeds (via API)
  let recurringId: string | undefined;
  await test("11. Create recurring profile succeeds", async () => {
    if (!clientId) throw new Error("No client available");
    const res = await api(page, "POST", "/api/v1/recurring", {
      clientId,
      type: "invoice",
      frequency: "monthly",
      startDate: new Date().toISOString(),
      autoSend: false,
      autoCharge: false,
      templateData: {
        items: [{ name: "Monthly Retainer", quantity: 1, rate: 500000 }],
        currency: "INR",
        notes: "E2E test recurring profile",
      },
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data?.success) throw new Error(`API failed: ${JSON.stringify(res.data)}`);
    recurringId = res.data.data.id;
  });

  // 12. Recurring detail page loads with execution history
  await test("12. Recurring detail page loads with execution history", async () => {
    if (!recurringId) throw new Error("No recurring profile ID available");
    const detailRes = await api(page, "GET", `/api/v1/recurring/${recurringId}`);
    if (detailRes.status !== 200) throw new Error(`Detail returned ${detailRes.status}`);
    if (!detailRes.data?.data?.id) throw new Error("Detail missing id");

    const execRes = await api(page, "GET", `/api/v1/recurring/${recurringId}/executions`);
    if (execRes.status !== 200) throw new Error(`Executions returned ${execRes.status}`);
  });

  // 13. Pause recurring profile
  await test("13. Pause recurring profile", async () => {
    if (!recurringId) throw new Error("No recurring profile ID available");
    const res = await api(page, "POST", `/api/v1/recurring/${recurringId}/pause`);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // Verify status is paused
    const getRes = await api(page, "GET", `/api/v1/recurring/${recurringId}`);
    const status = getRes.data?.data?.status;
    if (status !== "paused") throw new Error(`Expected status 'paused', got '${status}'`);
  });

  // 14. Resume paused profile
  await test("14. Resume paused profile", async () => {
    if (!recurringId) throw new Error("No recurring profile ID available");
    const res = await api(page, "POST", `/api/v1/recurring/${recurringId}/resume`);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const getRes = await api(page, "GET", `/api/v1/recurring/${recurringId}`);
    const status = getRes.data?.data?.status;
    if (status !== "active") throw new Error(`Expected status 'active', got '${status}'`);
  });

  // 15. Delete recurring profile
  await test("15. Delete recurring profile", async () => {
    if (!recurringId) throw new Error("No recurring profile ID available");
    const res = await api(page, "DELETE", `/api/v1/recurring/${recurringId}`);
    if (res.status !== 200 && res.status !== 204) {
      throw new Error(`Expected 200/204, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const getRes = await api(page, "GET", `/api/v1/recurring/${recurringId}`);
    if (getRes.status !== 404) {
      throw new Error(`Expected 404 after delete, got ${getRes.status}`);
    }
  });

  // ====================================================================
  // SUBSCRIPTIONS
  // ====================================================================
  console.log("\n=== Subscriptions ===\n");

  // 16. Subscription list page loads
  await test("16. Subscription list page loads", async () => {
    await page.goto(`${BASE}/subscriptions`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("subscription")) {
      throw new Error("Subscriptions page content not found");
    }
  });

  // 17. Status filter works
  await test("17. Subscription status filter works", async () => {
    for (const status of ["active", "paused", "cancelled", "trialing"]) {
      const res = await api(page, "GET", `/api/v1/subscriptions?status=${status}`);
      if (res.status !== 200) throw new Error(`Filter '${status}' returned ${res.status}`);
      if (!res.data?.success) throw new Error(`Filter '${status}' returned success=false`);
    }
  });

  // 20. Plan list page loads (moved up because we need a plan before creating a subscription)
  await test("20. Plan list page loads", async () => {
    await page.goto(`${BASE}/subscriptions/plans`, { waitUntil: "networkidle", timeout: 15000 });
    // Also verify via API
    const res = await api(page, "GET", "/api/v1/subscriptions/plans");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 21. Create plan succeeds
  let planId: string | undefined;
  await test("21. Create plan succeeds", async () => {
    const res = await api(page, "POST", "/api/v1/subscriptions/plans", {
      name: `E2E Test Plan ${Date.now()}`,
      description: "Plan created by E2E test",
      billingInterval: "monthly",
      price: 999900,        // 9999.00 in smallest unit
      setupFee: 0,
      currency: "INR",
      trialPeriodDays: 7,
      features: ["Feature A", "Feature B"],
      sortOrder: 0,
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data?.success) throw new Error(`API failed: ${JSON.stringify(res.data)}`);
    planId = res.data.data.id;
  });

  // 22. Edit plan works
  await test("22. Edit plan works", async () => {
    if (!planId) throw new Error("No plan ID available");
    const res = await api(page, "PUT", `/api/v1/subscriptions/plans/${planId}`, {
      name: `E2E Updated Plan ${Date.now()}`,
      price: 1199900,
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // Verify update persisted
    const getRes = await api(page, "GET", `/api/v1/subscriptions/plans/${planId}`);
    if (getRes.data?.data?.price !== 1199900) {
      throw new Error(`Price not updated. Got: ${getRes.data?.data?.price}`);
    }
  });

  // 18. Create subscription succeeds (via API) — needs planId and clientId
  let subscriptionId: string | undefined;
  await test("18. Create subscription succeeds", async () => {
    if (!clientId) throw new Error("No client available");
    if (!planId) throw new Error("No plan available");
    const res = await api(page, "POST", "/api/v1/subscriptions", {
      clientId,
      planId,
      quantity: 1,
      autoRenew: true,
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data?.success) throw new Error(`API failed: ${JSON.stringify(res.data)}`);
    subscriptionId = res.data.data.id;
  });

  // 19. Subscription detail page loads
  await test("19. Subscription detail page loads", async () => {
    if (!subscriptionId) throw new Error("No subscription ID available");
    const res = await api(page, "GET", `/api/v1/subscriptions/${subscriptionId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data?.data?.id) throw new Error("Detail response missing id");

    // Also check events endpoint
    const eventsRes = await api(page, "GET", `/api/v1/subscriptions/${subscriptionId}/events`);
    if (eventsRes.status !== 200) throw new Error(`Events returned ${eventsRes.status}`);
  });

  // 23. Pause/resume subscription
  await test("23a. Pause subscription", async () => {
    if (!subscriptionId) throw new Error("No subscription ID available");
    const res = await api(page, "POST", `/api/v1/subscriptions/${subscriptionId}/pause`);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const getRes = await api(page, "GET", `/api/v1/subscriptions/${subscriptionId}`);
    const status = getRes.data?.data?.status;
    if (status !== "paused") throw new Error(`Expected 'paused', got '${status}'`);
  });

  await test("23b. Resume subscription", async () => {
    if (!subscriptionId) throw new Error("No subscription ID available");
    const res = await api(page, "POST", `/api/v1/subscriptions/${subscriptionId}/resume`);
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const getRes = await api(page, "GET", `/api/v1/subscriptions/${subscriptionId}`);
    const status = getRes.data?.data?.status;
    if (status !== "active") throw new Error(`Expected 'active', got '${status}'`);
  });

  // 24. Cancel subscription with reason
  await test("24. Cancel subscription with reason", async () => {
    if (!subscriptionId) throw new Error("No subscription ID available");
    const res = await api(page, "POST", `/api/v1/subscriptions/${subscriptionId}/cancel`, {
      reason: "E2E test cancellation",
      cancelImmediately: true,
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }

    const getRes = await api(page, "GET", `/api/v1/subscriptions/${subscriptionId}`);
    const status = getRes.data?.data?.status;
    if (status !== "cancelled") throw new Error(`Expected 'cancelled', got '${status}'`);
  });

  // ====================================================================
  // Cleanup: delete the test plan (best-effort)
  // ====================================================================
  if (planId) {
    try {
      await api(page, "DELETE", `/api/v1/subscriptions/plans/${planId}`);
    } catch {}
  }
  // Cleanup: delete test credit notes (best-effort)
  if (creditNoteId) {
    try {
      await api(page, "DELETE", `/api/v1/credit-notes/${creditNoteId}`);
    } catch {}
  }
  if (voidCreditNoteId) {
    try {
      await api(page, "DELETE", `/api/v1/credit-notes/${voidCreditNoteId}`);
    } catch {}
  }

  // ====================================================================
  // Results
  // ====================================================================
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
