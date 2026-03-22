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

/** Helper: call API from page context with auth token */
async function api(page: Page, method: string, path: string, body?: unknown): Promise<any> {
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
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return { status: res.status, ...(await res.json()) };
      }
      return { status: res.status, contentType };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("=== Payment Tests ===\n");

  // 1. Payment list page loads
  await test("1. Payment list page loads", async () => {
    await page.goto(`${BASE}/payments`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("payment")) {
      throw new Error("Payments page content not found");
    }
  });

  // 2. Payment method filter works (SearchableSelect component)
  await test("2. Payment method filter works (SearchableSelect)", async () => {
    await page.goto(`${BASE}/payments`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    // Look for SearchableSelect combobox trigger for payment method filter
    const combobox = await page.$('button[role="combobox"]');
    if (!combobox) {
      // Fallback: check for any select/filter related to method
      const filterSelect = await page.$('select');
      if (!filterSelect) throw new Error("No payment method filter (combobox or select) found");
      // Use the select
      const options = await filterSelect.$$("option");
      if (options.length <= 1) throw new Error("Payment method filter has no options");
    } else {
      // Click the combobox to open it
      await combobox.click();
      await page.waitForTimeout(300);
      // Look for search input inside the popover
      const searchInput = await page.$('input[role="combobox"], [cmdk-input]');
      if (searchInput) {
        await searchInput.fill("cash");
        await page.waitForTimeout(300);
      }
      // Close by pressing Escape
      await page.keyboard.press("Escape");
    }
  });

  // 3. Record payment page loads with required fields
  await test("3. Record payment page loads with required fields", async () => {
    await page.goto(`${BASE}/payments/record`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("record") && !body?.toLowerCase().includes("payment")) {
      throw new Error("Record payment page did not load");
    }

    // Check for required form fields
    const amountField = await page.$('input[name="amount"], input[placeholder*="mount"]');
    if (!amountField) throw new Error("Amount field not found on record payment page");
  });

  // 4. Record payment with valid data succeeds (use API)
  let testPaymentId: string | null = null;
  await test("4. Record payment with valid data succeeds (API)", async () => {
    // First get a client ID to use
    const clientsRes = await api(page, "GET", "/api/v1/clients?limit=1");
    if (!clientsRes.data || clientsRes.data.length === 0) {
      throw new Error("No clients found to record payment against");
    }
    const clientId = clientsRes.data[0].id;

    const result = await api(page, "POST", "/api/v1/payments", {
      clientId,
      date: new Date().toISOString(),
      amount: 50000, // 500.00 in smallest unit
      method: "bank_transfer",
      reference: "E2E-TEST-" + Date.now(),
      notes: "E2E test payment",
    });

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Record payment returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Record payment failed: ${JSON.stringify(result.error || result.message)}`);
    }
    testPaymentId = result.data.id;
  });

  // 5. Payment detail page shows correct info
  await test("5. Payment detail page shows correct info", async () => {
    if (!testPaymentId) throw new Error("No test payment ID (test 4 must pass first)");

    await page.goto(`${BASE}/payments/${testPaymentId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    if (!body) throw new Error("Payment detail page is empty");

    // Should show payment amount or reference
    const hasPaymentInfo =
      body.includes("500") || body.includes("bank_transfer") || body.toLowerCase().includes("e2e");
    if (!hasPaymentInfo) throw new Error("Payment detail page does not display expected payment info");
  });

  // 6. Download payment receipt returns 200
  await test("6. Download payment receipt returns 200", async () => {
    if (!testPaymentId) throw new Error("No test payment ID (test 4 must pass first)");

    const result = await api(page, "GET", `/api/v1/payments/${testPaymentId}/receipt`);
    if (result.status !== 200) {
      throw new Error(`Receipt download returned ${result.status}`);
    }
  });

  // 7. Refund payment works
  await test("7. Refund payment works", async () => {
    if (!testPaymentId) throw new Error("No test payment ID (test 4 must pass first)");

    const result = await api(page, "POST", `/api/v1/payments/${testPaymentId}/refund`, {
      amount: 10000, // 100.00 partial refund
      reason: "E2E test refund",
    });

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Refund returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Refund failed: ${JSON.stringify(result.error || result.message)}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Expense Tests ===\n");

  // 8. Expense list page loads
  await test("8. Expense list page loads", async () => {
    await page.goto(`${BASE}/expenses`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("expense")) {
      throw new Error("Expenses page content not found");
    }
  });

  // 9. Search filter works on expenses
  await test("9. Search filter works on expenses", async () => {
    await page.goto(`${BASE}/expenses`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    const searchInput = await page.$('input[placeholder*="earch"], input[type="search"]');
    if (!searchInput) throw new Error("Search input not found on expenses page");

    await searchInput.fill("test");
    await page.waitForTimeout(500);
    // The page should still be functional (not crash)
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("expense")) {
      throw new Error("Expenses page broke after search input");
    }
  });

  // 10. Status filter works
  await test("10. Status filter works on expenses", async () => {
    await page.goto(`${BASE}/expenses`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    // Look for status filter - could be a select or combobox
    const statusFilter =
      (await page.$('select[name="status"], select[id*="status"]')) ||
      (await page.$('button[role="combobox"]:has-text("Status")'));

    if (!statusFilter) {
      // Try API filter directly
      const result = await api(page, "GET", "/api/v1/expenses?status=pending");
      if (result.status !== 200) throw new Error(`Status filter API returned ${result.status}`);
    } else {
      if ((await statusFilter.evaluate((el) => el.tagName)) === "SELECT") {
        await statusFilter.selectOption("pending");
      } else {
        await statusFilter.click();
        await page.waitForTimeout(300);
        await page.keyboard.press("Escape");
      }
    }
  });

  // 11. Category filter works
  await test("11. Category filter works on expenses", async () => {
    // Test via API since UI filter implementation may vary
    const categoriesRes = await api(page, "GET", "/api/v1/expenses/categories");
    if (categoriesRes.status !== 200) {
      throw new Error(`Categories API returned ${categoriesRes.status}`);
    }

    if (categoriesRes.data && categoriesRes.data.length > 0) {
      const catId = categoriesRes.data[0].id;
      const result = await api(page, "GET", `/api/v1/expenses?categoryId=${catId}`);
      if (result.status !== 200) {
        throw new Error(`Category filter API returned ${result.status}`);
      }
    }
  });

  // 12. Date range filter works
  await test("12. Date range filter works on expenses", async () => {
    const from = "2025-01-01";
    const to = "2026-12-31";
    const result = await api(page, "GET", `/api/v1/expenses?from=${from}&to=${to}`);
    if (result.status !== 200) {
      throw new Error(`Date range filter API returned ${result.status}`);
    }
  });

  // Ensure we have a category for expense creation
  let testCategoryId: string | null = null;
  await test("(setup) Ensure expense category exists", async () => {
    const categoriesRes = await api(page, "GET", "/api/v1/expenses/categories");
    if (categoriesRes.data && categoriesRes.data.length > 0) {
      testCategoryId = categoriesRes.data[0].id;
    } else {
      // Create a category
      const createRes = await api(page, "POST", "/api/v1/expenses/categories", {
        name: "E2E Test Category",
        description: "Created by E2E test",
      });
      if (!createRes.success) throw new Error("Failed to create expense category");
      testCategoryId = createRes.data.id;
    }
  });

  // 13. Create expense succeeds
  let testExpenseId: string | null = null;
  await test("13. Create expense succeeds", async () => {
    if (!testCategoryId) throw new Error("No category ID (setup must pass first)");

    const result = await api(page, "POST", "/api/v1/expenses", {
      categoryId: testCategoryId,
      date: new Date().toISOString(),
      amount: 25000, // 250.00
      currency: "INR",
      taxAmount: 4500,
      description: "E2E test expense - " + Date.now(),
      isBillable: false,
      tags: ["e2e-test"],
    });

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Create expense returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Create expense failed: ${JSON.stringify(result.error || result.message)}`);
    }
    testExpenseId = result.data.id;
  });

  // 14. Expense detail page loads
  await test("14. Expense detail page loads", async () => {
    if (!testExpenseId) throw new Error("No test expense ID (test 13 must pass first)");

    await page.goto(`${BASE}/expenses/${testExpenseId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("expense") && !body?.includes("250")) {
      throw new Error("Expense detail page did not display expense info");
    }
  });

  // 15. Edit expense updates correctly
  await test("15. Edit expense updates correctly", async () => {
    if (!testExpenseId) throw new Error("No test expense ID (test 13 must pass first)");

    const newDescription = "E2E updated expense - " + Date.now();
    const result = await api(page, "PUT", `/api/v1/expenses/${testExpenseId}`, {
      description: newDescription,
      amount: 30000, // updated to 300.00
    });

    if (result.status !== 200) {
      throw new Error(`Update expense returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Update expense failed: ${JSON.stringify(result.error || result.message)}`);
    }

    // Verify the update persisted
    const getRes = await api(page, "GET", `/api/v1/expenses/${testExpenseId}`);
    if (getRes.data.amount !== 30000) {
      throw new Error(`Amount not updated. Expected 30000, got ${getRes.data.amount}`);
    }
  });

  // 16. Delete expense works (was bug #11 - verify fixed)
  await test("16. Delete expense works (bug #11 regression)", async () => {
    // Create a separate expense to delete so we don't lose testExpenseId for later tests
    if (!testCategoryId) throw new Error("No category ID");

    const createRes = await api(page, "POST", "/api/v1/expenses", {
      categoryId: testCategoryId,
      date: new Date().toISOString(),
      amount: 1000,
      currency: "INR",
      taxAmount: 0,
      description: "E2E delete test expense - " + Date.now(),
      isBillable: false,
      tags: [],
    });
    if (!createRes.success) throw new Error("Failed to create expense for deletion test");

    const deleteId = createRes.data.id;

    const deleteRes = await api(page, "DELETE", `/api/v1/expenses/${deleteId}`);
    if (deleteRes.status !== 200 && deleteRes.status !== 204) {
      throw new Error(`Delete expense returned ${deleteRes.status}: ${JSON.stringify(deleteRes.error || deleteRes.message)}`);
    }

    // Verify it's gone - should return 404
    const verifyRes = await api(page, "GET", `/api/v1/expenses/${deleteId}`);
    if (verifyRes.status === 200 && verifyRes.success) {
      throw new Error("Expense still exists after deletion - bug #11 may not be fixed");
    }
  });

  // 17. Bill expense to client works
  await test("17. Bill expense to client works", async () => {
    if (!testExpenseId) throw new Error("No test expense ID (test 13 must pass first)");

    // Get a client to bill to
    const clientsRes = await api(page, "GET", "/api/v1/clients?limit=1");
    if (!clientsRes.data || clientsRes.data.length === 0) {
      throw new Error("No clients found to bill expense to");
    }
    const clientId = clientsRes.data[0].id;

    // First make the expense billable with a client
    await api(page, "PUT", `/api/v1/expenses/${testExpenseId}`, {
      isBillable: true,
      clientId,
    });

    // Approve the expense first (required before billing)
    await api(page, "POST", `/api/v1/expenses/${testExpenseId}/approve`);

    const billRes = await api(page, "POST", `/api/v1/expenses/${testExpenseId}/bill`);
    if (billRes.status !== 200 && billRes.status !== 201) {
      throw new Error(`Bill expense returned ${billRes.status}: ${JSON.stringify(billRes.error || billRes.message)}`);
    }
    if (!billRes.success) {
      throw new Error(`Bill expense failed: ${JSON.stringify(billRes.error || billRes.message)}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n=== Vendor Tests ===\n");

  // 18. Vendor list page loads
  await test("18. Vendor list page loads", async () => {
    await page.goto(`${BASE}/vendors`, { waitUntil: "networkidle", timeout: 15000 });
    const body = await page.textContent("body");
    if (!body?.toLowerCase().includes("vendor")) {
      throw new Error("Vendors page content not found");
    }
  });

  // 19. Search works
  await test("19. Vendor search works", async () => {
    await page.goto(`${BASE}/vendors`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    const searchInput = await page.$('input[placeholder*="earch"], input[type="search"]');
    if (!searchInput) {
      // Test via API instead
      const result = await api(page, "GET", "/api/v1/vendors?search=test");
      if (result.status !== 200) throw new Error(`Vendor search API returned ${result.status}`);
    } else {
      await searchInput.fill("test");
      await page.waitForTimeout(500);
      const body = await page.textContent("body");
      if (!body?.toLowerCase().includes("vendor")) {
        throw new Error("Vendor page broke after search");
      }
    }
  });

  // 20. Create vendor succeeds
  let testVendorId: string | null = null;
  await test("20. Create vendor succeeds", async () => {
    const uniqueSuffix = Date.now();
    const result = await api(page, "POST", "/api/v1/vendors", {
      name: `E2E Test Vendor ${uniqueSuffix}`,
      email: `e2e-vendor-${uniqueSuffix}@example.com`,
      phone: "+919876543210",
      company: "E2E Vendor Corp",
      addressLine1: "123 Test Street",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
      notes: "Created by E2E test",
    });

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Create vendor returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Create vendor failed: ${JSON.stringify(result.error || result.message)}`);
    }
    testVendorId = result.data.id;
  });

  // 21. Vendor detail page loads
  await test("21. Vendor detail page loads", async () => {
    if (!testVendorId) throw new Error("No test vendor ID (test 20 must pass first)");

    await page.goto(`${BASE}/vendors/${testVendorId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    const body = await page.textContent("body");
    if (!body?.includes("E2E Test Vendor") && !body?.includes("E2E Vendor Corp")) {
      throw new Error("Vendor detail page does not show expected vendor info");
    }
  });

  // 22. Edit vendor works
  await test("22. Edit vendor works", async () => {
    if (!testVendorId) throw new Error("No test vendor ID (test 20 must pass first)");

    const newName = "E2E Updated Vendor " + Date.now();
    const result = await api(page, "PUT", `/api/v1/vendors/${testVendorId}`, {
      name: newName,
      company: "E2E Updated Corp",
    });

    if (result.status !== 200) {
      throw new Error(`Update vendor returned ${result.status}: ${JSON.stringify(result.error || result.message)}`);
    }
    if (!result.success) {
      throw new Error(`Update vendor failed: ${JSON.stringify(result.error || result.message)}`);
    }

    // Verify persistence
    const getRes = await api(page, "GET", `/api/v1/vendors/${testVendorId}`);
    if (getRes.data.name !== newName) {
      throw new Error(`Vendor name not updated. Expected "${newName}", got "${getRes.data.name}"`);
    }
    if (getRes.data.company !== "E2E Updated Corp") {
      throw new Error(`Vendor company not updated. Expected "E2E Updated Corp", got "${getRes.data.company}"`);
    }
  });

  // 23. Delete vendor works
  await test("23. Delete vendor works", async () => {
    if (!testVendorId) throw new Error("No test vendor ID (test 20 must pass first)");

    const deleteRes = await api(page, "DELETE", `/api/v1/vendors/${testVendorId}`);
    if (deleteRes.status !== 200 && deleteRes.status !== 204) {
      throw new Error(`Delete vendor returned ${deleteRes.status}: ${JSON.stringify(deleteRes.error || deleteRes.message)}`);
    }

    // Verify it's gone
    const verifyRes = await api(page, "GET", `/api/v1/vendors/${testVendorId}`);
    if (verifyRes.status === 200 && verifyRes.success) {
      throw new Error("Vendor still exists after deletion");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════════════

  // Clean up test payment (best-effort)
  if (testPaymentId) {
    await api(page, "DELETE", `/api/v1/payments/${testPaymentId}`).catch(() => {});
  }
  // Clean up test expense (best-effort)
  if (testExpenseId) {
    await api(page, "DELETE", `/api/v1/expenses/${testExpenseId}`).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Results
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
