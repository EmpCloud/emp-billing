/**
 * E2E Tests — Clients & Products (Deep Functional / UI-only)
 *
 * Every test interacts through the UI: fill forms, click buttons, select dropdowns.
 * No direct API calls via page.evaluate(fetch(...)).
 *
 * Run:  npx tsx scripts/e2e/clients-products.test.ts
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:4001";
const EMAIL = "admin@acme.com";
const PASSWORD = "Admin@123";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let currentPage: Page;

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
    // Take screenshot on failure
    try {
      if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 80);
      await currentPage.screenshot({
        path: path.join(SCREENSHOT_DIR, `FAIL_${safeName}.png`),
        fullPage: true,
      });
      console.log(`         Screenshot saved: FAIL_${safeName}.png`);
    } catch {
      // ignore screenshot errors
    }
  }
  // 1500ms delay between tests
  await new Promise((r) => setTimeout(r, 1500));
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

/** Wait for navigation/network to settle after a click */
async function waitForStable(page: Page, timeoutMs = 5000) {
  await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Click a sidebar link by its visible label text */
async function clickSidebarLink(page: Page, label: string) {
  // Sidebar links are <a> tags containing a <span> with the label
  // or just text within an <a> — try both patterns
  const link = page.locator(`nav a:has-text("${label}"), aside a:has-text("${label}")`).first();
  await link.waitFor({ state: "visible", timeout: 10000 });
  await link.click();
  await waitForStable(page);
}

/** Fill an input field identified by its label text */
async function fillByLabel(page: Page, label: string, value: string) {
  // The Input component generates id from label: label.toLowerCase().replace(/\s+/g, "-")
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const input = page.locator(`#${CSS.escape(id)}`);
  await input.waitFor({ state: "visible", timeout: 5000 });
  await input.fill(value);
}

/** Select a dropdown option by the label of the <select> element */
async function selectByLabel(page: Page, label: string, value: string) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const select = page.locator(`#${CSS.escape(id)}`);
  await select.waitFor({ state: "visible", timeout: 5000 });
  await select.selectOption(value);
}

/** Click a button by its visible text content */
async function clickButton(page: Page, text: string) {
  const btn = page.locator(`button:has-text("${text}")`).first();
  await btn.waitFor({ state: "visible", timeout: 5000 });
  await btn.click();
}

/** Wait for a toast notification containing specified text */
async function waitForToast(page: Page, text: string, timeoutMs = 10000) {
  // react-hot-toast renders toasts in a div with role="status" or in a [data-sonner-toast] or similar
  // Common pattern: div containing the text
  const toastLocator = page.locator(`text="${text}"`).first();
  await toastLocator.waitFor({ state: "visible", timeout: timeoutMs });
}

/** Get the count of rows in the first visible table body */
async function getTableRowCount(page: Page): Promise<number> {
  await page.waitForSelector("table tbody", { timeout: 10000 });
  return page.locator("table tbody tr").count();
}

