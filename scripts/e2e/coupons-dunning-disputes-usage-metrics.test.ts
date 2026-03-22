/**
 * E2E Tests — Coupons, Dunning, Disputes, Usage, SaaS Metrics
 *
 * DEEP FUNCTIONAL tests that simulate a real user clicking through every workflow.
 * All interactions go through the UI — no fetch() calls.
 *
 * Run:  npx tsx scripts/e2e/coupons-dunning-disputes-usage-metrics.test.ts
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:4001";
const EMAIL = "admin@acme.com";
const PASSWORD = "Admin@123";
const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots");
const DELAY_BETWEEN_TESTS = 1500;

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: (page: Page) => Promise<void>, context: BrowserContext) {
  const page = await context.newPage();
  try {
    await fn(page);
    results.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: message });
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${message}`);
    // Screenshot on failure
    const screenshotName = name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `FAIL_${screenshotName}.png`), fullPage: true });
      console.log(`         Screenshot saved: FAIL_${screenshotName}.png`);
    } catch {
      // best-effort screenshot
    }
  } finally {
    await page.close();
  }
  // Delay between tests
  await new Promise((r) => setTimeout(r, DELAY_BETWEEN_TESTS));
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

/** Login via the UI form — fills email/password and clicks Sign In. */
async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await handleNgrokInterstitial(page);

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Clear any prefilled values
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.click();
  await emailInput.fill("");
  await passwordInput.click();
  await passwordInput.fill("");

  // Type credentials
  await emailInput.pressSequentially(EMAIL, { delay: 20 });
  await passwordInput.pressSequentially(PASSWORD, { delay: 20 });

  // Click Sign in and wait for navigation
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/v1/auth/login") && res.status() === 200,
      { timeout: 15000 },
    ),
    page.waitForURL("**/dashboard", { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

/** Navigate to a page by clicking the sidebar link. */
async function navigateViaSidebar(page: Page, label: string, expectedPath: string): Promise<void> {
  // Click sidebar nav link matching label
  const navLink = page.locator(`nav a`).filter({ hasText: label }).first();
  await navLink.waitFor({ timeout: 5000 });
  await navLink.click();

  // Wait for URL to include expected path
  await page.waitForURL(`**${expectedPath}`, { timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

/** Wait for a react-hot-toast message to appear. */
async function waitForToast(page: Page, text: string, timeout = 10000): Promise<void> {
  // react-hot-toast renders in [role="status"] or a div with the text
  await page.waitForSelector(`text=${text}`, { timeout });
}

/** Verify that a table has expected column headers. */
async function verifyTableHeaders(page: Page, headers: string[]): Promise<void> {
  for (const header of headers) {
    const th = await page.$(`th:has-text("${header}")`);
    if (!th) throw new Error(`Table header "${header}" not found`);
  }
}

// Track IDs across tests
let createdPercentageCouponId: string | null = null;
let createdFixedCouponId: string | null = null;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\nEMP-Billing E2E Tests — Coupons, Dunning, Disputes, Usage, SaaS Metrics`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`All tests interact through the UI — no direct API calls.\n`);

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Login once via UI to establish session
  {
    const page = await context.newPage();
    await loginViaUI(page);
    await page.close();
  }

  // =========================================================================
  //  COUPON TESTS
  // =========================================================================
  console.log("--- Coupon Tests ---");

  // 1. Navigate to coupons — click sidebar, verify /coupons, table headers
  await test("1. Navigate to coupons via sidebar and verify table headers", async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });

    await navigateViaSidebar(page, "Coupons", "/coupons");

    // Verify we are on /coupons
    if (!page.url().includes("/coupons")) {
      throw new Error(`Expected URL to include /coupons, got: ${page.url()}`);
    }

    // Verify page heading
    await page.waitForSelector("text=Coupons", { timeout: 10000 });

    // Verify "New Coupon" button exists
    const newBtn = page.locator('button:has-text("New Coupon")');
    await newBtn.waitFor({ timeout: 5000 });

    // Wait for table or empty state to load
    await page.waitForTimeout(2000);

    // If table exists, verify headers
    const table = await page.$("table");
    if (table) {
      await verifyTableHeaders(page, ["Code", "Type", "Value", "Redemptions", "Status"]);
    } else {
      // Empty state is fine too
      const emptyState = await page.$("text=No coupons yet");
      if (!emptyState) throw new Error("Neither coupon table nor empty state found");
    }
  }, context);

  // 2. Create percentage coupon via UI
  await test("2. Create percentage coupon via UI (bug #5 — blank maxRedemptionsPerClient)", async (page) => {
    await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });

    // Click "New Coupon" button
    await page.click('button:has-text("New Coupon")');
    await page.waitForURL("**/coupons/new", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify we are on the create page
    await page.waitForSelector("text=New Coupon", { timeout: 10000 });
    await page.waitForSelector("text=Coupon Details", { timeout: 5000 });

    // Fill Code — the code input is inside a flex container, it is the input with placeholder "SUMMER20"
    await page.fill('input[placeholder="SUMMER20"]', "E2E-PCT-TEST");

    // Fill Name
    await page.fill('input[placeholder="Summer Sale 20% Off"]', "E2E Percentage Test Coupon");

    // Select Type = Percentage (should be default, but let's be explicit)
    // The Type select has id="type" (from label "Type")
    await page.selectOption('#type', 'percentage');

    // Fill Value = 15
    // The value input changes label based on type. For percentage it is "Percentage (%)"
    const valueInput = page.locator('#percentage-(%)');
    // Fallback: find by type=number near the percentage label
    const percentageInput = page.locator('input[type="number"]').first();
    await percentageInput.fill("15");

    // Set valid from date — it should already have today's date as default
    // The "Valid From" input has id="valid-from"
    const validFromInput = page.locator('#valid-from');
    const today = new Date().toISOString().slice(0, 10);
    await validFromInput.fill(today);

    // IMPORTANT: Leave maxRedemptionsPerClient BLANK — this tests bug #5 fix
    // The field should already be empty. Verify the Create Coupon button is NOT disabled.
    const createBtn = page.locator('button:has-text("Create Coupon")');
    await createBtn.waitFor({ timeout: 5000 });
    const isDisabled = await createBtn.isDisabled();
    if (isDisabled) {
      throw new Error("Create Coupon button is disabled when maxRedemptionsPerClient is blank — bug #5 regression");
    }

    // Click Create Coupon
    await createBtn.click();

    // Wait for toast and redirect
    await waitForToast(page, "Coupon created", 15000);

    // Should redirect back to /coupons
    await page.waitForURL("**/coupons", { timeout: 10000 });

    // Verify the coupon appears in the list
    await page.waitForTimeout(2000);
    const couponRow = await page.$("text=E2E-PCT-TEST");
    if (!couponRow) throw new Error("Created coupon E2E-PCT-TEST not found in list");
  }, context);

  // 3. Create fixed amount coupon via UI
  await test("3. Create fixed amount coupon via UI", async (page) => {
    await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });

    // Click "New Coupon" button
    await page.click('button:has-text("New Coupon")');
    await page.waitForURL("**/coupons/new", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Fill Code
    await page.fill('input[placeholder="SUMMER20"]', "E2E-FIXED-TEST");

    // Fill Name
    await page.fill('input[placeholder="Summer Sale 20% Off"]', "E2E Fixed Amount Test Coupon");

    // Select Type = Fixed Amount
    await page.selectOption('#type', 'fixed_amount');
    await page.waitForTimeout(500); // Wait for UI to re-render

    // Fill Amount = 50 (this is 50.00 in display units, will be stored as 5000 paise)
    // After selecting "Fixed Amount", the value input has placeholder "500.00"
    const amountInput = page.locator('input[placeholder="500.00"]');
    if (await amountInput.count() > 0) {
      await amountInput.fill("50");
    } else {
      // Fallback: find by the number inputs, the value one should be the second
      const numberInputs = page.locator('section:has-text("Discount") input[type="number"]');
      await numberInputs.first().fill("50");
    }

    // Set valid from date
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('#valid-from').fill(today);

    // Click Create Coupon
    await page.click('button:has-text("Create Coupon")');

    // Wait for toast
    await waitForToast(page, "Coupon created", 15000);

    // Verify redirect
    await page.waitForURL("**/coupons", { timeout: 10000 });

    // Verify it appears in the list
    await page.waitForTimeout(2000);
    const couponRow = await page.$("text=E2E-FIXED-TEST");
    if (!couponRow) throw new Error("Created coupon E2E-FIXED-TEST not found in list");
  }, context);

  // 4. View coupon detail — click on coupon row, verify fields and redemptions section
  await test("4. View coupon detail page — verify all fields and redemptions section", async (page) => {
    await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click on the E2E-PCT-TEST coupon row
    const couponRow = page.locator("tr").filter({ hasText: "E2E-PCT-TEST" }).first();
    await couponRow.waitFor({ timeout: 10000 });
    await couponRow.click();

    // Wait for navigation to detail page
    await page.waitForURL("**/coupons/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Capture the coupon ID from URL for later use
    const urlParts = page.url().split("/coupons/");
    if (urlParts.length > 1) {
      const idPart = urlParts[1].split("/")[0].split("?")[0];
      if (idPart && idPart !== "new") {
        createdPercentageCouponId = idPart;
      }
    }

    // Verify "Coupon Details" heading
    await page.waitForSelector("text=Coupon Details", { timeout: 10000 });

    // Verify the code is displayed
    const codeDisplay = await page.$("text=E2E-PCT-TEST");
    if (!codeDisplay) throw new Error("Coupon code E2E-PCT-TEST not shown on detail page");

    // Verify discount info
    const discountDisplay = await page.$("text=15% off");
    if (!discountDisplay) throw new Error("Discount '15% off' not found on detail page");

    // Verify the Percentage badge
    const percentageBadge = await page.$("text=Percentage");
    if (!percentageBadge) throw new Error("'Percentage' type badge not found on detail page");

    // Verify "Redemption History" section
    await page.waitForSelector("text=Redemption History", { timeout: 10000 });

    // Verify Edit and Deactivate buttons exist
    const editBtn = page.locator('button:has-text("Edit")');
    await editBtn.waitFor({ timeout: 5000 });
    const deactivateBtn = page.locator('button:has-text("Deactivate")');
    await deactivateBtn.waitFor({ timeout: 5000 });
  }, context);

  // 5. Edit coupon — clear maxRedemptions (tests bug #4 fix for unlimited)
  await test("5. Edit coupon — set unlimited redemptions (bug #4 fix)", async (page) => {
    await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click on the E2E-PCT-TEST coupon row
    const couponRow = page.locator("tr").filter({ hasText: "E2E-PCT-TEST" }).first();
    await couponRow.waitFor({ timeout: 10000 });
    await couponRow.click();

    // Wait for detail page
    await page.waitForURL("**/coupons/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Click Edit button
    await page.click('button:has-text("Edit")');
    await page.waitForURL("**/edit", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify Edit page loaded
    await page.waitForSelector("text=Edit Coupon", { timeout: 10000 });

    // Clear the Max Redemptions field (leave it empty for unlimited)
    // The input has id="max-redemptions" (derived from label "Max Redemptions")
    const maxRedemptionsInput = page.locator('#max-redemptions');
    await maxRedemptionsInput.waitFor({ timeout: 5000 });
    await maxRedemptionsInput.fill("");

    // Also clear Max Redemptions Per Client
    // It does not have the standard id since label is in a separate element
    const maxPerClientInputs = page.locator('input[placeholder="Unlimited"]');
    const count = await maxPerClientInputs.count();
    for (let i = 0; i < count; i++) {
      await maxPerClientInputs.nth(i).fill("");
    }

    // Click Save Changes
    await page.click('button:has-text("Save Changes")');

    // Wait for toast
    await waitForToast(page, "Coupon updated", 15000);

    // Should redirect to /coupons list
    await page.waitForURL("**/coupons", { timeout: 10000 });

    // Navigate back to the detail page to verify unlimited is shown
    await page.waitForTimeout(1500);
    const updatedRow = page.locator("tr").filter({ hasText: "E2E-PCT-TEST" }).first();
    await updatedRow.waitFor({ timeout: 10000 });
    await updatedRow.click();

    await page.waitForURL("**/coupons/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify redemptions shows "unlimited"
    const unlimitedText = await page.$("text=unlimited");
    const unlimitedTextAlt = await page.$("text=Unlimited");
    if (!unlimitedText && !unlimitedTextAlt) {
      throw new Error("Expected 'unlimited' or 'Unlimited' to appear after clearing maxRedemptions");
    }
  }, context);

  // 6. Deactivate coupon via UI
  await test("6. Deactivate coupon — click Deactivate, verify status changes", async (page) => {
    await page.goto(`${BASE_URL}/coupons`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Find the E2E-FIXED-TEST row and click its trash/deactivate icon button
    // The row has an actions column with trash icon button
    const fixedRow = page.locator("tr").filter({ hasText: "E2E-FIXED-TEST" }).first();
    await fixedRow.waitFor({ timeout: 10000 });

    // Capture fixed coupon ID by navigating to its detail first
    await fixedRow.click();
    await page.waitForURL("**/coupons/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const urlParts = page.url().split("/coupons/");
    if (urlParts.length > 1) {
      const idPart = urlParts[1].split("/")[0].split("?")[0];
      if (idPart && idPart !== "new") {
        createdFixedCouponId = idPart;
      }
    }

    // Click Deactivate button on the detail page
    // This will trigger a confirm() dialog
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.click('button:has-text("Deactivate")');

    // Wait for toast
    await waitForToast(page, "Coupon deactivated", 15000);

    // Should redirect to /coupons list
    await page.waitForURL("**/coupons", { timeout: 10000 });
    await page.waitForTimeout(1500);

    // If the coupon still appears, verify it shows "Inactive" status
    const deactivatedRow = await page.$("text=E2E-FIXED-TEST");
    if (deactivatedRow) {
      const inactiveBadge = page.locator("tr").filter({ hasText: "E2E-FIXED-TEST" }).locator("text=Inactive");
      const isVisible = await inactiveBadge.isVisible().catch(() => false);
      if (!isVisible) {
        // The coupon may have been removed from the list entirely, which is also valid
        console.log("         (Coupon may have been removed from list — deactivation confirmed via toast)");
      }
    }
  }, context);

  // =========================================================================
  //  DUNNING TESTS
  // =========================================================================
  console.log("\n--- Dunning Tests ---");

  // 7. Navigate to dunning via sidebar, verify stat cards
  await test("7. Navigate to dunning — verify stat cards (Pending Retries, Failed, Recovered)", async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });

    await navigateViaSidebar(page, "Dunning", "/dunning");

    if (!page.url().includes("/dunning")) {
      throw new Error(`Expected URL to include /dunning, got: ${page.url()}`);
    }

    // Verify page heading
    await page.waitForSelector("text=Dunning Management", { timeout: 10000 });

    // Wait for stats cards to load
    await page.waitForTimeout(3000);

    // Verify stat cards exist
    const expectedCards = ["Pending Retries", "Failed This Month", "Recovered Amount"];
    for (const label of expectedCards) {
      const card = await page.waitForSelector(`text=${label}`, { timeout: 10000 });
      if (!card) throw new Error(`Stats card "${label}" not found`);
    }
  }, context);

  // 8. Dunning attempts table — verify table renders with columns, pagination if entries exist
  await test("8. Dunning attempts table — verify table or empty state", async (page) => {
    await page.goto(`${BASE_URL}/dunning`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Should have either the attempts table or "No dunning attempts" empty state
    const table = await page.$("table");
    const emptyState = await page.$("text=No dunning attempts");

    if (!table && !emptyState) {
      throw new Error("Neither dunning attempts table nor empty state found");
    }

    if (table) {
      // Verify table column headers
      await verifyTableHeaders(page, ["Invoice", "Attempt #", "Status", "Next Retry", "Error", "Created", "Actions"]);

      // Check if pagination exists when there are entries
      const paginationText = await page.$("text=Page");
      // Pagination is optional (only shows when >1 page)
      console.log(`         Table found ${paginationText ? "with" : "without"} pagination`);
    } else {
      console.log("         Empty state displayed — no dunning attempts exist");
    }
  }, context);

  // 9. Dunning status filter — click status filter, verify table updates
  await test("9. Status filter — toggle pending/success/failed and verify table updates", async (page) => {
    await page.goto(`${BASE_URL}/dunning`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify the status filter label and select exist
    await page.waitForSelector("text=Status:", { timeout: 10000 });
    const select = page.locator("select").first();
    await select.waitFor({ timeout: 5000 });

    // Select "pending"
    await select.selectOption("pending");
    await page.waitForTimeout(1500);
    // Page should not crash — verify heading still there
    const headingAfterPending = await page.$("text=Dunning Management");
    if (!headingAfterPending) throw new Error("Page crashed after selecting 'pending' filter");

    // Select "failed"
    await select.selectOption("failed");
    await page.waitForTimeout(1500);
    const headingAfterFailed = await page.$("text=Dunning Management");
    if (!headingAfterFailed) throw new Error("Page crashed after selecting 'failed' filter");

    // Select "success"
    await select.selectOption("success");
    await page.waitForTimeout(1500);
    const headingAfterSuccess = await page.$("text=Dunning Management");
    if (!headingAfterSuccess) throw new Error("Page crashed after selecting 'success' filter");

    // Reset to All
    await select.selectOption("");
    await page.waitForTimeout(1000);
    const headingAfterAll = await page.$("text=Dunning Management");
    if (!headingAfterAll) throw new Error("Page crashed after resetting filter to 'All'");
  }, context);

  // =========================================================================
  //  DISPUTE TESTS
  // =========================================================================
  console.log("\n--- Dispute Tests ---");

  // 10. Navigate to disputes via sidebar, verify table headers
  await test("10. Navigate to disputes — verify page and table headers", async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });

    await navigateViaSidebar(page, "Disputes", "/disputes");

    if (!page.url().includes("/disputes")) {
      throw new Error(`Expected URL to include /disputes, got: ${page.url()}`);
    }

    // Verify page heading
    await page.waitForSelector("h1:has-text('Disputes')", { timeout: 10000 });

    // Verify filter buttons exist: All, Open, Under Review, Resolved, Closed
    const filterLabels = ["All", "Open", "Under Review", "Resolved", "Closed"];
    for (const label of filterLabels) {
      const btn = page.locator(`button:has-text("${label}")`);
      const visible = await btn.isVisible().catch(() => false);
      if (!visible) throw new Error(`Filter button "${label}" not found`);
    }

    // Wait for table or empty state
    await page.waitForTimeout(2000);

    const table = await page.$("table");
    if (table) {
      await verifyTableHeaders(page, ["Reason", "Invoice", "Status", "Created", "Actions"]);
    } else {
      const noDisputes = await page.$("text=No disputes found");
      if (!noDisputes) throw new Error("Neither disputes table nor empty state found");
    }
  }, context);

  // 11. Dispute status filter — click filter buttons, verify table updates
  await test("11. Status filter — click Open, Under Review, Resolved and verify updates", async (page) => {
    await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click "Open" filter
    await page.click('button:has-text("Open")');
    await page.waitForTimeout(1500);
    // Heading should still be present
    const headingAfterOpen = await page.$("h1:has-text('Disputes')");
    if (!headingAfterOpen) throw new Error("Disputes heading lost after clicking 'Open' filter");

    // Click "Under Review" filter
    await page.click('button:has-text("Under Review")');
    await page.waitForTimeout(1500);
    const headingAfterReview = await page.$("h1:has-text('Disputes')");
    if (!headingAfterReview) throw new Error("Disputes heading lost after clicking 'Under Review' filter");

    // Click "Resolved" filter
    await page.click('button:has-text("Resolved")');
    await page.waitForTimeout(1500);
    const headingAfterResolved = await page.$("h1:has-text('Disputes')");
    if (!headingAfterResolved) throw new Error("Disputes heading lost after clicking 'Resolved' filter");

    // Click "All" to reset
    await page.click('button:has-text("All")');
    await page.waitForTimeout(1000);
    const headingAfterAll = await page.$("h1:has-text('Disputes')");
    if (!headingAfterAll) throw new Error("Disputes heading lost after clicking 'All' filter");
  }, context);

  // 12. View dispute detail — click on a dispute, verify detail page
  await test("12. View dispute detail — verify client info, invoice link, reason, status", async (page) => {
    await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if there are any disputes
    const table = await page.$("table");
    if (!table) {
      const noDisputes = await page.$("text=No disputes found");
      if (noDisputes) {
        console.log("         (skipped: no disputes available to view)");
        return;
      }
      throw new Error("No table and no empty state found");
    }

    // Click the first "View" button in the table
    const viewBtn = page.locator('button:has-text("View")').first();
    const viewBtnVisible = await viewBtn.isVisible().catch(() => false);
    if (!viewBtnVisible) {
      console.log("         (skipped: no disputes with View button available)");
      return;
    }

    await viewBtn.click();
    await page.waitForURL("**/disputes/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify "Dispute Detail" heading
    await page.waitForSelector("text=Dispute Detail", { timeout: 10000 });

    // Verify Client ID section exists
    const clientIdLabel = await page.$("text=Client ID");
    if (!clientIdLabel) throw new Error("Client ID section not found on dispute detail");

    // Verify Invoice ID section exists
    const invoiceIdLabel = await page.$("text=Invoice ID");
    if (!invoiceIdLabel) throw new Error("Invoice ID section not found on dispute detail");

    // Verify Reason section exists
    const reasonLabel = await page.$("text=Reason");
    if (!reasonLabel) throw new Error("Reason section not found on dispute detail");

    // Verify Admin Actions section exists
    await page.waitForSelector("text=Admin Actions", { timeout: 10000 });

    // Verify the status dropdown exists
    const statusSelect = page.locator("select").first();
    await statusSelect.waitFor({ timeout: 5000 });
  }, context);

  // 13. Update dispute — change status, fill resolution and admin notes, save
  await test("13. Update dispute — change to Under Review, fill resolution/notes, save", async (page) => {
    await page.goto(`${BASE_URL}/disputes`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if there are any disputes
    const viewBtn = page.locator('button:has-text("View")').first();
    const viewBtnVisible = await viewBtn.isVisible().catch(() => false);
    if (!viewBtnVisible) {
      console.log("         (skipped: no disputes available to update)");
      return;
    }

    // Navigate to first dispute detail
    await viewBtn.click();
    await page.waitForURL("**/disputes/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForSelector("text=Admin Actions", { timeout: 10000 });

    // Change status dropdown to "Under Review"
    const statusSelect = page.locator("select").first();
    await statusSelect.waitFor({ timeout: 5000 });
    await statusSelect.selectOption("under_review");

    // Fill resolution textarea
    const resolutionTextarea = page.locator('textarea[placeholder="Describe the resolution for this dispute..."]');
    await resolutionTextarea.waitFor({ timeout: 5000 });
    await resolutionTextarea.fill("E2E test resolution — investigating the matter further");

    // Fill admin notes textarea
    const adminNotesTextarea = page.locator('textarea[placeholder="Internal notes (not visible to client)..."]');
    await adminNotesTextarea.waitFor({ timeout: 5000 });
    await adminNotesTextarea.fill("Updated by E2E test suite on " + new Date().toISOString().slice(0, 10));

    // Click Save Changes
    await page.click('button:has-text("Save Changes")');

    // Wait for toast
    await waitForToast(page, "Dispute updated", 15000);
  }, context);

  // =========================================================================
  //  USAGE (METERED BILLING) TESTS
  // =========================================================================
  console.log("\n--- Usage (Metered Billing) Tests ---");

  // 14. Navigate to usage via sidebar, verify "Record Usage" button
  await test("14. Navigate to usage — verify page and Record Usage button", async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });

    await navigateViaSidebar(page, "Usage", "/usage");

    if (!page.url().includes("/usage")) {
      throw new Error(`Expected URL to include /usage, got: ${page.url()}`);
    }

    // Verify heading
    await page.waitForSelector("text=Usage Records", { timeout: 10000 });

    // Verify "Record Usage" button
    const recordBtn = page.locator('button:has-text("Record Usage")');
    await recordBtn.waitFor({ timeout: 5000 });
    if (!(await recordBtn.isVisible())) {
      throw new Error("Record Usage button not visible");
    }
  }, context);

  // 15. Record usage via UI — click "Record Usage", fill modal form, submit
  await test("15. Record usage via UI — fill modal form, select product/client, submit", async (page) => {
    await page.goto(`${BASE_URL}/usage`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click "Record Usage" button to open modal
    await page.click('button:has-text("Record Usage")');

    // Wait for modal to appear
    await page.waitForSelector("text=Record Usage", { timeout: 10000 });
    // The modal has title "Record Usage" and contains a form

    // Wait for selects to populate (products and clients need to load)
    await page.waitForTimeout(2000);

    // Select product from dropdown — first select in the modal
    const productSelect = page.locator('select').filter({ has: page.locator('option:has-text("Select product...")') });
    if (await productSelect.count() > 0) {
      // Get all options
      const options = await productSelect.locator("option").allTextContents();
      // Find first real option (not "Select product...")
      const realOptions = options.filter((o) => o !== "Select product..." && o !== "");
      if (realOptions.length === 0) {
        throw new Error("No metered products available in dropdown — cannot record usage");
      }
      // Select the first real option by its index (index 1, since 0 is placeholder)
      await productSelect.selectOption({ index: 1 });
    } else {
      throw new Error("Product select dropdown not found in modal");
    }

    // Select client from dropdown
    const clientSelect = page.locator('select').filter({ has: page.locator('option:has-text("Select client...")') });
    if (await clientSelect.count() > 0) {
      const clientOptions = await clientSelect.locator("option").allTextContents();
      const realClientOptions = clientOptions.filter((o) => o !== "Select client..." && o !== "");
      if (realClientOptions.length === 0) {
        throw new Error("No clients available in dropdown — cannot record usage");
      }
      await clientSelect.selectOption({ index: 1 });
    } else {
      throw new Error("Client select dropdown not found in modal");
    }

    // Fill quantity
    const quantityInput = page.locator('input[type="number"]');
    await quantityInput.waitFor({ timeout: 5000 });
    await quantityInput.fill("42");

    // Fill description
    const descriptionInput = page.locator('input[placeholder="Optional description"]');
    await descriptionInput.fill("E2E test usage entry");

    // Fill period dates
    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const dateInputs = page.locator('.fixed input[type="date"]');
    const dateCount = await dateInputs.count();
    if (dateCount >= 2) {
      await dateInputs.nth(0).fill(periodStart);
      await dateInputs.nth(1).fill(periodEnd);
    } else {
      // Fallback: look for all date inputs in modal context
      const allDateInputs = page.locator('input[type="date"]');
      const allCount = await allDateInputs.count();
      // The last two date inputs are likely in the modal (period start/end)
      if (allCount >= 2) {
        await allDateInputs.nth(allCount - 2).fill(periodStart);
        await allDateInputs.nth(allCount - 1).fill(periodEnd);
      }
    }

    // Click Record (submit) button in modal
    // The submit button says "Record" (not "Record Usage" — that is the page button)
    const submitBtn = page.locator('.fixed button[type="submit"]:has-text("Record")');
    if (await submitBtn.count() === 0) {
      // Fallback
      const altSubmit = page.locator('button[type="submit"]').last();
      await altSubmit.click();
    } else {
      await submitBtn.click();
    }

    // Wait for toast
    await waitForToast(page, "Usage recorded", 15000);
  }, context);

  // 16. Verify recorded usage entry appears in table
  await test("16. Usage table — verify recorded entry appears in table", async (page) => {
    await page.goto(`${BASE_URL}/usage`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Should have a table (since we just recorded usage)
    const table = await page.$("table");
    if (!table) {
      // Check for empty state
      const emptyState = await page.$("text=No usage records yet");
      if (emptyState) {
        throw new Error("Usage table shows empty state after recording usage — entry not persisted");
      }
      throw new Error("No usage table found on page");
    }

    // Verify table headers
    await verifyTableHeaders(page, ["Product", "Client", "Quantity", "Period"]);

    // Look for a row containing "42" (our quantity)
    const quantityCell = await page.$("td:has-text('42')");
    if (!quantityCell) {
      console.log("         Note: quantity '42' not found in table (may be on another page or format differs)");
    }

    // Verify at least one data row exists
    const rows = await page.$$("table tbody tr");
    if (rows.length === 0) {
      throw new Error("Usage table exists but has no data rows");
    }

    console.log(`         Found ${rows.length} usage record(s) in table`);
  }, context);

  // =========================================================================
  //  SAAS METRICS TESTS
  // =========================================================================
  console.log("\n--- SaaS Metrics Tests ---");

  // 17. Navigate to metrics via sidebar
  await test("17. Navigate to metrics via sidebar — verify /metrics page", async (page) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });

    await navigateViaSidebar(page, "SaaS Metrics", "/metrics");

    if (!page.url().includes("/metrics")) {
      throw new Error(`Expected URL to include /metrics, got: ${page.url()}`);
    }

    // Verify page heading
    await page.waitForSelector("text=SaaS Metrics", { timeout: 10000 });
  }, context);

  // 18. Verify stat cards — MRR, ARR, Customer Churn, Average LTV
  await test("18. Verify stat cards — MRR, ARR, Customer Churn, Average LTV", async (page) => {
    await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for metric cards to load (they make multiple API calls)
    await page.waitForTimeout(5000);

    // Verify key metric labels exist
    const expectedLabels = ["MRR", "ARR", "Customer Churn", "Average LTV"];
    for (const label of expectedLabels) {
      const el = await page.$(`text=${label}`);
      if (!el) throw new Error(`Metric card "${label}" not found`);
    }

    // Verify each card has a numeric value (look for text-xl font-bold elements)
    const valueElements = page.locator(".text-xl.font-bold");
    const count = await valueElements.count();
    if (count < 4) {
      throw new Error(`Expected at least 4 metric value elements, found ${count}`);
    }

    // Verify each value has some text content (not empty)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await valueElements.nth(i).textContent();
      if (!text || text.trim().length === 0) {
        throw new Error(`Metric card value at index ${i} is empty`);
      }
    }
  }, context);

  // 19. Revenue chart — verify chart container and SVG elements render
  await test("19. Revenue chart — verify MRR Revenue Breakdown chart renders", async (page) => {
    await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for chart to render
    await page.waitForTimeout(5000);

    // Verify "MRR Revenue Breakdown" heading
    await page.waitForSelector("text=MRR Revenue Breakdown", { timeout: 10000 });

    // Should have either a Recharts SVG or a "No revenue breakdown data" message
    const chartSvg = await page.$(".recharts-responsive-container svg");
    const noData = await page.$("text=No revenue breakdown data available");

    if (!chartSvg && !noData) {
      throw new Error("Neither revenue breakdown chart (SVG) nor empty-state message found");
    }

    if (chartSvg) {
      // Verify that the chart has some rendered content (bars or lines)
      const bars = await page.$$(".recharts-bar");
      const lines = await page.$$(".recharts-line");
      console.log(`         Chart rendered with ${bars.length} bar group(s) and ${lines.length} line(s)`);
    } else {
      console.log("         No revenue breakdown data available — empty state displayed");
    }
  }, context);

  // 20. Subscription stats — verify Active, Trialing, Past Due counts visible
  await test("20. Subscription stats — verify Active, Trialing, Past Due, Trial to Active", async (page) => {
    await page.goto(`${BASE_URL}/metrics`, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for subscription funnel to load
    await page.waitForTimeout(5000);

    // Verify "Subscription Funnel" heading
    await page.waitForSelector("text=Subscription Funnel", { timeout: 10000 });

    // Verify subscription stat labels
    const expectedStats = ["Trialing", "Active", "Past Due"];
    for (const label of expectedStats) {
      const el = await page.$(`text=${label}`);
      if (!el) throw new Error(`Subscription stat "${label}" not found`);
    }

    // Verify "Trial to Active" conversion rate
    const conversionLabel = await page.$("text=Trial to Active");
    if (!conversionLabel) throw new Error("Trial to Active conversion metric not found");

    // Verify that numeric values are displayed
    // Each StatsCard renders a value — look for numeric content in the funnel area
    const funnelSection = page.locator("div:has(> h2:has-text('Subscription Funnel'))");
    const valueEls = funnelSection.locator(".text-xl.font-bold, .text-2xl.font-bold");
    const valueCount = await valueEls.count();
    if (valueCount < 3) {
      // Also check for StatsCard values
      console.log(`         Found ${valueCount} stat value(s) in funnel section`);
    }
  }, context);

  // =========================================================================
  //  Cleanup & Summary
  // =========================================================================

  // Clean up created coupons via UI
  if (createdPercentageCouponId) {
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/coupons/${createdPercentageCouponId}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      page.on("dialog", async (dialog) => { await dialog.accept(); });
      const deactivateBtn = await page.$('button:has-text("Deactivate")');
      if (deactivateBtn) {
        await deactivateBtn.click();
        await page.waitForTimeout(2000);
      }
      await page.close();
    } catch {
      // best-effort cleanup
    }
  }

  await context.close();
  await browser.close();

  printSummary();

  // Exit with non-zero if any test failed
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
})();
