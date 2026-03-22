/**
 * E2E Tests — Auth & Dashboard
 *
 * Run:  npx tsx scripts/e2e/auth-dashboard.test.ts
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

/** Login via the UI form. Returns the access token stored in localStorage. */
async function loginViaUI(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await handleNgrokInterstitial(page);

  // Fill credentials
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  // Grab the token from localStorage
  const token = await page.evaluate(() => localStorage.getItem("access_token"));
  if (!token) throw new Error("No access_token found in localStorage after login");
  storedToken = token;
  return token;
}

/** Login via API (fast). Sets the token in localStorage and navigates to dashboard. */
async function loginViaAPI(page: Page): Promise<string> {
  if (storedToken) {
    // Reuse previously obtained token
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await handleNgrokInterstitial(page);
    await page.evaluate((t) => localStorage.setItem("access_token", t), storedToken);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
    return storedToken;
  }

  // First time — get token via API call from page context
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\nEMP-Billing E2E Tests — Auth & Dashboard`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // =========================================================================
  //  AUTH TESTS
  // =========================================================================
  console.log("--- Auth Tests ---");

  // 1. Login page loads with email/password fields
  await test("Login page loads with email/password fields", async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
      await handleNgrokInterstitial(page);

      const emailInput = await page.$('input[type="email"]');
      const passwordInput = await page.$('input[type="password"]');
      const submitBtn = await page.$('button[type="submit"]');

      if (!emailInput) throw new Error("Email input not found");
      if (!passwordInput) throw new Error("Password input not found");
      if (!submitBtn) throw new Error("Submit button not found");
    } finally {
      await page.close();
    }
  });

  // 2. Login with valid credentials redirects to /dashboard
  await test("Login with valid credentials redirects to /dashboard", async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
      await handleNgrokInterstitial(page);

      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForURL("**/dashboard", { timeout: 15000 });

      const url = page.url();
      if (!url.includes("/dashboard")) {
        throw new Error(`Expected /dashboard in URL, got: ${url}`);
      }

      // Store token for later reuse
      const token = await page.evaluate(() => localStorage.getItem("access_token"));
      if (token) storedToken = token;
    } finally {
      await page.close();
    }
  });

  // 3. Login with invalid credentials shows error
  await test("Login with invalid credentials shows error", async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
      await handleNgrokInterstitial(page);

      await page.fill('input[type="email"]', "wrong@test.com");
      await page.fill('input[type="password"]', "WrongPassword1");
      await page.click('button[type="submit"]');

      // Wait for error message to appear
      const errorEl = await page.waitForSelector("text=Invalid email or password", {
        timeout: 10000,
      });
      if (!errorEl) throw new Error("Error message not displayed");
    } finally {
      await page.close();
    }
  });

  // 4. Register page loads with all required fields
  await test("Register page loads with all required fields", async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle", timeout: 30000 });
      await handleNgrokInterstitial(page);

      const heading = await page.textContent("h1");
      if (!heading || !heading.includes("Create account")) {
        throw new Error(`Expected 'Create account' heading, got: ${heading}`);
      }

      // Check for required fields: first name, last name, email, org name, password
      const inputs = await page.$$("input");
      if (inputs.length < 5) {
        throw new Error(`Expected at least 5 inputs, found ${inputs.length}`);
      }

      const emailInput = await page.$('input[type="email"]');
      const passwordInput = await page.$('input[type="password"]');
      if (!emailInput) throw new Error("Email input not found");
      if (!passwordInput) throw new Error("Password input not found");
    } finally {
      await page.close();
    }
  });

  // 5. Forgot password page loads and accepts email
  await test("Forgot password page loads and accepts email", async () => {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/forgot-password`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await handleNgrokInterstitial(page);

      const heading = await page.textContent("h1");
      if (!heading || !heading.includes("Forgot password")) {
        throw new Error(`Expected 'Forgot password' heading, got: ${heading}`);
      }

      const emailInput = await page.$('input[type="email"]');
      if (!emailInput) throw new Error("Email input not found");

      // Submit the form
      await page.fill('input[type="email"]', "test@example.com");
      await page.click('button[type="submit"]');

      // Should show confirmation message
      const confirmation = await page.waitForSelector("text=Check your email", {
        timeout: 10000,
      });
      if (!confirmation) throw new Error("Confirmation message not shown");
    } finally {
      await page.close();
    }
  });

  // 6. Logout works (clear token, redirect to login)
  await test("Logout works (clear token, redirect to login)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // Verify we are on dashboard
      const url = page.url();
      if (!url.includes("/dashboard")) {
        throw new Error(`Expected /dashboard, got: ${url}`);
      }

      // Click the Logout button in the sidebar
      const logoutBtn = await page.waitForSelector("button:has-text('Logout')", {
        timeout: 5000,
      });
      if (!logoutBtn) throw new Error("Logout button not found");
      await logoutBtn.click();

      // Should redirect to login
      await page.waitForURL("**/login", { timeout: 10000 });

      const afterUrl = page.url();
      if (!afterUrl.includes("/login")) {
        throw new Error(`Expected /login after logout, got: ${afterUrl}`);
      }

      // Token should be cleared
      const token = await page.evaluate(() => localStorage.getItem("access_token"));
      if (token) throw new Error("access_token still in localStorage after logout");
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  DASHBOARD TESTS
  // =========================================================================
  console.log("\n--- Dashboard Tests ---");

  // 7. Dashboard loads with 4 stat cards
  await test("Dashboard loads with 4 stat cards (Revenue, Outstanding, Overdue, Expenses)", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // The stat cards contain these labels
      const expectedLabels = ["Total Revenue", "Outstanding", "Overdue", "Expenses"];
      for (const label of expectedLabels) {
        const el = await page.$(`text=${label}`);
        if (!el) throw new Error(`Stat card "${label}" not found`);
      }
    } finally {
      await page.close();
    }
  });

  // 8. Dashboard shows revenue chart
  await test("Dashboard shows revenue chart", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      // Look for "Revenue by Month" heading
      const chartHeading = await page.waitForSelector("text=Revenue by Month", {
        timeout: 10000,
      });
      if (!chartHeading) throw new Error("Revenue chart heading not found");

      // Check for Recharts SVG container (rendered chart or empty-state message)
      const chartSvg = await page.$(".recharts-responsive-container svg");
      const noData = await page.$("text=No revenue data available");
      if (!chartSvg && !noData) {
        throw new Error("Neither chart SVG nor empty-state message found");
      }
    } finally {
      await page.close();
    }
  });

  // 9. Dashboard shows recent invoices list
  await test("Dashboard shows recent invoices list", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      const heading = await page.waitForSelector("text=Recent Invoices", { timeout: 10000 });
      if (!heading) throw new Error("Recent Invoices section not found");

      // Either invoice rows or "No invoices yet" message
      const invoiceRow = await page.$('a[href*="/invoices/"]');
      const emptyMsg = await page.$("text=No invoices yet");
      if (!invoiceRow && !emptyMsg) {
        throw new Error("Neither invoice rows nor empty message found");
      }
    } finally {
      await page.close();
    }
  });

  // 10. Dashboard shows recent payments list
  await test("Dashboard shows recent payments list", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      const heading = await page.waitForSelector("text=Recent Payments", { timeout: 10000 });
      if (!heading) throw new Error("Recent Payments section not found");

      // Either payment rows or empty message
      const viewAll = await page.$('a[href="/payments"]:has-text("View all")');
      const emptyMsg = await page.$("text=No payments yet");
      if (!viewAll && !emptyMsg) {
        throw new Error("Neither payment View all link nor empty message found");
      }
    } finally {
      await page.close();
    }
  });

  // 11. "New Invoice" quick action button exists and navigates correctly
  await test("New Invoice quick action button exists and navigates correctly", async () => {
    const page = await context.newPage();
    try {
      await loginViaAPI(page);

      const newInvoiceBtn = await page.waitForSelector('a[href="/invoices/new"]', {
        timeout: 10000,
      });
      if (!newInvoiceBtn) throw new Error("New Invoice button not found");

      // Verify button text
      const text = await newInvoiceBtn.textContent();
      if (!text || !text.includes("New Invoice")) {
        throw new Error(`Expected button text to contain "New Invoice", got: "${text}"`);
      }

      // Click and verify navigation
      await newInvoiceBtn.click();
      await page.waitForURL("**/invoices/new", { timeout: 10000 });

      const url = page.url();
      if (!url.includes("/invoices/new")) {
        throw new Error(`Expected /invoices/new, got: ${url}`);
      }
    } finally {
      await page.close();
    }
  });

  // =========================================================================
  //  Summary
  // =========================================================================
  await context.close();
  await browser.close();

  printSummary();

  // Exit with non-zero if any test failed
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
})();
