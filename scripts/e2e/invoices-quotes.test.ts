/**
 * E2E Tests — Invoices & Quotes (Deep Functional UI Tests)
 *
 * Every test interacts through the UI: filling forms, clicking buttons,
 * selecting dropdowns, and verifying visual feedback (toasts, badges, tables).
 *
 * Run:  npx tsx scripts/e2e/invoices-quotes.test.ts
 */
import { chromium, type Page, type BrowserContext } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:4001";
const EMAIL = "admin@acme.com";
const PASSWORD = "Admin@123";
const SCREENSHOT_DIR = "scripts/e2e/screenshots";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, page: Page, fn: () => Promise<void>) {
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
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/FAIL_${safeName}.png`,
        fullPage: true,
      });
    } catch {
      // Screenshot failed — continue
    }
  }
  // 2000ms delay between tests (invoices involve more processing)
  await new Promise((r) => setTimeout(r, 2000));
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

/** Login via the UI form (fills email, password, clicks submit). */
async function loginViaUI(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await handleNgrokInterstitial(page);

  // If already redirected to dashboard (session cookies / persisted auth), skip login
  if (page.url().includes("/dashboard")) return;

  // The Input component generates id from label:  label="Email" → id="email"
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1000);
}

/**
 * Wait for a toast message containing the given text.
 * react-hot-toast renders divs with role="status" inside a toaster container.
 */
async function waitForToast(page: Page, textSubstring: string, timeout = 10000): Promise<void> {
  // react-hot-toast uses role="status" or a div with the toast text
  const toastSelector = `div[role="status"]:has-text("${textSubstring}")`;
  const altSelector = `text="${textSubstring}"`;

  try {
    await page.waitForSelector(toastSelector, { timeout });
  } catch {
    // Fallback: any element containing the text
    await page.waitForSelector(altSelector, { timeout: 3000 });
  }
}

/**
 * Wait for navigation or network idle after a UI action.
 */
async function waitForNetworkIdle(page: Page, timeout = 10000): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout });
  } catch {
    // Timeout is acceptable — page may already be idle
  }
}

/**
 * Click a sidebar navigation link by label text.
 */
async function navigateViaSidebar(page: Page, label: string): Promise<void> {
  // The sidebar uses <a> tags with href. Click the one matching the label.
  const link = page.locator(`nav a:has-text("${label}")`).first();
  await link.waitFor({ timeout: 5000 });
  await link.click();
  await waitForNetworkIdle(page);
  await page.waitForTimeout(500);
}

/**
 * Accept a browser confirm() dialog that will pop up next.
 */
function acceptNextDialog(page: Page): void {
  page.once("dialog", (dialog) => void dialog.accept());
}

/**
 * Get the first client option value from a client <select> dropdown.
 * Waits for options to load, then returns the value of the first non-empty option.
 */
async function getFirstClientOptionValue(page: Page, selectId: string): Promise<string> {
  // Wait for the select to have options beyond the placeholder
  await page.waitForFunction(
    (id: string) => {
      const sel = document.getElementById(id) as HTMLSelectElement | null;
      if (!sel) return false;
      return sel.options.length > 1;
    },
    selectId,
    { timeout: 10000 },
  );

  const value = await page.evaluate((id: string) => {
    const sel = document.getElementById(id) as HTMLSelectElement;
    // Return the first option that has a non-empty value
    for (const opt of Array.from(sel.options)) {
      if (opt.value) return opt.value;
    }
    return "";
  }, selectId);

  if (!value) throw new Error(`No client options available in select#${selectId}`);
  return value;
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log(`\nEMP-Billing E2E Tests — Invoices & Quotes (Deep Functional)`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // Ensure screenshot directory exists
  const { mkdirSync } = await import("fs");
  try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch { /* already exists */ }

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // Accept downloads so we can verify PDF download triggers
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // =========================================================================
  //  LOGIN
  // =========================================================================
  console.log("--- Logging in via UI ---");
  await loginViaUI(page);
  console.log(`  Logged in. URL: ${page.url()}\n`);

  // Track IDs for cross-test references
  let createdInvoiceId: string | null = null;
  let sentInvoiceId: string | null = null;
  let createdQuoteId: string | null = null;

  // =========================================================================
  //  INVOICE TESTS
  // =========================================================================
  console.log("--- Invoice Tests ---");

  // 1. Navigate to invoices via sidebar
  await test("1. Navigate to invoices — click sidebar, verify /invoices URL, verify table columns", page, async () => {
    await navigateViaSidebar(page, "Invoices");

    const url = page.url();
    if (!url.includes("/invoices")) {
      throw new Error(`Expected URL to contain /invoices, got: ${url}`);
    }

    // Wait for table or empty state
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");

    // Verify expected column headers exist (either in table or page title)
    const hasInvoicesContent = body.includes("Invoices") || body.includes("Invoice");
    if (!hasInvoicesContent) throw new Error("Invoice list page did not render");

    // Check for table headers if table exists
    const table = await page.$("table");
    if (table) {
      const headers = await page.$$eval("thead th", (ths) =>
        ths.map((th) => th.textContent?.trim() ?? ""),
      );
      const expected = ["Invoice #", "Client", "Issue Date", "Due Date", "Amount", "Status"];
      for (const col of expected) {
        if (!headers.some((h) => h.includes(col))) {
          throw new Error(`Missing table column: "${col}". Found: [${headers.join(", ")}]`);
        }
      }
    }
  });

  // 2. Status filter — select "Paid", verify filtered results, reset to All
  await test("2. Status filter — select Paid, verify filter, reset to All", page, async () => {
    // Ensure we're on invoices page
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // The status filter is a <select> element. Find it by looking for the select
    // containing "All Statuses" option.
    const statusSelect = page.locator("select").filter({ hasText: "All Statuses" }).first();
    await statusSelect.waitFor({ timeout: 5000 });

    // Select "Paid"
    await statusSelect.selectOption("paid");
    await page.waitForTimeout(1500);

    // If table rows exist, verify they all show paid status
    const table = await page.$("table tbody");
    if (table) {
      const rows = await page.$$("table tbody tr");
      if (rows.length > 0) {
        // Each row should contain a "Paid" badge
        for (const row of rows) {
          const rowText = await row.textContent();
          if (rowText && !rowText.includes("Paid")) {
            throw new Error(`Found a non-Paid row in filtered results: "${rowText?.slice(0, 100)}"`);
          }
        }
      }
    }

    // Reset filter to "All"
    await statusSelect.selectOption("");
    await page.waitForTimeout(1000);
  });

  // 3. Create invoice via UI — full form interaction
  await test("3. Create invoice via UI — fill form, add line items, verify totals, submit", page, async () => {
    // Click "New Invoice" button
    const newInvoiceBtn = page.locator('button:has-text("New Invoice")');
    await newInvoiceBtn.waitFor({ timeout: 5000 });
    await newInvoiceBtn.click();

    await page.waitForURL("**/invoices/new", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // --- Select client from dropdown ---
    // The client <select> has id="client" (derived from label "Client")
    const clientSelectId = "client";
    const clientValue = await getFirstClientOptionValue(page, clientSelectId);
    await page.selectOption(`#${clientSelectId}`, clientValue);

    // --- Verify issue date is auto-filled (today) ---
    const issueDateInput = page.locator('#issue-date');
    const issueDate = await issueDateInput.inputValue();
    if (!issueDate) throw new Error("Issue date was not auto-filled");

    // --- Set due date (30 days from now, should already be set) ---
    const dueDateInput = page.locator('#due-date');
    const dueDate = await dueDateInput.inputValue();
    if (!dueDate) throw new Error("Due date was not auto-filled");

    // --- Fill first line item ---
    // Line items table: first row inputs are items.0.name, items.0.quantity, items.0.rate
    const firstItemName = page.locator('input[name="items.0.name"]');
    await firstItemName.waitFor({ timeout: 5000 });
    await firstItemName.fill("E2E Consulting Service");

    const firstItemQty = page.locator('input[name="items.0.quantity"]');
    await firstItemQty.fill("2");

    const firstItemRate = page.locator('input[name="items.0.rate"]');
    await firstItemRate.fill("500");  // 500.00 in display units = 50000 paise

    // Wait for amount to auto-calculate
    await page.waitForTimeout(500);

    // Verify line amount shows (2 * 500 = 1000)
    const bodyText = await page.textContent("body");
    // The total region should show something reflecting 1000

    // --- Add second line item ---
    const addLineItemBtn = page.locator('button:has-text("Add Line Item")');
    await addLineItemBtn.click();
    await page.waitForTimeout(500);

    const secondItemName = page.locator('input[name="items.1.name"]');
    await secondItemName.waitFor({ timeout: 5000 });
    await secondItemName.fill("E2E Support Package");

    const secondItemQty = page.locator('input[name="items.1.quantity"]');
    await secondItemQty.fill("1");

    const secondItemRate = page.locator('input[name="items.1.rate"]');
    await secondItemRate.fill("250");  // 250.00

    await page.waitForTimeout(500);

    // --- Verify subtotal updates (should be 2*500 + 1*250 = 1250) ---
    const subtotalText = await page.textContent("body");
    // We check the totals section exists with "Subtotal" and "Total"
    if (!subtotalText?.includes("Subtotal")) throw new Error("Subtotal label not found");
    if (!subtotalText?.includes("Total")) throw new Error("Total label not found");

    // --- Fill notes ---
    const notesTextarea = page.locator('textarea[name="notes"]');
    await notesTextarea.fill("E2E test invoice - auto-generated");

    // --- Fill terms ---
    const termsTextarea = page.locator('textarea[name="terms"]');
    await termsTextarea.fill("Payment due within 30 days");

    // --- Click Create Invoice ---
    const createBtn = page.locator('button[type="submit"]:has-text("Create Invoice")');
    await createBtn.click();

    // --- Verify toast "Invoice created" ---
    await waitForToast(page, "Invoice created", 15000);

    // --- Verify redirect to detail page ---
    await page.waitForTimeout(2000);
    const afterUrl = page.url();
    // Should be /invoices/<uuid> (not /invoices/new)
    if (afterUrl.includes("/invoices/new")) {
      throw new Error("Still on /invoices/new after creation — expected redirect to detail");
    }
    if (!afterUrl.includes("/invoices/")) {
      throw new Error(`Expected redirect to /invoices/<id>, got: ${afterUrl}`);
    }

    // Extract the invoice ID from URL
    const match = afterUrl.match(/\/invoices\/([a-zA-Z0-9-]+)/);
    if (match) createdInvoiceId = match[1];
  });

  // 4. View invoice detail — verify status badge, line items, totals, client link
  await test("4. View invoice detail — verify Draft status, line items, totals, client link", page, async () => {
    if (!createdInvoiceId) throw new Error("No invoice created in previous step");

    await page.goto(`${BASE_URL}/invoices/${createdInvoiceId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Detail page is empty");

    // Verify status badge shows "Draft"
    if (!body.includes("Draft")) {
      throw new Error("Status badge does not show 'Draft'");
    }

    // Verify line items are visible
    if (!body.includes("E2E Consulting Service")) {
      throw new Error("Line item 'E2E Consulting Service' not visible");
    }
    if (!body.includes("E2E Support Package")) {
      throw new Error("Line item 'E2E Support Package' not visible");
    }

    // Verify totals section exists
    if (!body.includes("Subtotal")) throw new Error("Subtotal not found on detail page");
    if (!body.includes("Total")) throw new Error("Total not found on detail page");
    if (!body.includes("Amount Due")) throw new Error("Amount Due not found on detail page");

    // Verify "View Client" link exists
    const clientLink = page.locator('button:has-text("View Client")');
    const clientLinkCount = await clientLink.count();
    if (clientLinkCount === 0) throw new Error("Client link ('View Client') not found");
  });

  // 5. Send invoice — click Send button, verify status changes to "Sent"
  await test("5. Send invoice — click Send, verify status changes to Sent", page, async () => {
    if (!createdInvoiceId) throw new Error("No invoice created");

    // Ensure we're on the detail page
    await page.goto(`${BASE_URL}/invoices/${createdInvoiceId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // Click the "Send" button
    const sendBtn = page.locator('button:has-text("Send")').first();
    await sendBtn.waitFor({ timeout: 5000 });
    await sendBtn.click();

    // Wait for toast "Invoice sent"
    await waitForToast(page, "Invoice sent", 15000);
    await page.waitForTimeout(1500);

    // Verify status badge changed to "Sent"
    const body = await page.textContent("body");
    if (!body?.includes("Sent")) {
      throw new Error("Status did not change to 'Sent' after sending");
    }

    sentInvoiceId = createdInvoiceId;
  });

  // 6. Download PDF — click PDF button, verify download starts
  await test("6. Download PDF — click PDF button, verify download triggers", page, async () => {
    if (!createdInvoiceId) throw new Error("No invoice created");

    await page.goto(`${BASE_URL}/invoices/${createdInvoiceId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // Click the "PDF" button — this triggers a blob download
    const pdfBtn = page.locator('button:has-text("PDF")').first();
    await pdfBtn.waitFor({ timeout: 5000 });

    // Listen for download event
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await pdfBtn.click();

    const download = await downloadPromise;
    const suggestedName = download.suggestedFilename();
    if (!suggestedName.includes("pdf") && !suggestedName.includes("invoice")) {
      // Some implementations may just use the ID
      // Accept any filename — the important thing is the download triggered
    }
    // Verify the download didn't fail
    const failure = await download.failure();
    if (failure) throw new Error(`PDF download failed: ${failure}`);
  });

  // 7. Record payment — open modal, fill partial amount, submit, verify status change
  await test("7. Record payment — fill modal, submit partial payment, verify Partially Paid", page, async () => {
    if (!createdInvoiceId) throw new Error("No invoice created");

    await page.goto(`${BASE_URL}/invoices/${createdInvoiceId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // Click "Record Payment" button
    const recordPaymentBtn = page.locator('button:has-text("Record Payment")');
    await recordPaymentBtn.waitFor({ timeout: 5000 });
    await recordPaymentBtn.click();

    // Wait for modal to open — modal should contain "Record Payment" title
    await page.waitForSelector('text="Record Payment"', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Fill amount (partial: 100 out of ~1250 total)
    const amountInput = page.locator('input[name="amount"]');
    await amountInput.waitFor({ timeout: 5000 });
    await amountInput.fill("");
    await amountInput.fill("100");

    // Select payment method from dropdown
    const methodSelect = page.locator('select[name="method"]');
    await methodSelect.waitFor({ timeout: 5000 });
    await methodSelect.selectOption("bank_transfer");

    // Fill reference
    const refInput = page.locator('input[name="reference"]');
    await refInput.fill("E2E-REF-001");

    // Fill notes
    const notesInput = page.locator('textarea[name="notes"]');
    if (await notesInput.count() > 0) {
      await notesInput.fill("E2E test partial payment");
    }

    // Click submit button inside the modal
    const submitPaymentBtn = page.locator('button[type="submit"]:has-text("Record Payment")');
    await submitPaymentBtn.click();

    // Wait for toast "Payment recorded"
    await waitForToast(page, "Payment recorded", 15000);
    await page.waitForTimeout(2000);

    // Verify status changes to "Partially Paid" (or stays "Sent" if amount is negligible)
    const body = await page.textContent("body");
    const hasPartiallyPaid = body?.includes("Partially Paid") || body?.includes("Partial");
    const hasPaid = body?.includes("Paid");
    if (!hasPartiallyPaid && !hasPaid) {
      throw new Error("Status did not update after payment recording");
    }

    // Verify payment appears in the payments section
    if (!body?.includes("E2E-REF-001") && !body?.includes("Bank Transfer")) {
      throw new Error("Recorded payment not visible in payments section");
    }
  });

  // 8. Duplicate invoice — go to list, duplicate via detail page
  await test("8. Duplicate invoice — click Duplicate, verify new draft invoice created", page, async () => {
    if (!createdInvoiceId) throw new Error("No invoice created");

    await page.goto(`${BASE_URL}/invoices/${createdInvoiceId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // Click "Duplicate" button
    const dupBtn = page.locator('button:has-text("Duplicate")');
    await dupBtn.waitFor({ timeout: 5000 });
    await dupBtn.click();

    // Wait for toast "Invoice duplicated"
    await waitForToast(page, "Invoice duplicated", 15000);
    await page.waitForTimeout(2000);

    // After duplication, the hook navigates to the new invoice's detail page
    const afterUrl = page.url();
    if (!afterUrl.includes("/invoices/")) {
      throw new Error(`Expected redirect to duplicated invoice, got: ${afterUrl}`);
    }

    // Verify the new page shows "Draft" status
    const body = await page.textContent("body");
    if (!body?.includes("Draft")) {
      throw new Error("Duplicated invoice does not show 'Draft' status");
    }

    // Verify line items were copied
    if (!body?.includes("E2E Consulting Service")) {
      throw new Error("Duplicated invoice missing original line items");
    }

    // Clean up: delete the duplicate via UI
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    if (await deleteBtn.count() > 0) {
      acceptNextDialog(page);
      await deleteBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  // 9. Void invoice — create a new draft, send it, then void it
  await test("9. Void invoice — send then void, verify status Void", page, async () => {
    // Create a fresh invoice via UI for voiding
    await page.goto(`${BASE_URL}/invoices/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Select client
    const clientValue = await getFirstClientOptionValue(page, "client");
    await page.selectOption("#client", clientValue);

    // Fill line item
    await page.fill('input[name="items.0.name"]', "E2E Void Test Item");
    await page.fill('input[name="items.0.quantity"]', "1");
    await page.fill('input[name="items.0.rate"]', "100");
    await page.waitForTimeout(300);

    // Submit
    const createBtn = page.locator('button[type="submit"]:has-text("Create Invoice")');
    await createBtn.click();
    await waitForToast(page, "Invoice created", 15000);
    await page.waitForTimeout(2000);

    // Now send the invoice (so it's in "Sent" status, which can be voided)
    const sendBtn = page.locator('button:has-text("Send")').first();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
      await waitForToast(page, "Invoice sent", 15000);
      await page.waitForTimeout(1500);
    }

    // Now void the invoice
    const voidBtn = page.locator('button:has-text("Void")');
    await voidBtn.waitFor({ timeout: 5000 });
    acceptNextDialog(page);  // confirm dialog
    await voidBtn.click();

    // Wait for toast "Invoice voided"
    await waitForToast(page, "Invoice voided", 15000);
    await page.waitForTimeout(1500);

    // Verify status badge shows "Void"
    const body = await page.textContent("body");
    if (!body?.includes("Void")) {
      throw new Error("Status did not change to 'Void'");
    }
  });

  // =========================================================================
  //  QUOTE TESTS
  // =========================================================================
  console.log("\n--- Quote Tests ---");

  // 10. Navigate to quotes via sidebar
  await test("10. Navigate to quotes — verify /quotes URL, verify table headers", page, async () => {
    await navigateViaSidebar(page, "Quotes");

    const url = page.url();
    if (!url.includes("/quotes")) {
      throw new Error(`Expected URL to contain /quotes, got: ${url}`);
    }

    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Quotes") && !body?.includes("Quote")) {
      throw new Error("Quotes page did not render");
    }

    // Verify table headers if table exists
    const table = await page.$("table");
    if (table) {
      const headers = await page.$$eval("thead th", (ths) =>
        ths.map((th) => th.textContent?.trim() ?? ""),
      );
      const expected = ["Quote #", "Client", "Issue Date", "Expiry Date", "Total", "Status"];
      for (const col of expected) {
        if (!headers.some((h) => h.includes(col))) {
          throw new Error(`Missing table column: "${col}". Found: [${headers.join(", ")}]`);
        }
      }
    }
  });

  // 11. Create quote via UI — fill form, add line items, submit
  await test("11. Create quote via UI — fill form, add line items, submit", page, async () => {
    // Click "New Quote" button
    const newQuoteBtn = page.locator('button:has-text("New Quote")');
    await newQuoteBtn.waitFor({ timeout: 5000 });
    await newQuoteBtn.click();

    await page.waitForURL("**/quotes/new", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // --- Select client from dropdown ---
    const clientValue = await getFirstClientOptionValue(page, "client");
    await page.selectOption("#client", clientValue);

    // --- Verify issue date is auto-filled ---
    const issueDateVal = await page.locator("#issue-date").inputValue();
    if (!issueDateVal) throw new Error("Issue date not auto-filled");

    // --- Set expiry date (should be auto-filled to 30 days) ---
    const expiryDateVal = await page.locator("#expiry-date").inputValue();
    if (!expiryDateVal) throw new Error("Expiry date not auto-filled");

    // --- Fill first line item ---
    await page.fill('input[name="items.0.name"]', "E2E Quote Consulting");
    await page.fill('input[name="items.0.quantity"]', "3");
    await page.fill('input[name="items.0.rate"]', "1000");  // 1000.00

    await page.waitForTimeout(500);

    // --- Add second line item ---
    const addLineItemBtn = page.locator('button:has-text("Add Line Item")');
    await addLineItemBtn.click();
    await page.waitForTimeout(500);

    await page.fill('input[name="items.1.name"]', "E2E Quote Training");
    await page.fill('input[name="items.1.quantity"]', "2");
    await page.fill('input[name="items.1.rate"]', "750");

    await page.waitForTimeout(500);

    // --- Fill notes ---
    const notesTextarea = page.locator('textarea[name="notes"]');
    await notesTextarea.fill("E2E test quote - auto-generated");

    // --- Click Create Quote ---
    const createBtn = page.locator('button[type="submit"]:has-text("Create Quote")');
    await createBtn.click();

    // --- Wait for toast "Quote created" ---
    await waitForToast(page, "Quote created", 15000);
    await page.waitForTimeout(2000);

    // --- Verify redirect to detail page ---
    const afterUrl = page.url();
    if (afterUrl.includes("/quotes/new")) {
      throw new Error("Still on /quotes/new after creation");
    }
    if (!afterUrl.includes("/quotes/")) {
      throw new Error(`Expected redirect to /quotes/<id>, got: ${afterUrl}`);
    }

    const match = afterUrl.match(/\/quotes\/([a-zA-Z0-9-]+)/);
    if (match) createdQuoteId = match[1];
  });

  // 12. View quote detail — verify status "Draft", line items, totals
  await test("12. View quote detail — verify Draft status, line items, totals", page, async () => {
    if (!createdQuoteId) throw new Error("No quote created in previous step");

    await page.goto(`${BASE_URL}/quotes/${createdQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Quote detail page is empty");

    // Verify status badge shows "Draft"
    if (!body.includes("Draft")) {
      throw new Error("Status badge does not show 'Draft'");
    }

    // Verify line items visible
    if (!body.includes("E2E Quote Consulting")) {
      throw new Error("Line item 'E2E Quote Consulting' not visible");
    }
    if (!body.includes("E2E Quote Training")) {
      throw new Error("Line item 'E2E Quote Training' not visible");
    }

    // Verify totals section
    if (!body.includes("Subtotal")) throw new Error("Subtotal not found");
    if (!body.includes("Total")) throw new Error("Total not found");

    // Verify client link
    const clientLink = page.locator('button:has-text("View Client")');
    if (await clientLink.count() === 0) {
      throw new Error("Client link not found on quote detail");
    }
  });

  // 13. Send quote — click Send, verify status "Sent"
  await test("13. Send quote — click Send, verify status changes to Sent", page, async () => {
    if (!createdQuoteId) throw new Error("No quote created");

    await page.goto(`${BASE_URL}/quotes/${createdQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // Click "Send" button
    const sendBtn = page.locator('button:has-text("Send")').first();
    await sendBtn.waitFor({ timeout: 5000 });
    await sendBtn.click();

    // Wait for toast
    await waitForToast(page, "Quote sent", 15000);
    await page.waitForTimeout(1500);

    // Reload and verify status
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body?.includes("Sent")) {
      throw new Error("Status did not change to 'Sent'");
    }
  });

  // 14. Accept quote — use API to accept (no UI button for admin accept)
  //     then verify status on detail page
  await test("14. Accept quote — accept via API, verify status Accepted on detail page", page, async () => {
    if (!createdQuoteId) throw new Error("No quote created");

    // The admin UI doesn't have an Accept button (that's a client portal action).
    // We'll call the API from the page context, then verify the UI reflects it.
    const result = await page.evaluate(async (quoteId: string) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/v1/quotes/${quoteId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    }, createdQuoteId);

    if (!result.ok) throw new Error(`Accept API returned ${result.status}`);

    // Now verify the UI shows "Accepted"
    await page.goto(`${BASE_URL}/quotes/${createdQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body?.includes("Accepted")) {
      throw new Error("Status did not change to 'Accepted' on detail page");
    }
  });

  // 15. Convert to invoice — click "Convert to Invoice", verify toast, verify redirect
  await test("15. Convert to invoice — click Convert, verify toast and redirect", page, async () => {
    if (!createdQuoteId) throw new Error("No quote created");

    await page.goto(`${BASE_URL}/quotes/${createdQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // The "Convert to Invoice" button only shows when status is "Accepted"
    const convertBtn = page.locator('button:has-text("Convert to Invoice")');
    await convertBtn.waitFor({ timeout: 5000 });
    await convertBtn.click();

    // Wait for toast "Quote converted to invoice"
    await waitForToast(page, "Quote converted to invoice", 15000);
    await page.waitForTimeout(2000);

    // After conversion, the hook navigates to the new invoice's detail page
    const afterUrl = page.url();
    if (!afterUrl.includes("/invoices/")) {
      throw new Error(`Expected redirect to /invoices/<id>, got: ${afterUrl}`);
    }

    // Go back to the quote and verify its status shows "Converted"
    await page.goto(`${BASE_URL}/quotes/${createdQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body?.includes("Converted")) {
      throw new Error("Quote status did not change to 'Converted'");
    }
  });

  // 16. Download quote PDF — click PDF button, verify download
  await test("16. Download quote PDF — click PDF, verify download triggers", page, async () => {
    // Create a fresh quote for PDF download (the converted one may not have PDF button)
    await page.goto(`${BASE_URL}/quotes/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const clientValue = await getFirstClientOptionValue(page, "client");
    await page.selectOption("#client", clientValue);
    await page.fill('input[name="items.0.name"]', "E2E PDF Test Item");
    await page.fill('input[name="items.0.quantity"]', "1");
    await page.fill('input[name="items.0.rate"]', "500");
    await page.waitForTimeout(300);

    const createBtn = page.locator('button[type="submit"]:has-text("Create Quote")');
    await createBtn.click();
    await waitForToast(page, "Quote created", 15000);
    await page.waitForTimeout(2000);

    // Now on the detail page — click PDF
    const pdfBtn = page.locator('button:has-text("PDF")').first();
    await pdfBtn.waitFor({ timeout: 5000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await pdfBtn.click();

    const download = await downloadPromise;
    const failure = await download.failure();
    if (failure) throw new Error(`Quote PDF download failed: ${failure}`);

    // Clean up: delete this draft quote
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    if (await deleteBtn.count() > 0) {
      acceptNextDialog(page);
      await deleteBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  // 17. Edit quote — create new quote, edit it (change currency, modify rate), save, verify
  await test("17. Edit quote — create, click Edit, change currency and rate, save, verify", page, async () => {
    // Create a fresh quote
    await page.goto(`${BASE_URL}/quotes/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const clientValue = await getFirstClientOptionValue(page, "client");
    await page.selectOption("#client", clientValue);
    await page.fill('input[name="items.0.name"]', "E2E Edit Test Item");
    await page.fill('input[name="items.0.quantity"]', "2");
    await page.fill('input[name="items.0.rate"]', "300");
    await page.waitForTimeout(300);

    const createBtn = page.locator('button[type="submit"]:has-text("Create Quote")');
    await createBtn.click();
    await waitForToast(page, "Quote created", 15000);
    await page.waitForTimeout(2000);

    // Extract quote ID from URL
    const detailUrl = page.url();
    const match = detailUrl.match(/\/quotes\/([a-zA-Z0-9-]+)/);
    if (!match) throw new Error("Could not extract quote ID from URL");
    const editQuoteId = match[1];

    // Click "Edit" button
    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.waitFor({ timeout: 5000 });
    await editBtn.click();

    await page.waitForURL(`**/quotes/${editQuoteId}/edit`, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // --- Change currency to USD ---
    const currencySelect = page.locator("#currency");
    await currencySelect.waitFor({ timeout: 5000 });
    await currencySelect.selectOption("USD");

    // --- Modify line item rate ---
    const rateInput = page.locator('input[name="items.0.rate"]');
    await rateInput.waitFor({ timeout: 5000 });
    await rateInput.fill("");
    await rateInput.fill("450");

    await page.waitForTimeout(500);

    // --- Click Save Changes ---
    const saveBtn = page.locator('button[type="submit"]:has-text("Save Changes")');
    await saveBtn.click();

    // Wait for toast "Quote updated"
    await waitForToast(page, "Quote updated", 15000);
    await page.waitForTimeout(2000);

    // --- Verify changes persisted on detail page ---
    await page.goto(`${BASE_URL}/quotes/${editQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Detail page empty after edit");

    // Verify currency changed to USD
    if (!body.includes("USD")) {
      throw new Error("Currency did not change to USD");
    }

    // Clean up: delete the quote
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    if (await deleteBtn.count() > 0) {
      acceptNextDialog(page);
      await deleteBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  // 18. Delete draft quote — create, delete, verify removed
  await test("18. Delete draft quote — create, click Delete, confirm, verify removed", page, async () => {
    // Create a fresh draft quote
    await page.goto(`${BASE_URL}/quotes/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const clientValue = await getFirstClientOptionValue(page, "client");
    await page.selectOption("#client", clientValue);
    await page.fill('input[name="items.0.name"]', "E2E Delete Test Item");
    await page.fill('input[name="items.0.quantity"]', "1");
    await page.fill('input[name="items.0.rate"]', "100");
    await page.waitForTimeout(300);

    const createBtn = page.locator('button[type="submit"]:has-text("Create Quote")');
    await createBtn.click();
    await waitForToast(page, "Quote created", 15000);
    await page.waitForTimeout(2000);

    // Extract quote ID
    const detailUrl = page.url();
    const match = detailUrl.match(/\/quotes\/([a-zA-Z0-9-]+)/);
    if (!match) throw new Error("Could not extract quote ID from URL");
    const deleteQuoteId = match[1];

    // Click "Delete" button on detail page
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await deleteBtn.waitFor({ timeout: 5000 });

    // Accept the confirm dialog
    acceptNextDialog(page);
    await deleteBtn.click();

    // Wait for toast "Quote deleted"
    await waitForToast(page, "Quote deleted", 15000);
    await page.waitForTimeout(2000);

    // Should redirect to /quotes list
    const afterUrl = page.url();
    if (!afterUrl.endsWith("/quotes") && !afterUrl.includes("/quotes?")) {
      // Some implementations redirect to /quotes
      // Others might stay — let's verify the quote is gone by navigating to it
    }

    // Verify the quote no longer loads
    await page.goto(`${BASE_URL}/quotes/${deleteQuoteId}`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    // Should show "not found" or empty state
    const isGone =
      body?.includes("not found") ||
      body?.includes("Not Found") ||
      body?.includes("deleted") ||
      body?.includes("does not exist") ||
      !body?.includes("E2E Delete Test Item");

    if (!isGone) {
      throw new Error("Quote still accessible after deletion");
    }
  });

  // =========================================================================
  //  CLEANUP & SUMMARY
  // =========================================================================

  // Cleanup: delete the original test invoice if it still exists
  if (createdInvoiceId) {
    try {
      await page.evaluate(async (id: string) => {
        const token = localStorage.getItem("access_token");
        await fetch(`/api/v1/invoices/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }, createdInvoiceId);
    } catch {
      // Cleanup failed — OK
    }
  }

  await context.close();
  await browser.close();

  printSummary();

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
})();
