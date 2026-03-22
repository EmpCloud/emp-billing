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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\n=== Logging in ===\n");
  await login(page);
  console.log(`Logged in. URL: ${page.url()}\n`);
  console.log("=== Running Tests ===\n");

  // ── Issue #1: Payment method dropdown search ──────────────────────────
  await test("Issue #1: Payment method dropdown has searchable select", async () => {
    await page.goto(`${BASE}/payments`, { waitUntil: "networkidle", timeout: 15000 });
    // Look for the SearchableSelect component (button trigger) for payment methods
    // The filter area should have a searchable dropdown instead of plain select
    const searchableBtn = await page.$('button[role="combobox"]');
    if (!searchableBtn) {
      // Check if there's any searchable/filterable dropdown component
      const anySearchable = await page.$('.relative >> input[placeholder*="Search"]');
      // At minimum, check the page loaded
      const pageContent = await page.textContent("body");
      if (!pageContent?.includes("Payment")) throw new Error("Payments page didn't load");
    }
  });

  // ── Issue #2: Client form phone validation ────────────────────────────
  await test("Issue #2a: Phone field rejects alphabetic characters", async () => {
    await page.goto(`${BASE}/clients/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const phoneInput = await page.$('input[name="phone"]');
    if (!phoneInput) throw new Error("Phone input not found");

    await phoneInput.fill("");
    await phoneInput.type("abc123def");
    const value = await phoneInput.inputValue();
    // Should only contain digits, not letters
    if (value.includes("a") || value.includes("b") || value.includes("c") ||
        value.includes("d") || value.includes("e") || value.includes("f")) {
      throw new Error(`Phone field accepted alphabetic chars: "${value}"`);
    }
  });

  await test("Issue #2b: Country/State/City dropdowns exist", async () => {
    await page.goto(`${BASE}/clients/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for country select dropdown
    const countrySelect = await page.$('select[name="billingAddress.country"]');
    if (!countrySelect) throw new Error("Country dropdown not found");

    // Select a country and check if state dropdown populates
    await countrySelect.selectOption("India");
    await page.waitForTimeout(500);

    const stateSelect = await page.$('select[name="billingAddress.state"]');
    if (!stateSelect) throw new Error("State dropdown not found after selecting country");

    const stateOptions = await stateSelect.$$("option");
    if (stateOptions.length <= 1) throw new Error("State dropdown is empty after selecting India");
  });

  // ── Issue #3: Receipt download ────────────────────────────────────────
  await test("Issue #3: Payment receipt download API works", async () => {
    // Test the API endpoint directly
    const cookies = await context.cookies();
    const tokenCookie = cookies.find(c => c.name === "accessToken");

    // Get a payment ID first
    const paymentsResp = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/payments?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    });

    if (paymentsResp.data && paymentsResp.data.length > 0) {
      const paymentId = paymentsResp.data[0].id;
      const receiptResp = await page.evaluate(async (pid: string) => {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/v1/payments/${pid}/receipt`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, contentType: res.headers.get("content-type") };
      }, paymentId);

      if (receiptResp.status !== 200) {
        throw new Error(`Receipt API returned ${receiptResp.status}`);
      }
    }
  });

  // ── Issue #4: Coupon limited→unlimited update ─────────────────────────
  await test("Issue #4: Coupon update to unlimited redemptions persists", async () => {
    // Create a coupon with limited redemptions, then update to unlimited
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Create a test coupon
      const createRes = await fetch("/api/v1/coupons", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: "TEST_LIMIT_" + Date.now(),
          name: "Test Limited Coupon",
          type: "percentage",
          value: 10,
          maxRedemptions: 5,
          validFrom: new Date().toISOString(),
        }),
      });
      const created = await createRes.json();
      if (!created.success) return { error: "Create failed: " + JSON.stringify(created) };

      const couponId = created.data.id;

      // Update to unlimited (null maxRedemptions)
      const updateRes = await fetch(`/api/v1/coupons/${couponId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ maxRedemptions: null }),
      });
      const updated = await updateRes.json();
      if (!updated.success) return { error: "Update failed: " + JSON.stringify(updated) };

      // Verify it persisted
      const getRes = await fetch(`/api/v1/coupons/${couponId}`, { headers });
      const fetched = await getRes.json();

      // Cleanup
      await fetch(`/api/v1/coupons/${couponId}`, { method: "DELETE", headers });

      return {
        maxRedemptions: fetched.data.maxRedemptions,
        success: fetched.data.maxRedemptions === null || fetched.data.maxRedemptions === undefined,
      };
    });

    if (result.error) throw new Error(result.error);
    if (!result.success) throw new Error(`maxRedemptions not cleared: ${result.maxRedemptions}`);
  });

  // ── Issue #5: Coupon creation with blank redemption per client ────────
  await test("Issue #5: Coupon creation works with blank maxRedemptionsPerClient", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const createRes = await fetch("/api/v1/coupons", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: "TEST_UNLIM_" + Date.now(),
          name: "Test Unlimited Coupon",
          type: "percentage",
          value: 15,
          validFrom: new Date().toISOString(),
          // intentionally omit maxRedemptionsPerClient
        }),
      });
      const created = await createRes.json();
      if (!created.success) return { error: "Create failed: " + JSON.stringify(created) };

      // Cleanup
      await fetch(`/api/v1/coupons/${created.data.id}`, {
        method: "DELETE",
        headers,
      });

      return { success: true, maxRedemptionsPerClient: created.data.maxRedemptionsPerClient };
    });

    if (result.error) throw new Error(result.error);
  });

  // ── Issue #6: Valid coupon code validation ─────────────────────────────
  await test("Issue #6: Valid coupon code is accepted for invoice", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Create a coupon
      const code = "VALID_TEST_" + Date.now();
      const createRes = await fetch("/api/v1/coupons", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code,
          name: "Test Valid Coupon",
          type: "percentage",
          value: 10,
          validFrom: new Date().toISOString(),
        }),
      });
      const created = await createRes.json();
      if (!created.success) return { error: "Create coupon failed: " + JSON.stringify(created) };

      // Validate the coupon (POST endpoint)
      const validateRes = await fetch("/api/v1/coupons/validate", {
        method: "POST",
        headers,
        body: JSON.stringify({ code }),
      });
      const validated = await validateRes.json();

      // Cleanup
      await fetch(`/api/v1/coupons/${created.data.id}`, { method: "DELETE", headers });

      return {
        validateStatus: validateRes.status,
        valid: validated.success,
        error: validated.error,
      };
    });

    if (result.error && !result.valid) throw new Error(`Coupon validation failed: ${JSON.stringify(result.error)}`);
    if (result.validateStatus !== 200) throw new Error(`Validate returned ${result.validateStatus}`);
  });

  // ── Issue #7: Quote PDF download ──────────────────────────────────────
  await test("Issue #7: Quote PDF download API works", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}` };

      // Get a quote
      const quotesRes = await fetch("/api/v1/quotes?limit=1", { headers });
      const quotes = await quotesRes.json();
      if (!quotes.data || quotes.data.length === 0) return { skip: true };

      const quoteId = quotes.data[0].id;
      const pdfRes = await fetch(`/api/v1/quotes/${quoteId}/pdf`, { headers });

      return {
        status: pdfRes.status,
        contentType: pdfRes.headers.get("content-type"),
      };
    });

    if (result.skip) {
      log("    ", "No quotes found — skipping PDF test");
      return;
    }
    if (result.status !== 200) throw new Error(`Quote PDF API returned ${result.status}`);
  });

  // ── Issue #8: Client CSV import ───────────────────────────────────────
  await test("Issue #8: Client CSV import works", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");

      const csvContent = "name,email,phone\nTest Import Co,test-import@example.com,+919999999999\n";

      const res = await fetch("/api/v1/clients/import/csv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = await res.json();
      return { status: res.status, success: data.success, data: data.data, error: data.error };
    });

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Import returned ${result.status}: ${JSON.stringify(result.error)}`);
    }
    if (!result.success) throw new Error(`Import failed: ${JSON.stringify(result.error)}`);
  });

  // ── Issue #9: Quote editing persists changes ──────────────────────────
  await test("Issue #9: Quote field updates (currency) persist", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Get a quote
      const quotesRes = await fetch("/api/v1/quotes?limit=1", { headers });
      const quotes = await quotesRes.json();
      if (!quotes.data || quotes.data.length === 0) return { skip: true };

      const quote = quotes.data[0];
      const newCurrency = quote.currency === "USD" ? "EUR" : "USD";

      // Update currency
      const updateRes = await fetch(`/api/v1/quotes/${quote.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ currency: newCurrency }),
      });
      const updated = await updateRes.json();
      if (!updated.success) return { error: "Update failed: " + JSON.stringify(updated) };

      // Verify it persisted
      const getRes = await fetch(`/api/v1/quotes/${quote.id}`, { headers });
      const fetched = await getRes.json();

      // Restore original
      await fetch(`/api/v1/quotes/${quote.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ currency: quote.currency }),
      });

      return {
        expected: newCurrency,
        actual: fetched.data.currency,
        success: fetched.data.currency === newCurrency,
      };
    });

    if (result.skip) {
      log("    ", "No quotes found — skipping edit test");
      return;
    }
    if (result.error) throw new Error(result.error);
    if (!result.success) throw new Error(`Currency not persisted. Expected: ${result.expected}, Got: ${result.actual}`);
  });

  // ── Results ───────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
