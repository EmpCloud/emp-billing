/**
 * E2E Tests — Coupons, Dunning, Disputes, Usage, SaaS Metrics
 *
 * Run:  npx tsx scripts/e2e/coupons-dunning-disputes-usage-metrics.test.ts
 */
import { chromium, type Page, type BrowserContext } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:4001";
const EMAIL = "admin@acme.com";
const PASSWORD = "Admin@123";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: message });
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${message}`);
  }
}

function printSummary() {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("\n========================================");
  console.log(`  TOTAL: ${results.length}  |  PASS: ${passed}  |  FAIL: ${failed}`);
  console.log("========================================\n");
  if (failed > 0) {
    console.log("Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let storedToken: string | null = null;

/** Handle ngrok interstitial page if present. */
async function handleNgrokInterstitial(page: Page) {
  try {
    const visitBtn = await page.$('button:has-text("Visit Site")');
    if (visitBtn) {
      await visitBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    }
  } catch {
    // No interstitial — continue
  }
}

/** Login via API (fast). Sets the token in localStorage and navigates to dashboard. */
async function loginViaAPI(page: Page): Promise<string> {
  if (storedToken) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await handleNgrokInterstitial(page);
    await page.evaluate((t) => localStorage.setItem("access_token", t), storedToken);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
    return storedToken;
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await handleNgrokInterstitial(page);

  const token = await page.evaluate(
    async ({ url, email, password }) => {
      const res = await fetch(`${url}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`Login API returned ${res.status}`);
      const json = await res.json();
      const accessToken: string = json.data?.accessToken ?? json.accessToken;
      localStorage.setItem("access_token", accessToken);
      return accessToken;
    },
    { url: BASE_URL, email: EMAIL, password: PASSWORD },
  );

  storedToken = token;
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
  return token;
}