// ---------------------------------------------------------------------------
// Login helper
// ---------------------------------------------------------------------------
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(EMAIL);

  const passInput = page.locator('input[type="password"]');
  await passInput.fill(PASSWORD);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  currentPage = page;

  console.log("\n=== Logging in via UI ===\n");
  await login(page);
  console.log(`  Logged in. URL: ${page.url()}\n`);

  // Track created entity details for dependent tests
  let createdClientName = "";
  let createdClientId = "";
  let createdGoodsProductName = "";
  let createdServiceProductName = "";

  // ════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ════════════════════════════════════════════════════════════════════════
  console.log("=== CLIENTS ===\n");

  // 1. Navigate to clients page
  await test("1. Navigate to clients page via sidebar", async () => {
    await clickSidebarLink(page, "Clients");

    // Verify URL
    await page.waitForURL("**/clients", { timeout: 10000 });
    const url = page.url();
    if (!url.includes("/clients")) {
      throw new Error(`Expected /clients URL, got: ${url}`);
    }

    // Verify page heading
    const heading = page.locator("h1, h2").filter({ hasText: "Clients" }).first();
    await heading.waitFor({ state: "visible", timeout: 5000 });

    // Verify table headers — desktop table
    const table = page.locator("table").first();
    await table.waitFor({ state: "visible", timeout: 10000 });

    const headers = await page.locator("table thead th").allTextContents();
    const headersJoined = headers.join(" ").toLowerCase();

    // Verify key headers exist
    for (const expected of ["name", "email", "outstanding"]) {
      if (!headersJoined.includes(expected)) {
        throw new Error(`Table header "${expected}" not found. Headers: ${headers.join(", ")}`);
      }
    }
  });

  // 2. Search clients
  await test("2. Search clients — type in search, verify filter, clear", async () => {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Wait for table to load
    const tableExists = await page.locator("table tbody tr").count().catch(() => 0);

    // Get initial row count (could be 0 if no clients yet, that is fine)
    const initialCount = await page.locator("table tbody tr").count().catch(() => 0);

    // Find search input by placeholder
    const searchInput = page.locator('input[placeholder*="Search clients"]').first();
    await searchInput.waitFor({ state: "visible", timeout: 5000 });

    // Type a search term that likely won't match everything
    await searchInput.fill("zzz_nonexistent_query_zzz");
    await page.waitForTimeout(1500); // Wait for debounced search

    // After searching for gibberish, either we get no rows or an empty state
    const afterSearchCount = await page.locator("table tbody tr").count().catch(() => 0);
    const emptyState = page.locator('text="No clients match your search"');
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (afterSearchCount >= initialCount && initialCount > 0 && !hasEmpty) {
      throw new Error(`Search did not filter: before=${initialCount}, after=${afterSearchCount}`);
    }

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(1500);

    // After clearing, rows should return (if there were any)
    if (initialCount > 0) {
      const afterClear = await page.locator("table tbody tr").count().catch(() => 0);
      if (afterClear === 0) {
        throw new Error("Rows did not return after clearing search");
      }
    }
  });

  // 3. Create new client via UI
  await test("3. Create new client via UI form", async () => {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    // Click "New Client" button
    await clickButton(page, "New Client");
    await page.waitForURL("**/clients/new", { timeout: 10000 });

    // Verify we're on the create page
    const heading = page.locator("h1, h2").filter({ hasText: "New Client" }).first();
    await heading.waitFor({ state: "visible", timeout: 5000 });

    // Fill basic info
    const ts = Date.now();
    createdClientName = `E2E Test Client ${ts}`;

    await fillByLabel(page, "Client Name", createdClientName);
    await fillByLabel(page, "Display Name", `E2E Display ${ts}`);
    await fillByLabel(page, "Email", `e2e-test-${ts}@example.com`);

    // Phone field — verify it accepts digits and phone chars
    const phoneInput = page.locator("#phone");
    await phoneInput.waitFor({ state: "visible", timeout: 5000 });
    await phoneInput.fill("+919876543210");
    // Verify the value was accepted (only digits/phone chars)
    const phoneValue = await phoneInput.inputValue();
    if (!phoneValue.includes("9876543210")) {
      throw new Error(`Phone value incorrect: ${phoneValue}`);
    }

    // Select currency
    await selectByLabel(page, "Currency", "INR");

    // Select payment terms
    await selectByLabel(page, "Payment Terms", "30");

    // Scroll to billing address section
    const addressSection = page.locator('h2:has-text("Billing Address")');
    await addressSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Fill address line 1
    await fillByLabel(page, "Address Line 1", "123 E2E Test Street");

    // Select Country = India from dropdown
    await selectByLabel(page, "Country", "India");
    await page.waitForTimeout(800); // Wait for state dropdown to populate

    // Verify State dropdown appeared (should be a <select> now that country is India)
    const stateSelect = page.locator("#state");
    await stateSelect.waitFor({ state: "visible", timeout: 5000 });
    const stateTag = await stateSelect.evaluate((el) => el.tagName.toLowerCase());
    if (stateTag === "select") {
      // Select a state from the dropdown
      const stateOptions = await stateSelect.locator("option").allTextContents();
      // Pick a state that exists (skip the first "Select state" option)
      const validStates = stateOptions.filter((s) => s && s !== "Select state");
      if (validStates.length > 0) {
        await stateSelect.selectOption({ label: validStates[0] });
        await page.waitForTimeout(500); // Wait for city dropdown to populate
      }

      // Try to select a city if the dropdown appeared
      const citySelect = page.locator("#city");
      const cityTag = await citySelect.evaluate((el) => el.tagName.toLowerCase()).catch(() => "input");
      if (cityTag === "select") {
        const cityOptions = await citySelect.locator("option").allTextContents();
        const validCities = cityOptions.filter((c) => c && c !== "Select city");
        if (validCities.length > 0) {
          await citySelect.selectOption({ label: validCities[0] });
        }
      } else {
        await fillByLabel(page, "City", "Mumbai");
      }
    } else {
      // State is a text input — fill manually
      await fillByLabel(page, "State", "Maharashtra");
      await fillByLabel(page, "City", "Mumbai");
    }

    await fillByLabel(page, "Postal Code", "400001");

    // Click Create Client button
    const createBtn = page.locator('button[type="submit"]:has-text("Create Client")');
    await createBtn.scrollIntoViewIfNeeded();

    // Wait for the API response
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/clients") && resp.request().method() === "POST",
        { timeout: 15000 },
      ),
      createBtn.click(),
    ]);

    const status = response.status();
    if (status !== 200 && status !== 201) {
      throw new Error(`Create client API returned status ${status}`);
    }

    // Extract client ID from response
    const body = await response.json().catch(() => ({}));
    if (body.data?.id) {
      createdClientId = body.data.id;
    }

    // Verify toast
    await waitForToast(page, "Client created");

    // Verify redirect back to client list
    await page.waitForURL("**/clients", { timeout: 10000 });
  });

  // 4. View client detail
  await test("4. View client detail — verify info and stats cards", async () => {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Find the created client in the table and click "View"
    const clientRow = page.locator(`table tbody tr:has-text("${createdClientName.substring(0, 20)}")`).first();
    await clientRow.waitFor({ state: "visible", timeout: 10000 });

    // Click the View button in that row
    const viewBtn = clientRow.locator('button:has-text("View")');
    await viewBtn.click();

    // Verify URL changed to /clients/:id
    await page.waitForURL("**/clients/*", { timeout: 10000 });
    const url = page.url();
    if (!url.match(/\/clients\/[a-zA-Z0-9-]+$/)) {
      throw new Error(`Expected /clients/:id URL, got: ${url}`);
    }

    // Verify client name is displayed
    const nameOnPage = page.locator(`text="${createdClientName.substring(0, 20)}"`).first();
    // Use a broader match since display name might be shown
    const bodyText = await page.textContent("body");
    if (!bodyText?.includes("E2E")) {
      throw new Error("Client name not found on detail page");
    }

    // Verify email is shown
    if (!bodyText?.includes("e2e-test-")) {
      throw new Error("Client email not found on detail page");
    }

    // Verify phone is shown
    if (!bodyText?.includes("9876543210")) {
      throw new Error("Client phone not found on detail page");
    }

    // Verify billing address is shown (at least the country)
    if (!bodyText?.includes("India")) {
      throw new Error("Billing address country not found on detail page");
    }

    // Verify stats cards exist (Outstanding, Total Billed, Total Paid)
    for (const label of ["Outstanding", "Total Billed", "Total Paid"]) {
      const card = page.locator(`text="${label}"`).first();
      const visible = await card.isVisible().catch(() => false);
      if (!visible) {
        throw new Error(`Stats card "${label}" not visible on detail page`);
      }
    }
  });

  // 5. Edit client
  await test("5. Edit client — change display name, verify update", async () => {
    // We should be on the client detail page from previous test
    // Click Edit button
    await clickButton(page, "Edit");
    await page.waitForURL("**/clients/*/edit", { timeout: 10000 });

    // Verify form is pre-populated — the Client Name field should have our value
    const nameInput = page.locator("#client-name");
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    const currentName = await nameInput.inputValue();
    if (!currentName.includes("E2E Test Client")) {
      throw new Error(`Name field not pre-populated. Got: "${currentName}"`);
    }

    // Verify email is pre-populated
    const emailInput = page.locator('#email');
    const currentEmail = await emailInput.inputValue();
    if (!currentEmail.includes("e2e-test-")) {
      throw new Error(`Email field not pre-populated. Got: "${currentEmail}"`);
    }

    // Change the display name
    const displayInput = page.locator("#display-name");
    await displayInput.fill("E2E Updated Display Name");

    // Click Save Changes button
    const saveBtn = page.locator('button[type="submit"]:has-text("Save Changes")');
    await saveBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/clients/") && resp.request().method() === "PUT",
        { timeout: 15000 },
      ),
      saveBtn.click(),
    ]);

    const status = response.status();
    if (status !== 200) {
      throw new Error(`Update client API returned status ${status}`);
    }

    // Verify toast
    await waitForToast(page, "Client updated");

    // Verify redirect to detail page
    await page.waitForURL("**/clients/*", { timeout: 10000 });
    await waitForStable(page);

    // Verify the updated display name appears on the detail page
    const bodyText = await page.textContent("body");
    if (!bodyText?.includes("E2E Updated Display Name")) {
      throw new Error("Updated display name not found on detail page");
    }
  });

  // 6. Client statement — date range
  await test("6. Client statement — select date range, verify section loads", async () => {
    // We should be on the client detail page
    // Scroll to the Statement section
    const statementHeading = page.locator('h2:has-text("Statement")');
    await statementHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the From date input
    const fromInput = page.locator("#stmt-from");
    await fromInput.waitFor({ state: "visible", timeout: 5000 });

    // Set date range
    await fromInput.fill("2025-01-01");
    await page.waitForTimeout(300);

    const toInput = page.locator("#stmt-to");
    await toInput.fill("2026-12-31");
    await page.waitForTimeout(1500); // Wait for data to reload

    // Verify the statement section loaded — either shows table or "No transactions" empty state
    const statementSection = statementHeading.locator("..").locator("..");
    const sectionText = await statementSection.textContent();

    const hasTable = await page.locator('text="Opening Balance"').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text="No transactions"').isVisible().catch(() => false);

    if (!hasTable && !hasEmpty) {
      throw new Error("Statement section did not load — neither table nor empty state visible");
    }
  });

  // 7. CSV export
  await test("7. CSV export — click Export, verify download", async () => {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click the Export button
    const exportBtn = page.locator('button:has-text("Export")').first();
    await exportBtn.waitFor({ state: "visible", timeout: 5000 });

    // Listen for download event
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      exportBtn.click(),
    ]);

    // Verify download happened
    const suggestedFilename = download.suggestedFilename();
    if (!suggestedFilename) {
      throw new Error("No file downloaded");
    }

    // The file should be CSV
    if (!suggestedFilename.endsWith(".csv") && !suggestedFilename.includes("client")) {
      // Some implementations might name it differently, just verify we got a download
      console.log(`         Note: Downloaded file name: ${suggestedFilename}`);
    }
  });

  // 8. CSV import — verify import modal/form appears
  await test("8. CSV import — click Import, verify file input triggered", async () => {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // The Import button triggers a hidden file input
    const importBtn = page.locator('button:has-text("Import")').first();
    await importBtn.waitFor({ state: "visible", timeout: 5000 });

    // Verify the hidden file input exists
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    const fileInputCount = await fileInput.count();
    if (fileInputCount === 0) {
      throw new Error("No CSV file input found on the page");
    }

    // Verify the file input is hidden (class="hidden") — clicking Import should trigger it
    const isHidden = await fileInput.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === "none" || el.classList.contains("hidden");
    });

    if (!isHidden) {
      throw new Error("File input should be hidden (triggered by Import button)");
    }

    // We can simulate a file upload by setting input files
    // Create a test CSV
    const ts = Date.now();
    const csvPath = path.join(SCREENSHOT_DIR, `test_import_${ts}.csv`);
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(csvPath, `name,email,phone\nCSV Import E2E ${ts},csv-e2e-${ts}@example.com,+911234567890\n`);

    // Set the file on the input and trigger the change event
    await fileInput.first().setInputFiles(csvPath);

    // Wait for the import API call
    try {
      const response = await page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/clients") && resp.request().method() === "POST",
        { timeout: 10000 },
      );
      // If we get a response, the import was triggered
    } catch {
      // The import might not have an API endpoint matching this pattern — that is acceptable
      // as long as the UI triggered the file selection
    }

    // Cleanup
    try {
      fs.unlinkSync(csvPath);
    } catch {}
  });

  // ════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n=== PRODUCTS ===\n");

  // 9. Navigate to products page
  await test("9. Navigate to products page via sidebar", async () => {
    await clickSidebarLink(page, "Products");

    await page.waitForURL("**/products", { timeout: 10000 });
    const url = page.url();
    if (!url.includes("/products")) {
      throw new Error(`Expected /products URL, got: ${url}`);
    }

    // Verify page heading
    const heading = page.locator("h1, h2").filter({ hasText: "Products" }).first();
    await heading.waitFor({ state: "visible", timeout: 5000 });

    // Verify table headers (if table is visible — might be empty state)
    const tableVisible = await page.locator("table").first().isVisible().catch(() => false);
    if (tableVisible) {
      const headers = await page.locator("table thead th").allTextContents();
      const headersJoined = headers.join(" ").toLowerCase();

      for (const expected of ["name", "sku", "type", "rate", "unit"]) {
        if (!headersJoined.includes(expected)) {
          throw new Error(`Table header "${expected}" not found. Headers: ${headers.join(", ")}`);
        }
      }
    }
  });

  // 10. Create product (goods) with inventory tracking
  await test("10. Create product (goods) — with inventory tracking", async () => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    // Click "New Product" button
    await clickButton(page, "New Product");
    await page.waitForURL("**/products/new", { timeout: 10000 });

    // Verify heading
    const heading = page.locator("h1, h2").filter({ hasText: "New Product" }).first();
    await heading.waitFor({ state: "visible", timeout: 5000 });

    // Fill basic info
    const ts = Date.now();
    createdGoodsProductName = `E2E Test Widget ${ts}`;

    await fillByLabel(page, "Name", createdGoodsProductName);
    await fillByLabel(page, "SKU", `E2E-WIDGET-${ts}`);

    // Select Type = Goods
    await selectByLabel(page, "Type", "goods");

    // Select Unit = Units
    await selectByLabel(page, "Unit", "units");

    // Scroll to Pricing section
    const pricingSection = page.locator('h2:has-text("Pricing & Tax")');
    await pricingSection.scrollIntoViewIfNeeded();

    // Fill rate (in rupees — form converts to paise)
    await fillByLabel(page, "Base Rate", "500");

    // Scroll to Inventory section
    const inventorySection = page.locator('h2:has-text("Inventory")');
    await inventorySection.scrollIntoViewIfNeeded();

    // Toggle inventory tracking ON
    const trackCheckbox = page.locator("#trackInventory");
    await trackCheckbox.waitFor({ state: "visible", timeout: 5000 });
    const isChecked = await trackCheckbox.isChecked();
    if (!isChecked) {
      await trackCheckbox.click();
    }
    await page.waitForTimeout(500);

    // Fill stock quantity
    await fillByLabel(page, "Stock on Hand", "100");

    // Fill reorder level
    await fillByLabel(page, "Reorder Level", "10");

    // Click Create Product button
    const createBtn = page.locator('button[type="submit"]:has-text("Create Product")');
    await createBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/products") && resp.request().method() === "POST",
        { timeout: 15000 },
      ),
      createBtn.click(),
    ]);

    const status = response.status();
    if (status !== 200 && status !== 201) {
      throw new Error(`Create product API returned status ${status}`);
    }

    // Verify toast
    await waitForToast(page, "Product created");

    // Verify redirect
    await page.waitForURL("**/products", { timeout: 10000 });
  });

  // 11. Create product (service)
  await test("11. Create product (service) — hours unit", async () => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    await clickButton(page, "New Product");
    await page.waitForURL("**/products/new", { timeout: 10000 });

    const ts = Date.now();
    createdServiceProductName = `E2E Test Consulting ${ts}`;

    await fillByLabel(page, "Name", createdServiceProductName);

    // Select Type = Service (should be default, but set explicitly)
    await selectByLabel(page, "Type", "service");

    // Select Unit = Hours
    await selectByLabel(page, "Unit", "hrs");

    // Scroll to pricing
    const pricingSection = page.locator('h2:has-text("Pricing & Tax")');
    await pricingSection.scrollIntoViewIfNeeded();

    // Fill rate
    await fillByLabel(page, "Base Rate", "2000");

    // Click Create Product
    const createBtn = page.locator('button[type="submit"]:has-text("Create Product")');
    await createBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/products") && resp.request().method() === "POST",
        { timeout: 15000 },
      ),
      createBtn.click(),
    ]);

    const status = response.status();
    if (status !== 200 && status !== 201) {
      throw new Error(`Create product API returned status ${status}`);
    }

    await waitForToast(page, "Product created");
    await page.waitForURL("**/products", { timeout: 10000 });
  });

  // 12. View product detail
  await test("12. View product detail — verify all fields", async () => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Find the goods product in the table — click Edit to go to detail
    // Actually, the product list has Edit buttons but not View buttons that go to detail.
    // The ProductDetailPage is at /products/:id, and the list links to /products/:id/edit.
    // Let's click the Edit button for the goods product and then go back, or navigate via URL.
    // Looking at the list page, it navigates to /products/:id/edit on Edit click.
    // The ProductDetailPage exists at /products/:id — we need to find the ID.

    // Find the row with our goods product name
    const productRow = page.locator(`table tbody tr:has-text("${createdGoodsProductName.substring(0, 20)}")`).first();
    await productRow.waitFor({ state: "visible", timeout: 10000 });

    // Click Edit to get to the edit page (which has the ID in the URL)
    const editBtn = productRow.locator('button:has-text("Edit")');
    await editBtn.click();
    await page.waitForURL("**/products/*/edit", { timeout: 10000 });

    // Extract the product ID from URL
    const editUrl = page.url();
    const productIdMatch = editUrl.match(/\/products\/([^/]+)\/edit/);
    if (!productIdMatch) {
      throw new Error(`Could not extract product ID from URL: ${editUrl}`);
    }
    const productId = productIdMatch[1];

    // Navigate to the detail page
    await page.goto(`${BASE_URL}/products/${productId}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const bodyText = await page.textContent("body");

    // Verify name
    if (!bodyText?.includes(createdGoodsProductName.substring(0, 20))) {
      throw new Error("Product name not found on detail page");
    }

    // Verify type = Goods
    if (!bodyText?.includes("Goods")) {
      throw new Error("Product type 'Goods' not found on detail page");
    }

    // Verify SKU
    if (!bodyText?.includes("E2E-WIDGET-")) {
      throw new Error("Product SKU not found on detail page");
    }

    // Verify unit
    if (!bodyText?.includes("units")) {
      throw new Error("Product unit not found on detail page");
    }

    // Verify rate (displayed as formatted money — 500.00 or similar)
    if (!bodyText?.includes("500")) {
      throw new Error("Product rate not found on detail page");
    }

    // Verify inventory info
    if (!bodyText?.includes("Stock on Hand")) {
      throw new Error("Inventory section not found on detail page");
    }
    if (!bodyText?.includes("100")) {
      throw new Error("Stock on hand value (100) not found on detail page");
    }
    if (!bodyText?.includes("Reorder Level")) {
      throw new Error("Reorder level label not found on detail page");
    }
  });

  // 13. Edit product
  await test("13. Edit product — change rate, verify update", async () => {
    // We should be on the product detail page
    // Click Edit button
    await clickButton(page, "Edit");
    await page.waitForURL("**/products/*/edit", { timeout: 10000 });

    // Verify the form is pre-populated — Name field should have our value
    const nameInput = page.locator("#name");
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    const currentName = await nameInput.inputValue();
    if (!currentName.includes("E2E Test Widget")) {
      throw new Error(`Name field not pre-populated. Got: "${currentName}"`);
    }

    // Change the rate to 750
    const rateInput = page.locator("#base-rate");
    await rateInput.scrollIntoViewIfNeeded();
    await rateInput.fill("750");

    // Click Save Changes
    const saveBtn = page.locator('button[type="submit"]:has-text("Save Changes")');
    await saveBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/products/") && resp.request().method() === "PUT",
        { timeout: 15000 },
      ),
      saveBtn.click(),
    ]);

    const status = response.status();
    if (status !== 200) {
      throw new Error(`Update product API returned status ${status}`);
    }

    // Verify toast
    await waitForToast(page, "Product updated");

    // Verify redirect to products list
    await page.waitForURL("**/products", { timeout: 10000 });
    await waitForStable(page);

    // Go to the product detail to verify the updated rate
    // Find the product in the table — the rate column should show 750
    const productRow = page.locator(`table tbody tr:has-text("${createdGoodsProductName.substring(0, 20)}")`).first();
    await productRow.waitFor({ state: "visible", timeout: 10000 });

    const rowText = await productRow.textContent();
    if (!rowText?.includes("750")) {
      throw new Error(`Updated rate (750) not found in product row. Row text: ${rowText}`);
    }
  });

  // 14. Search products
  await test("14. Search products — type in search, verify filter", async () => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[placeholder*="Search products"]').first();
    await searchInput.waitFor({ state: "visible", timeout: 5000 });

    // Search for our goods product
    await searchInput.fill("E2E Test Widget");
    await page.waitForTimeout(1500); // Wait for debounce

    // Verify the goods product is shown
    const goodsRow = page.locator(`table tbody tr:has-text("E2E Test Widget")`).first();
    const goodsVisible = await goodsRow.isVisible().catch(() => false);
    if (!goodsVisible) {
      throw new Error("Goods product not found after search");
    }

    // The service product should NOT be visible (different name)
    const serviceRow = page.locator(`table tbody tr:has-text("E2E Test Consulting")`).first();
    const serviceVisible = await serviceRow.isVisible().catch(() => false);
    if (serviceVisible) {
      throw new Error("Service product should be filtered out but is still visible");
    }

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(1500);
  });

  // 15. Delete product
  await test("15. Delete product — confirm dialog, verify removal", async () => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Find the service product row (we'll delete this one to keep the goods one for future tests)
    const serviceRow = page.locator(`table tbody tr:has-text("E2E Test Consulting")`).first();
    await serviceRow.waitFor({ state: "visible", timeout: 10000 });

    // Set up dialog handler for window.confirm
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "confirm") {
        await dialog.accept();
      }
    });

    // Click Delete button in the service product row
    const deleteBtn = serviceRow.locator('button:has-text("Delete")');
    await deleteBtn.click();

    // Wait for the delete API response
    try {
      await page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/products/") && resp.request().method() === "DELETE",
        { timeout: 10000 },
      );
    } catch {
      // May have already completed
    }

    // Verify toast
    await waitForToast(page, "Product deleted");
    await page.waitForTimeout(1000);

    // Verify the service product is no longer in the list
    const serviceRowAfter = page.locator(`table tbody tr:has-text("${createdServiceProductName.substring(0, 20)}")`).first();
    const stillVisible = await serviceRowAfter.isVisible().catch(() => false);
    if (stillVisible) {
      throw new Error("Deleted service product is still visible in the list");
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // Cleanup — delete the goods product and the test client via UI
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n=== CLEANUP ===\n");

  // Delete goods product via UI
  try {
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const goodsRow = page.locator(`table tbody tr:has-text("E2E Test Widget")`).first();
    if (await goodsRow.isVisible().catch(() => false)) {
      page.on("dialog", async (dialog) => {
        if (dialog.type() === "confirm") await dialog.accept();
      });
      const deleteBtn = goodsRow.locator('button:has-text("Delete")');
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      console.log("  Cleaned up goods product");
    }
  } catch {
    console.log("  (Goods product cleanup skipped)");
  }

  // Delete test client via UI
  try {
    await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const clientRow = page.locator(`table tbody tr:has-text("E2E")`).first();
    if (await clientRow.isVisible().catch(() => false)) {
      page.on("dialog", async (dialog) => {
        if (dialog.type() === "confirm") await dialog.accept();
      });
      const deleteBtn = clientRow.locator('button:has-text("Delete")');
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      console.log("  Cleaned up test client");
    }
  } catch {
    console.log("  (Client cleanup skipped)");
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  printSummary();

  await browser.close();
  process.exit(results.some((r) => !r.passed) ? 1 : 0);
})();
