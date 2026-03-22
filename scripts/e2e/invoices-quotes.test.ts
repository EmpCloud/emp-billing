import { chromium, type Page } from "playwright";

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

/** Helper: get a client ID from the API (needed to create invoices/quotes) */
async function getClientId(page: Page): Promise<string> {
  const result = await page.evaluate(async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/v1/clients?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.data?.[0]?.id ?? null;
  });
  if (!result) throw new Error("No clients found — seed data required");
  return result;
}

/** Helper: create an invoice via API and return its full object */
async function createTestInvoice(
  page: Page,
  clientId: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const result = await page.evaluate(
    async ({ clientId, overrides }) => {
      const token = localStorage.getItem("access_token");
      const now = new Date();
      const due = new Date(now);
      due.setDate(due.getDate() + 30);

      const body: Record<string, unknown> = {
        clientId,
        issueDate: now.toISOString(),
        dueDate: due.toISOString(),
        currency: "INR",
        items: [
          { name: "E2E Test Service", quantity: 2, rate: 500000, sortOrder: 0 },
          { name: "E2E Support Add-on", quantity: 1, rate: 250000, sortOrder: 1 },
        ],
        notes: "Created by E2E test",
        ...overrides,
      };

      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { status: res.status, success: data.success, data: data.data, error: data.error };
    },
    { clientId, overrides },
  );

  if (!result.success) {
    throw new Error(`Create invoice failed (${result.status}): ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

/** Helper: create a quote via API and return its full object */
async function createTestQuote(
  page: Page,
  clientId: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const result = await page.evaluate(
    async ({ clientId, overrides }) => {
      const token = localStorage.getItem("access_token");
      const now = new Date();
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 14);

      const body: Record<string, unknown> = {
        clientId,
        issueDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        currency: "INR",
        items: [
          { name: "E2E Quote Item", quantity: 3, rate: 100000, sortOrder: 0 },
        ],
        notes: "Created by E2E test",
        ...overrides,
      };

      const res = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { status: res.status, success: data.success, data: data.data, error: data.error };
    },
    { clientId, overrides },
  );

  if (!result.success) {
    throw new Error(`Create quote failed (${result.status}): ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

/** Helper: call an API action (POST) on an entity */
async function apiPost(
  page: Page,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; success: boolean; data: any; error: any }> {
  return page.evaluate(
    async ({ path, body }) => {
      const token = localStorage.getItem("access_token");
      const opts: RequestInit = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const data = await res.json();
      return { status: res.status, success: data.success, data: data.data, error: data.error };
    },
    { path, body },
  );
}

/** Helper: GET an API resource */
async function apiGet(
  page: Page,
  path: string,
): Promise<{ status: number; success: boolean; data: any; error: any }> {
  return page.evaluate(async (path) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return { status: res.status, success: data.success, data: data.data, error: data.error };
  }, path);
}

/** Helper: DELETE an API resource */
async function apiDelete(page: Page, path: string): Promise<void> {
  await page.evaluate(async (path) => {
    const token = localStorage.getItem("access_token");
    await fetch(path, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }, path);
}

// ============================================================================
// MAIN
// ============================================================================
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\n=== Logging in ===\n");
  await login(page);
  console.log(`Logged in. URL: ${page.url()}\n`);

  // Pre-fetch a client ID for creating test entities
  const clientId = await getClientId(page);
  console.log(`Using client ID: ${clientId}\n`);
  console.log("=== Running Invoice Tests ===\n");

  // --------------------------------------------------------------------------
  // INVOICE TESTS
  // --------------------------------------------------------------------------

  // 1. Invoice list page loads
  await test("1. Invoice list page loads", async () => {
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (!body || !body.toLowerCase().includes("invoice")) {
      throw new Error("Invoice list page did not render expected content");
    }
  });

  // 2. Status filter works (paid / sent / overdue)
  await test("2. Status filter works (paid / sent / overdue)", async () => {
    for (const status of ["paid", "sent", "overdue"]) {
      const result = await apiGet(page, `/api/v1/invoices?status=${status}&limit=5`);
      if (result.status !== 200) throw new Error(`Filter status=${status} returned ${result.status}`);
      // Every returned invoice should match the requested status
      for (const inv of result.data ?? []) {
        if (inv.status !== status) {
          throw new Error(`Expected status '${status}' but got '${inv.status}' for invoice ${inv.id}`);
        }
      }
    }
  });

  // 3. Search works on invoice list
  await test("3. Search works on invoice list", async () => {
    // Fetch one invoice to get its number for searching
    const all = await apiGet(page, "/api/v1/invoices?limit=1");
    if (!all.data || all.data.length === 0) throw new Error("No invoices to search");
    const number = all.data[0].invoiceNumber ?? all.data[0].number;
    if (!number) throw new Error("Invoice has no number field");

    const searchResult = await apiGet(page, `/api/v1/invoices?search=${encodeURIComponent(number)}&limit=5`);
    if (searchResult.status !== 200) throw new Error(`Search returned ${searchResult.status}`);
    const found = (searchResult.data ?? []).some(
      (inv: any) => (inv.invoiceNumber ?? inv.number) === number,
    );
    if (!found) throw new Error(`Search for '${number}' did not return the expected invoice`);
  });

  // 4. Create invoice with line items succeeds (API)
  let createdInvoice: any;
  await test("4. Create invoice with line items succeeds (API)", async () => {
    createdInvoice = await createTestInvoice(page, clientId);
    if (!createdInvoice.id) throw new Error("Created invoice has no ID");
    if (!createdInvoice.items || createdInvoice.items.length < 2) {
      throw new Error(`Expected 2 line items, got ${createdInvoice.items?.length ?? 0}`);
    }
  });

  // 5. Invoice detail page loads with line items and totals
  await test("5. Invoice detail page loads with line items and totals", async () => {
    if (!createdInvoice) throw new Error("No invoice created in previous step");
    await page.goto(`${BASE}/invoices/${createdInvoice.id}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Detail page is empty");

    // Check that at least one line-item name appears
    const hasItem = body.includes("E2E Test Service") || body.includes("E2E Support Add-on");
    if (!hasItem) throw new Error("Line items not visible on detail page");
  });

  // 6. Download invoice PDF returns 200
  await test("6. Download invoice PDF returns 200", async () => {
    if (!createdInvoice) throw new Error("No invoice created");
    const result = await page.evaluate(async (id: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/v1/invoices/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, contentType: res.headers.get("content-type") };
    }, createdInvoice.id);
    if (result.status !== 200) throw new Error(`PDF endpoint returned ${result.status}`);
  });

  // 7. Send invoice changes status
  await test("7. Send invoice changes status", async () => {
    if (!createdInvoice) throw new Error("No invoice created");
    const sendResult = await apiPost(page, `/api/v1/invoices/${createdInvoice.id}/send`);
    if (!sendResult.success) throw new Error(`Send failed: ${JSON.stringify(sendResult.error)}`);

    const fetched = await apiGet(page, `/api/v1/invoices/${createdInvoice.id}`);
    if (fetched.data.status !== "sent") {
      throw new Error(`Expected status 'sent', got '${fetched.data.status}'`);
    }
  });

  // 8. Record payment against invoice
  await test("8. Record payment against invoice", async () => {
    if (!createdInvoice) throw new Error("No invoice created");
    const payResult = await apiPost(page, "/api/v1/payments", {
      clientId,
      invoiceId: createdInvoice.id,
      date: new Date().toISOString(),
      amount: 500000, // partial payment (5000.00)
      method: "bank_transfer",
      notes: "E2E partial payment",
    });
    if (!payResult.success) throw new Error(`Payment failed: ${JSON.stringify(payResult.error)}`);
    if (!payResult.data.id) throw new Error("Payment has no ID");

    // Verify invoice shows partially paid or paid
    const inv = await apiGet(page, `/api/v1/invoices/${createdInvoice.id}`);
    const validStatuses = ["partially_paid", "paid"];
    if (!validStatuses.includes(inv.data.status)) {
      throw new Error(`Expected partially_paid or paid, got '${inv.data.status}'`);
    }
  });

  // 9. Duplicate invoice creates a copy
  await test("9. Duplicate invoice creates a copy", async () => {
    if (!createdInvoice) throw new Error("No invoice created");
    const dupResult = await apiPost(page, `/api/v1/invoices/${createdInvoice.id}/duplicate`);
    if (!dupResult.success) throw new Error(`Duplicate failed: ${JSON.stringify(dupResult.error)}`);
    if (!dupResult.data.id) throw new Error("Duplicate has no ID");
    if (dupResult.data.id === createdInvoice.id) {
      throw new Error("Duplicate has the same ID as the original");
    }
    // Status of duplicate should be draft
    if (dupResult.data.status !== "draft") {
      throw new Error(`Expected duplicate status 'draft', got '${dupResult.data.status}'`);
    }
    // Clean up duplicate
    await apiDelete(page, `/api/v1/invoices/${dupResult.data.id}`);
  });

  // 10. Void invoice changes status
  await test("10. Void invoice changes status", async () => {
    // Create a fresh draft invoice for voiding
    const voidTarget = await createTestInvoice(page, clientId);
    const voidResult = await apiPost(page, `/api/v1/invoices/${voidTarget.id}/void`);
    if (!voidResult.success) throw new Error(`Void failed: ${JSON.stringify(voidResult.error)}`);

    const fetched = await apiGet(page, `/api/v1/invoices/${voidTarget.id}`);
    if (fetched.data.status !== "void") {
      throw new Error(`Expected status 'void', got '${fetched.data.status}'`);
    }
  });

  // 11. Write-off overdue invoice works
  await test("11. Write-off overdue invoice works", async () => {
    // Create an invoice with a past due date so it can be written off
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 60);
    const writeOffTarget = await createTestInvoice(page, clientId, {
      dueDate: pastDue.toISOString(),
    });

    // Send it first (write-off typically requires non-draft status)
    await apiPost(page, `/api/v1/invoices/${writeOffTarget.id}/send`);

    const woResult = await apiPost(page, `/api/v1/invoices/${writeOffTarget.id}/write-off`);
    if (!woResult.success) throw new Error(`Write-off failed: ${JSON.stringify(woResult.error)}`);

    const fetched = await apiGet(page, `/api/v1/invoices/${writeOffTarget.id}`);
    if (fetched.data.status !== "written_off") {
      throw new Error(`Expected status 'written_off', got '${fetched.data.status}'`);
    }
  });

  // 12. Bulk actions - select multiple invoices
  await test("12. Bulk actions - select multiple invoices", async () => {
    // Create two invoices to use in bulk action
    const inv1 = await createTestInvoice(page, clientId);
    const inv2 = await createTestInvoice(page, clientId);

    const bulkResult = await page.evaluate(
      async ({ ids }) => {
        const token = localStorage.getItem("access_token");
        const res = await fetch("/api/v1/invoices/bulk-pdf", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });
        return { status: res.status, contentType: res.headers.get("content-type") };
      },
      { ids: [inv1.id, inv2.id] },
    );

    if (bulkResult.status !== 200) {
      throw new Error(`Bulk PDF returned ${bulkResult.status}`);
    }

    // Clean up
    await apiDelete(page, `/api/v1/invoices/${inv1.id}`);
    await apiDelete(page, `/api/v1/invoices/${inv2.id}`);
  });

  // 13. Apply coupon to invoice
  await test("13. Apply coupon to invoice", async () => {
    // Create a coupon first
    const couponCode = "E2E_INV_" + Date.now();
    const couponResult = await apiPost(page, "/api/v1/coupons", {
      code: couponCode,
      name: "E2E Invoice Coupon",
      type: "percentage",
      value: 10,
      validFrom: new Date().toISOString(),
    });
    if (!couponResult.success) throw new Error(`Coupon create failed: ${JSON.stringify(couponResult.error)}`);

    // Create a fresh invoice
    const couponInvoice = await createTestInvoice(page, clientId);

    // Apply the coupon
    const applyResult = await apiPost(page, "/api/v1/coupons/apply", {
      code: couponCode,
      invoiceId: couponInvoice.id,
      clientId,
    });
    if (!applyResult.success) {
      throw new Error(`Apply coupon failed: ${JSON.stringify(applyResult.error)}`);
    }

    // Clean up
    await apiDelete(page, `/api/v1/coupons/${couponResult.data.id}`);
    await apiDelete(page, `/api/v1/invoices/${couponInvoice.id}`);
  });

  // --------------------------------------------------------------------------
  // QUOTE TESTS
  // --------------------------------------------------------------------------
  console.log("\n=== Running Quote Tests ===\n");

  // 14. Quote list page loads
  await test("14. Quote list page loads", async () => {
    await page.goto(`${BASE}/quotes`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (!body || !body.toLowerCase().includes("quote")) {
      throw new Error("Quote list page did not render expected content");
    }
  });

  // 15. Status filter works
  await test("15. Quote status filter works", async () => {
    for (const status of ["draft", "sent", "accepted"]) {
      const result = await apiGet(page, `/api/v1/quotes?status=${status}&limit=5`);
      if (result.status !== 200) throw new Error(`Filter status=${status} returned ${result.status}`);
      for (const q of result.data ?? []) {
        if (q.status !== status) {
          throw new Error(`Expected status '${status}' but got '${q.status}' for quote ${q.id}`);
        }
      }
    }
  });

  // 16. Create quote succeeds (API)
  let createdQuote: any;
  await test("16. Create quote succeeds (API)", async () => {
    createdQuote = await createTestQuote(page, clientId);
    if (!createdQuote.id) throw new Error("Created quote has no ID");
  });

  // 17. Quote detail page loads correctly
  await test("17. Quote detail page loads correctly", async () => {
    if (!createdQuote) throw new Error("No quote created in previous step");
    await page.goto(`${BASE}/quotes/${createdQuote.id}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Quote detail page is empty");
    const hasItem = body.includes("E2E Quote Item");
    if (!hasItem) throw new Error("Quote line item not visible on detail page");
  });

  // 18. Download quote PDF returns 200
  await test("18. Download quote PDF returns 200", async () => {
    if (!createdQuote) throw new Error("No quote created");
    const result = await page.evaluate(async (id: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/v1/quotes/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, contentType: res.headers.get("content-type") };
    }, createdQuote.id);
    if (result.status !== 200) throw new Error(`Quote PDF endpoint returned ${result.status}`);
  });

  // 19. Send quote changes status
  await test("19. Send quote changes status", async () => {
    if (!createdQuote) throw new Error("No quote created");
    const sendResult = await apiPost(page, `/api/v1/quotes/${createdQuote.id}/send`);
    if (!sendResult.success) throw new Error(`Send failed: ${JSON.stringify(sendResult.error)}`);

    const fetched = await apiGet(page, `/api/v1/quotes/${createdQuote.id}`);
    if (fetched.data.status !== "sent") {
      throw new Error(`Expected status 'sent', got '${fetched.data.status}'`);
    }
  });

  // 20. Accept quote changes status
  await test("20. Accept quote changes status", async () => {
    if (!createdQuote) throw new Error("No quote created");
    const acceptResult = await apiPost(page, `/api/v1/quotes/${createdQuote.id}/accept`);
    if (!acceptResult.success) throw new Error(`Accept failed: ${JSON.stringify(acceptResult.error)}`);

    const fetched = await apiGet(page, `/api/v1/quotes/${createdQuote.id}`);
    if (fetched.data.status !== "accepted") {
      throw new Error(`Expected status 'accepted', got '${fetched.data.status}'`);
    }
  });

  // 21. Convert accepted quote to invoice
  await test("21. Convert accepted quote to invoice", async () => {
    if (!createdQuote) throw new Error("No quote created");
    const convertResult = await apiPost(page, `/api/v1/quotes/${createdQuote.id}/convert`);
    if (!convertResult.success) {
      throw new Error(`Convert failed: ${JSON.stringify(convertResult.error)}`);
    }
    // Should return a new invoice
    if (!convertResult.data.id) throw new Error("Converted invoice has no ID");

    // Verify quote status is now 'converted'
    const fetched = await apiGet(page, `/api/v1/quotes/${createdQuote.id}`);
    if (fetched.data.status !== "converted") {
      throw new Error(`Expected quote status 'converted', got '${fetched.data.status}'`);
    }

    // Clean up the created invoice
    await apiDelete(page, `/api/v1/invoices/${convertResult.data.id}`);
  });

  // 22. Edit quote persists changes (client, currency, items)
  await test("22. Edit quote persists changes (client, currency, items)", async () => {
    const editQuote = await createTestQuote(page, clientId);

    const updateResult = await page.evaluate(
      async ({ quoteId }) => {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/v1/quotes/${quoteId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currency: "USD",
            items: [
              { name: "Updated Item Alpha", quantity: 5, rate: 200000, sortOrder: 0 },
              { name: "Updated Item Beta", quantity: 1, rate: 75000, sortOrder: 1 },
            ],
          }),
        });
        const data = await res.json();
        return { status: res.status, success: data.success, data: data.data, error: data.error };
      },
      { quoteId: editQuote.id },
    );

    if (!updateResult.success) {
      throw new Error(`Update failed: ${JSON.stringify(updateResult.error)}`);
    }

    // Verify changes persisted
    const fetched = await apiGet(page, `/api/v1/quotes/${editQuote.id}`);
    if (fetched.data.currency !== "USD") {
      throw new Error(`Currency not updated: expected 'USD', got '${fetched.data.currency}'`);
    }
    const itemNames = (fetched.data.items ?? []).map((i: any) => i.name);
    if (!itemNames.includes("Updated Item Alpha")) {
      throw new Error(`Item 'Updated Item Alpha' not found in updated quote items: ${itemNames}`);
    }
    if (!itemNames.includes("Updated Item Beta")) {
      throw new Error(`Item 'Updated Item Beta' not found in updated quote items: ${itemNames}`);
    }

    // Clean up
    await apiDelete(page, `/api/v1/quotes/${editQuote.id}`);
  });

  // 23. Delete draft quote works
  await test("23. Delete draft quote works", async () => {
    const deleteQuote = await createTestQuote(page, clientId);
    await apiDelete(page, `/api/v1/quotes/${deleteQuote.id}`);

    // Verify it's gone (should 404)
    const fetched = await apiGet(page, `/api/v1/quotes/${deleteQuote.id}`);
    if (fetched.status === 200 && fetched.data) {
      throw new Error("Quote still exists after deletion");
    }
  });

  // --------------------------------------------------------------------------
  // CLEANUP & RESULTS
  // --------------------------------------------------------------------------

  // Clean up the main created invoice (may fail if already deleted — that's fine)
  if (createdInvoice?.id) {
    await apiDelete(page, `/api/v1/invoices/${createdInvoice.id}`).catch(() => {});
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
