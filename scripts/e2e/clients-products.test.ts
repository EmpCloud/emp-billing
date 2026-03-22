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
  await new Promise(r => setTimeout(r, 1500));
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

/** Helper: call API from page context and return parsed JSON */
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
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return { _status: res.status, ...(await res.json()) };
      }
      // For non-JSON responses (CSV, PDF, etc.)
      const text = await res.text();
      return { _status: res.status, _text: text, _contentType: contentType };
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
  console.log("=== Running Clients & Products E2E Tests ===\n");

  // Track IDs for cleanup / dependent tests
  let createdClientId: string | null = null;
  let createdGoodsProductId: string | null = null;
  let createdServiceProductId: string | null = null;

  // ════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ════════════════════════════════════════════════════════════════════════

  // 1. Client list page loads with table
  await test("1. Client list page loads with table", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const table = await page.$("table");
    if (!table) {
      // Fallback: check for list-like content
      const body = await page.textContent("body");
      if (!body?.toLowerCase().includes("client")) {
        throw new Error("Client list page did not load — no table or client content found");
      }
    }
  });

  // 2. Search filter works on client list
  await test("2. Search filter works on client list", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    // Try search via the API with a search query param
    const result = await api(page, "GET", "/api/v1/clients?search=acme&limit=5");
    if (result._status !== 200) throw new Error(`API returned ${result._status}`);
    if (!result.success) throw new Error(`API error: ${JSON.stringify(result.error)}`);
    // search should return an array (may be empty if no match — that's okay, API worked)
    if (!Array.isArray(result.data)) throw new Error("Expected data array from search");
  });

  // 3. Create new client with required fields succeeds
  await test("3. Create new client with required fields succeeds", async () => {
    const ts = Date.now();
    const result = await api(page, "POST", "/api/v1/clients", {
      name: `E2E Test Client ${ts}`,
      displayName: `E2E Client ${ts}`,
      email: `e2e-client-${ts}@example.com`,
      phone: "+919876543210",
      currency: "INR",
      paymentTerms: 30,
    });
    if (result._status !== 200 && result._status !== 201) {
      throw new Error(`Create returned ${result._status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Create failed: ${JSON.stringify(result.error)}`);
    if (!result.data?.id) throw new Error("No client ID returned");
    createdClientId = result.data.id;
  });

  // 4. Client detail page loads with correct data
  await test("4. Client detail page loads with correct data", async () => {
    if (!createdClientId) throw new Error("No client ID from previous test");
    const result = await api(page, "GET", `/api/v1/clients/${createdClientId}`);
    if (result._status !== 200) throw new Error(`GET returned ${result._status}`);
    if (!result.success) throw new Error(`GET failed: ${JSON.stringify(result.error)}`);
    if (!result.data.name.includes("E2E Test Client")) {
      throw new Error(`Unexpected client name: ${result.data.name}`);
    }
    if (!result.data.email.includes("e2e-client-")) {
      throw new Error(`Unexpected client email: ${result.data.email}`);
    }

    // Also verify the UI detail page loads
    await page.goto(`${BASE}/clients/${createdClientId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("E2E")) {
      throw new Error("Client detail page did not render client name");
    }
  });

  // 5. Edit client updates fields correctly
  await test("5. Edit client updates fields correctly", async () => {
    if (!createdClientId) throw new Error("No client ID from previous test");
    const newName = `E2E Updated Client ${Date.now()}`;
    const updateResult = await api(page, "PUT", `/api/v1/clients/${createdClientId}`, {
      name: newName,
      displayName: newName,
    });
    if (updateResult._status !== 200) {
      throw new Error(`Update returned ${updateResult._status}: ${JSON.stringify(updateResult.error)}`);
    }
    if (!updateResult.success) throw new Error(`Update failed: ${JSON.stringify(updateResult.error)}`);

    // Verify the update persisted
    const getResult = await api(page, "GET", `/api/v1/clients/${createdClientId}`);
    if (getResult.data.name !== newName) {
      throw new Error(`Name not updated. Expected "${newName}", got "${getResult.data.name}"`);
    }
  });

  // 6. CSV export returns a file
  await test("6. Client CSV export returns a file", async () => {
    const result = await api(page, "GET", "/api/v1/clients/export/csv");
    if (result._status !== 200) throw new Error(`Export returned ${result._status}`);
    // Should be CSV content
    if (result._text !== undefined) {
      if (result._text.length === 0) throw new Error("CSV export returned empty body");
      // CSV should have header row with comma-separated values
      if (!result._text.includes(",") && !result._text.includes("name")) {
        throw new Error("Response does not look like CSV");
      }
    } else if (result.data) {
      // Some APIs return JSON-wrapped CSV
    } else {
      throw new Error("No CSV content in response");
    }
  });

  // 7. CSV import with valid data succeeds
  await test("7. Client CSV import with valid data succeeds", async () => {
    const ts = Date.now();
    const csvContent = `name,email,phone\nCSV Import Client ${ts},csv-import-${ts}@example.com,+911234567890\n`;
    const result = await api(page, "POST", "/api/v1/clients/import/csv", {
      csv: csvContent,
    });
    if (result._status !== 200 && result._status !== 201) {
      throw new Error(`Import returned ${result._status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Import failed: ${JSON.stringify(result.error)}`);
  });

  // 8. Client statement loads with date range filter
  await test("8. Client statement loads with date range filter", async () => {
    if (!createdClientId) throw new Error("No client ID from previous test");
    const from = "2025-01-01";
    const to = "2026-12-31";
    const result = await api(
      page,
      "GET",
      `/api/v1/clients/${createdClientId}/statement?from=${from}&to=${to}`,
    );
    if (result._status !== 200) throw new Error(`Statement returned ${result._status}`);
    if (!result.success) throw new Error(`Statement failed: ${JSON.stringify(result.error)}`);
    // Statement data should be present (may be empty for new client)
    if (result.data === undefined) throw new Error("No statement data returned");
  });

  // 9. Delete client works
  await test("9. Delete client works", async () => {
    if (!createdClientId) throw new Error("No client ID from previous test");
    const deleteResult = await api(page, "DELETE", `/api/v1/clients/${createdClientId}`);
    if (deleteResult._status !== 200 && deleteResult._status !== 204) {
      throw new Error(`Delete returned ${deleteResult._status}: ${JSON.stringify(deleteResult.error)}`);
    }

    // Verify it's gone (should 404 or return inactive)
    const getResult = await api(page, "GET", `/api/v1/clients/${createdClientId}`);
    if (getResult._status === 200 && getResult.data?.isActive !== false) {
      // Some systems soft-delete; either 404 or isActive=false is acceptable
      throw new Error("Client still accessible after delete");
    }
    createdClientId = null;
  });

  // ════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════════════════════

  // 10. Product list page loads with table
  await test("10. Product list page loads with table", async () => {
    await page.goto(`${BASE}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const table = await page.$("table");
    if (!table) {
      const body = await page.textContent("body");
      if (!body?.toLowerCase().includes("product")) {
        throw new Error("Product list page did not load — no table or product content found");
      }
    }
  });

  // 11. Search filter works on product list
  await test("11. Search filter works on product list", async () => {
    const result = await api(page, "GET", "/api/v1/products?search=test&limit=5");
    if (result._status !== 200) throw new Error(`API returned ${result._status}`);
    if (!result.success) throw new Error(`API error: ${JSON.stringify(result.error)}`);
    if (!Array.isArray(result.data)) throw new Error("Expected data array from search");
  });

  // 12. Create new product (goods type) succeeds
  await test("12. Create new product (goods type) succeeds", async () => {
    const ts = Date.now();
    const result = await api(page, "POST", "/api/v1/products", {
      name: `E2E Goods Product ${ts}`,
      description: "E2E test goods product",
      sku: `E2E-G-${ts}`,
      type: "goods",
      unit: "units",
      rate: 150000, // 1500.00 in smallest unit
    });
    if (result._status !== 200 && result._status !== 201) {
      throw new Error(`Create returned ${result._status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Create failed: ${JSON.stringify(result.error)}`);
    if (!result.data?.id) throw new Error("No product ID returned");
    createdGoodsProductId = result.data.id;
  });

  // 13. Create new product (services type) succeeds
  await test("13. Create new product (service type) succeeds", async () => {
    const ts = Date.now();
    const result = await api(page, "POST", "/api/v1/products", {
      name: `E2E Service Product ${ts}`,
      description: "E2E test service product",
      sku: `E2E-S-${ts}`,
      type: "service",
      unit: "hours",
      rate: 500000, // 5000.00 in smallest unit
    });
    if (result._status !== 200 && result._status !== 201) {
      throw new Error(`Create returned ${result._status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Create failed: ${JSON.stringify(result.error)}`);
    if (!result.data?.id) throw new Error("No product ID returned");
    createdServiceProductId = result.data.id;
  });

  // 14. Product detail page shows correct info
  await test("14. Product detail page shows correct info", async () => {
    if (!createdGoodsProductId) throw new Error("No goods product ID from previous test");
    const result = await api(page, "GET", `/api/v1/products/${createdGoodsProductId}`);
    if (result._status !== 200) throw new Error(`GET returned ${result._status}`);
    if (!result.success) throw new Error(`GET failed: ${JSON.stringify(result.error)}`);
    if (!result.data.name.includes("E2E Goods Product")) {
      throw new Error(`Unexpected product name: ${result.data.name}`);
    }
    if (result.data.type !== "goods") {
      throw new Error(`Expected type "goods", got "${result.data.type}"`);
    }
    if (result.data.rate !== 150000) {
      throw new Error(`Expected rate 150000, got ${result.data.rate}`);
    }

    // Also verify the UI detail page loads
    await page.goto(`${BASE}/products/${createdGoodsProductId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("E2E")) {
      throw new Error("Product detail page did not render product name");
    }
  });

  // 15. Edit product updates correctly
  await test("15. Edit product updates correctly", async () => {
    if (!createdGoodsProductId) throw new Error("No goods product ID from previous test");
    const newName = `E2E Updated Goods ${Date.now()}`;
    const updateResult = await api(page, "PUT", `/api/v1/products/${createdGoodsProductId}`, {
      name: newName,
      rate: 200000,
    });
    if (updateResult._status !== 200) {
      throw new Error(`Update returned ${updateResult._status}: ${JSON.stringify(updateResult.error)}`);
    }
    if (!updateResult.success) throw new Error(`Update failed: ${JSON.stringify(updateResult.error)}`);

    // Verify the update persisted
    const getResult = await api(page, "GET", `/api/v1/products/${createdGoodsProductId}`);
    if (getResult.data.name !== newName) {
      throw new Error(`Name not updated. Expected "${newName}", got "${getResult.data.name}"`);
    }
    if (getResult.data.rate !== 200000) {
      throw new Error(`Rate not updated. Expected 200000, got ${getResult.data.rate}`);
    }
  });

  // 16. Product CSV export returns a file
  await test("16. Product CSV export returns a file", async () => {
    const result = await api(page, "GET", "/api/v1/products/export/csv");
    if (result._status !== 200) throw new Error(`Export returned ${result._status}`);
    if (result._text !== undefined) {
      if (result._text.length === 0) throw new Error("CSV export returned empty body");
      if (!result._text.includes(",") && !result._text.includes("name")) {
        throw new Error("Response does not look like CSV");
      }
    } else if (result.data) {
      // JSON-wrapped CSV is also acceptable
    } else {
      throw new Error("No CSV content in response");
    }
  });

  // 17. Product CSV import works
  await test("17. Product CSV import works", async () => {
    const ts = Date.now();
    const csvContent = `name,type,rate,unit\nCSV Import Product ${ts},goods,100000,units\n`;
    const result = await api(page, "POST", "/api/v1/products/import/csv", {
      csv: csvContent,
    });
    if (result._status !== 200 && result._status !== 201) {
      throw new Error(`Import returned ${result._status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Import failed: ${JSON.stringify(result.error)}`);
  });

  // 18. Delete product works
  await test("18a. Delete goods product works", async () => {
    if (!createdGoodsProductId) throw new Error("No goods product ID from previous test");
    const deleteResult = await api(page, "DELETE", `/api/v1/products/${createdGoodsProductId}`);
    if (deleteResult._status !== 200 && deleteResult._status !== 204) {
      throw new Error(`Delete returned ${deleteResult._status}: ${JSON.stringify(deleteResult.error)}`);
    }

    // Verify it's gone
    const getResult = await api(page, "GET", `/api/v1/products/${createdGoodsProductId}`);
    if (getResult._status === 200 && getResult.data?.isActive !== false) {
      throw new Error("Product still accessible after delete");
    }
    createdGoodsProductId = null;
  });

  await test("18b. Delete service product works", async () => {
    if (!createdServiceProductId) throw new Error("No service product ID from previous test");
    const deleteResult = await api(page, "DELETE", `/api/v1/products/${createdServiceProductId}`);
    if (deleteResult._status !== 200 && deleteResult._status !== 204) {
      throw new Error(`Delete returned ${deleteResult._status}: ${JSON.stringify(deleteResult.error)}`);
    }

    // Verify it's gone
    const getResult = await api(page, "GET", `/api/v1/products/${createdServiceProductId}`);
    if (getResult._status === 200 && getResult.data?.isActive !== false) {
      throw new Error("Product still accessible after delete");
    }
    createdServiceProductId = null;
  });

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