/** Make an authenticated API call from the page context. */
async function apiCall(
  page: Page,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  return page.evaluate(
    async ({ url, method, path, body, token }) => {
      const opts: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${url}${path}`, opts);
      const json = await res.json();
      return { status: res.status, json };
    },
    { url: BASE_URL, method, path, body: body as any, token: storedToken },
  );
}

// Track created IDs for cleanup / cross-test references
let percentageCouponId: string | null = null;
let percentageCouponCode: string | null = null;
let fixedCouponId: string | null = null;
let firstDisputeId: string | null = null;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\nEMP-Billing E2E Tests — Coupons, Dunning, Disputes, Usage, SaaS Metrics`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Login once to get the token
  {
    const page = await context.newPage();
    await loginViaAPI(page);
    await page.close();
  }

  // =========================================================================
  //  COUPON TESTS
  // =========================================================================
  console.log("--- Coupon Tests ---");

  // 1. Coupon list page loads
  await test("Coupon list page loads", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });

      // Page should have the "Coupons" heading
      const heading = await page.waitForSelector("text=Coupons", { timeout: 10000 });
      if (!heading) throw new Error("Coupons heading not found");

      // Should have a "New Coupon" button
      const newBtn = await page.$('button:has-text("New Coupon")');
      if (!newBtn) throw new Error("New Coupon button not found");
    } finally {
      await page.close();
    }
  });

  // 2. Create coupon (percentage type) succeeds
  await test("Create coupon (percentage type) succeeds", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      const code = `E2EPCT${Date.now().toString(36).toUpperCase()}`;

      const res = await apiCall(page, "POST", "/api/v1/coupons", {
        code,
        name: "E2E Percentage Coupon",
        type: "percentage",
        value: 15,
        appliesTo: "invoice",
        maxRedemptions: 100,
        minAmount: 0,
        validFrom: new Date().toISOString(),
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.json)}`);
      }
      if (!res.json.data?.id) throw new Error("No coupon ID returned");

      percentageCouponId = res.json.data.id;
      percentageCouponCode = res.json.data.code;
    } finally {
      await page.close();
    }
  });

  // 3. Create coupon (fixed amount type) succeeds
  await test("Create coupon (fixed amount type) succeeds", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      const code = `E2EFIX${Date.now().toString(36).toUpperCase()}`;

      const res = await apiCall(page, "POST", "/api/v1/coupons", {
        code,
        name: "E2E Fixed Amount Coupon",
        type: "fixed_amount",
        value: 50000, // 500.00 in paise
        currency: "INR",
        appliesTo: "invoice",
        maxRedemptions: 50,
        minAmount: 100000, // min 1000.00
        validFrom: new Date().toISOString(),
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.json)}`);
      }
      if (!res.json.data?.id) throw new Error("No coupon ID returned");

      fixedCouponId = res.json.data.id;
    } finally {
      await page.close();
    }
  });

  // 4. Coupon detail page shows redemptions section
  await test("Coupon detail page shows redemptions section", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      if (!percentageCouponId) throw new Error("No coupon ID from previous test");

      await page.goto(`${BASE_URL}/coupons/${percentageCouponId}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Should show "Coupon Details" section
      const detailsHeading = await page.waitForSelector("text=Coupon Details", { timeout: 10000 });
      if (!detailsHeading) throw new Error("Coupon Details heading not found");

      // Should show "Redemption History" section
      const redemptionHeading = await page.waitForSelector("text=Redemption History", {
        timeout: 10000,
      });
      if (!redemptionHeading) throw new Error("Redemption History heading not found");
    } finally {
      await page.close();
    }
  });

  // 5. Edit coupon — change from limited to unlimited redemptions (bug #4)
  await test("Edit coupon - change from limited to unlimited redemptions (bug #4)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      if (!percentageCouponId) throw new Error("No coupon ID from previous test");

      // Update via API: set maxRedemptions to null (unlimited)
      const res = await apiCall(page, "PUT", `/api/v1/coupons/${percentageCouponId}`, {
        maxRedemptions: null,
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
      }

      // Verify the update took effect
      const getRes = await apiCall(page, "GET", `/api/v1/coupons/${percentageCouponId}`);
      const coupon = getRes.json.data;

      if (coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined) {
        throw new Error(
          `Expected maxRedemptions to be null/undefined, got: ${coupon.maxRedemptions}`,
        );
      }
    } finally {
      await page.close();
    }
  });

  // 6. Create coupon with blank maxRedemptionsPerClient (bug #5)
  await test("Create coupon with blank maxRedemptionsPerClient (bug #5)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      const code = `E2EBLK${Date.now().toString(36).toUpperCase()}`;

      // Omit maxRedemptionsPerClient entirely (simulates blank field)
      const res = await apiCall(page, "POST", "/api/v1/coupons", {
        code,
        name: "E2E Blank Per-Client Limit",
        type: "percentage",
        value: 10,
        appliesTo: "invoice",
        minAmount: 0,
        validFrom: new Date().toISOString(),
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.json)}`);
      }

      const coupon = res.json.data;
      if (coupon.maxRedemptionsPerClient !== null && coupon.maxRedemptionsPerClient !== undefined) {
        throw new Error(
          `Expected maxRedemptionsPerClient null/undefined, got: ${coupon.maxRedemptionsPerClient}`,
        );
      }

      // Clean up
      await apiCall(page, "DELETE", `/api/v1/coupons/${coupon.id}`);
    } finally {
      await page.close();
    }
  });

  // 7. Validate coupon code via API (bug #6)
  await test("Validate coupon code via API (bug #6)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      if (!percentageCouponCode) throw new Error("No coupon code from previous test");

      const res = await apiCall(page, "POST", "/api/v1/coupons/validate", {
        code: percentageCouponCode,
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
      }

      if (!res.json.data) {
        throw new Error("Validate response missing data");
      }
    } finally {
      await page.close();
    }
  });

  // 8. Deactivate coupon
  await test("Deactivate coupon", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      if (!fixedCouponId) throw new Error("No fixed coupon ID from previous test");

      const res = await apiCall(page, "DELETE", `/api/v1/coupons/${fixedCouponId}`);

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
      }
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  DUNNING TESTS
  // =========================================================================
  console.log("\n--- Dunning Tests ---");

  // 9. Dunning page loads with stats cards
  await test("Dunning page loads with stats cards", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/dunning`, { waitUntil: "networkidle", timeout: 30000 });

      // Check page heading
      const heading = await page.waitForSelector("text=Dunning Management", { timeout: 10000 });
      if (!heading) throw new Error("Dunning Management heading not found");

      // Should have stats cards: Pending Retries, Failed This Month, Recovered Amount
      const expectedCards = ["Pending Retries", "Failed This Month", "Recovered Amount"];
      for (const label of expectedCards) {
        const el = await page.waitForSelector(`text=${label}`, { timeout: 10000 });
        if (!el) throw new Error(`Stats card "${label}" not found`);
      }
    } finally {
      await page.close();
    }
  });

  // 10. Dunning attempts table loads with pagination
  await test("Dunning attempts table loads with pagination", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/dunning`, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for the page to settle
      await page.waitForTimeout(2000);

      // Should have either the attempts table or "No dunning attempts" empty state
      const table = await page.$("table");
      const emptyState = await page.$("text=No dunning attempts");

      if (!table && !emptyState) {
        throw new Error("Neither dunning attempts table nor empty state found");
      }
    } finally {
      await page.close();
    }
  });

  // 11. Status filter works (pending/success/failed)
  await test("Dunning status filter works (pending/success/failed)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/dunning`, { waitUntil: "networkidle", timeout: 30000 });

      // Verify the status filter dropdown exists
      const filterLabel = await page.waitForSelector("text=Status:", { timeout: 10000 });
      if (!filterLabel) throw new Error("Status filter label not found");

      // The select should have options: All, Pending, Success, Failed, Skipped
      const select = await page.$("select");
      if (!select) throw new Error("Status filter select not found");

      // Select "pending" and verify no error
      await select.selectOption("pending");
      await page.waitForTimeout(1500);

      // Select "failed" and verify no error
      await select.selectOption("failed");
      await page.waitForTimeout(1500);

      // Select "success" and verify no error
      await select.selectOption("success");
      await page.waitForTimeout(1500);

      // Reset to "All"
      await select.selectOption("");
      await page.waitForTimeout(1000);
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  DISPUTE TESTS
  // =========================================================================
  console.log("\n--- Dispute Tests ---");

  // 12. Dispute list page loads
  await test("Dispute list page loads", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });

      // Check page heading
      const heading = await page.waitForSelector("text=Disputes", { timeout: 10000 });
      if (!heading) throw new Error("Disputes heading not found");

      // Should have filter buttons: All, Open, Under Review, Resolved, Closed
      const filterButtons = ["All", "Open", "Under Review", "Resolved", "Closed"];
      for (const label of filterButtons) {
        const btn = await page.$(`button:has-text("${label}")`);
        if (!btn) throw new Error(`Filter button "${label}" not found`);
      }
    } finally {
      await page.close();
    }
  });

  // 13. Dispute status filter works
  await test("Dispute status filter works", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });

      // Click "Open" filter
      await page.click('button:has-text("Open")');
      await page.waitForTimeout(1500);

      // Click "Resolved" filter
      await page.click('button:has-text("Resolved")');
      await page.waitForTimeout(1500);

      // Click "All" to reset
      await page.click('button:has-text("All")');
      await page.waitForTimeout(1000);

      // Page should still have the disputes heading (no crash)
      const heading = await page.$("text=Disputes");
      if (!heading) throw new Error("Disputes heading lost after filtering");
    } finally {
      await page.close();
    }
  });

  // 14. Dispute detail page loads
  await test("Dispute detail page loads", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // First, get a dispute ID from the API
      const listRes = await apiCall(page, "GET", "/api/v1/disputes?page=1&limit=5");

      if (listRes.status !== 200) {
        throw new Error(`List disputes returned ${listRes.status}: ${JSON.stringify(listRes.json)}`);
      }

      const disputes = listRes.json.data ?? [];

      if (disputes.length === 0) {
        // No disputes exist — verify the empty state on list page at least
        await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });
        const emptyState = await page.waitForSelector("text=No disputes found", { timeout: 10000 });
        if (!emptyState) throw new Error("Expected empty state message");
        return; // Skip detail page test if no disputes
      }

      firstDisputeId = disputes[0].id;

      await page.goto(`${BASE_URL}/disputes/${firstDisputeId}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Should show "Dispute Detail" heading
      const heading = await page.waitForSelector("text=Dispute Detail", { timeout: 10000 });
      if (!heading) throw new Error("Dispute Detail heading not found");

      // Should show "Admin Actions" section
      const adminSection = await page.waitForSelector("text=Admin Actions", { timeout: 10000 });
      if (!adminSection) throw new Error("Admin Actions section not found");
    } finally {
      await page.close();
    }
  });

  // 15. Update dispute status and resolution
  await test("Update dispute status and resolution", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // Use previously found dispute or fetch one
      if (!firstDisputeId) {
        const listRes = await apiCall(page, "GET", "/api/v1/disputes?page=1&limit=5");
        const disputes = listRes.json.data ?? [];
        if (disputes.length === 0) {
          // No disputes to update — skip gracefully
          console.log("         (skipped: no disputes available)");
          return;
        }
        firstDisputeId = disputes[0].id;
      }

      // Update via API
      const res = await apiCall(page, "PUT", `/api/v1/disputes/${firstDisputeId}`, {
        status: "under_review",
        resolution: "E2E test resolution",
        adminNotes: "Updated by E2E test suite",
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
      }

      // Verify the update
      const getRes = await apiCall(page, "GET", `/api/v1/disputes/${firstDisputeId}`);
      const dispute = getRes.json.data;

      if (dispute.status !== "under_review") {
        throw new Error(`Expected status "under_review", got: ${dispute.status}`);
      }
      if (dispute.resolution !== "E2E test resolution") {
        throw new Error(`Expected resolution "E2E test resolution", got: ${dispute.resolution}`);
      }
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  USAGE (METERED BILLING) TESTS
  // =========================================================================
  console.log("\n--- Usage (Metered Billing) Tests ---");

  // 16. Usage dashboard page loads
  await test("Usage dashboard page loads", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/usage`, { waitUntil: "networkidle", timeout: 30000 });

      // Should have the "Usage Records" heading
      const heading = await page.waitForSelector("text=Usage Records", { timeout: 10000 });
      if (!heading) throw new Error("Usage Records heading not found");

      // Should have the "Record Usage" button
      const recordBtn = await page.$('button:has-text("Record Usage")');
      if (!recordBtn) throw new Error("Record Usage button not found");
    } finally {
      await page.close();
    }
  });

  // 17. Record usage entry succeeds (use API)
  await test("Record usage entry succeeds via API", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // Get a product and client to use
      const productsRes = await apiCall(page, "GET", "/api/v1/products?limit=50");
      const clientsRes = await apiCall(page, "GET", "/api/v1/clients?limit=10");

      const products = productsRes.json.data ?? [];
      const clients = clientsRes.json.data ?? [];

      if (products.length === 0) throw new Error("No products found — cannot record usage");
      if (clients.length === 0) throw new Error("No clients found — cannot record usage");

      // Prefer a metered product, fall back to any product
      const meteredProduct = products.find((p: any) => p.pricingModel === "metered");
      const productId = meteredProduct?.id ?? products[0].id;
      const clientId = clients[0].id;

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const res = await apiCall(page, "POST", "/api/v1/usage", {
        productId,
        clientId,
        quantity: 42,
        description: "E2E test usage entry",
        periodStart,
        periodEnd,
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.json)}`);
      }

      if (!res.json.data?.id) throw new Error("No usage record ID returned");
    } finally {
      await page.close();
    }
  });

  // 18. Usage records table shows entries
  await test("Usage records table shows entries", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/usage`, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for data to load
      await page.waitForTimeout(2000);

      // Should have either a table with records or the empty state
      const table = await page.$("table");
      const emptyState = await page.$("text=No usage records yet");
      const filteredEmpty = await page.$("text=No usage records match your filters");

      if (!table && !emptyState && !filteredEmpty) {
        throw new Error("Neither usage records table nor empty state found");
      }

      // If there is a table, verify it has column headers
      if (table) {
        const productHeader = await page.$("th:has-text('Product')");
        const clientHeader = await page.$("th:has-text('Client')");
        const quantityHeader = await page.$("th:has-text('Quantity')");
        if (!productHeader) throw new Error("Product column header not found");
        if (!clientHeader) throw new Error("Client column header not found");
        if (!quantityHeader) throw new Error("Quantity column header not found");
      }
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  SAAS METRICS TESTS
  // =========================================================================
  console.log("\n--- SaaS Metrics Tests ---");

  // 19. Metrics page loads with MRR, ARR, Churn, LTV cards
  await test("Metrics page loads with MRR, ARR, Churn, LTV cards", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

      // Check page heading
      const heading = await page.waitForSelector("text=SaaS Metrics", { timeout: 10000 });
      if (!heading) throw new Error("SaaS Metrics heading not found");

      // Wait for metrics cards to load (they make multiple API calls)
      await page.waitForTimeout(3000);

      // Verify key metric labels exist
      const expectedLabels = ["MRR", "ARR", "Customer Churn", "Average LTV"];
      for (const label of expectedLabels) {
        const el = await page.$(`text=${label}`);
        if (!el) throw new Error(`Metric card "${label}" not found`);
      }
    } finally {
      await page.close();
    }
  });

  // 20. Revenue breakdown chart renders
  await test("Revenue breakdown chart renders", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for chart to render
      await page.waitForTimeout(3000);

      // Should have the "MRR Revenue Breakdown" heading
      const chartHeading = await page.waitForSelector("text=MRR Revenue Breakdown", {
        timeout: 10000,
      });
      if (!chartHeading) throw new Error("MRR Revenue Breakdown heading not found");

      // Should have either a Recharts SVG or a "No revenue breakdown data" message
      const chartSvg = await page.$(".recharts-responsive-container svg");
      const noData = await page.$("text=No revenue breakdown data available");

      if (!chartSvg && !noData) {
        throw new Error("Neither revenue breakdown chart nor empty-state message found");
      }
    } finally {
      await page.close();
    }
  });

  // 21. Subscription stats display
  await test("Subscription stats display", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for subscription funnel to load
      await page.waitForTimeout(3000);

      // Should have "Subscription Funnel" heading
      const funnelHeading = await page.waitForSelector("text=Subscription Funnel", {
        timeout: 10000,
      });
      if (!funnelHeading) throw new Error("Subscription Funnel heading not found");

      // Should have subscription stat cards: Trialing, Active, Past Due
      const expectedStats = ["Trialing", "Active", "Past Due"];
      for (const label of expectedStats) {
        const el = await page.$(`text=${label}`);
        if (!el) throw new Error(`Subscription stat "${label}" not found`);
      }

      // Should also show "Trial to Active" conversion rate
      const conversionLabel = await page.$("text=Trial to Active");
      if (!conversionLabel) throw new Error("Trial to Active conversion metric not found");
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  Cleanup & Summary
  // =========================================================================

  // Clean up the percentage coupon we created
  if (percentageCouponId) {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);
      await apiCall(page, "DELETE", `/api/v1/coupons/${percentageCouponId}`);
    } catch {
      // Best-effort cleanup
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  printSummary();

  // Exit with non-zero if any test failed
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
})();
