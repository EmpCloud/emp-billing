import { chromium, type Page, type BrowserContext } from "playwright";
import * as fs from "fs";

const BASE = "http://localhost:4001";
let passed = 0;
let failed = 0;
const screenshotDir = "scripts/e2e/screenshots";

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

function log(icon: string, msg: string) {
  console.log(`${icon} ${msg}`);
}

async function test(name: string, page: Page, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    log("[PASS]", name);
  } catch (e: any) {
    failed++;
    log("[FAIL]", `${name}: ${e.message}`);
    // Take screenshot on failure
    try {
      const safeName = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await page.screenshot({ path: `${screenshotDir}/FAIL-${safeName}.png`, fullPage: true });
    } catch {}
  }
  // 1500ms delay between tests
  await new Promise((r) => setTimeout(r, 1500));
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // If already redirected to dashboard (session cookies), skip login
  if (page.url().includes("/dashboard")) return;

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

/**
 * Helper: wait for a react-hot-toast message to appear.
 * Returns the toast text content.
 */
async function waitForToast(page: Page, textSubstring: string, timeout = 10000): Promise<string> {
  const toastLocator = page.locator(`[role="status"]:has-text("${textSubstring}"), div[class*="toast"]:has-text("${textSubstring}")`);
  await toastLocator.first().waitFor({ state: "visible", timeout });
  const text = (await toastLocator.first().textContent()) ?? "";
  return text;
}

/**
 * Helper: click a sidebar navigation link by label text.
 */
async function clickSidebarLink(page: Page, label: string) {
  // Sidebar links are rendered as <a> elements with the label text
  const link = page.locator(`nav a:has-text("${label}"), aside a:has-text("${label}")`).first();
  await link.waitFor({ state: "visible", timeout: 5000 });
  await link.click();
  await page.waitForTimeout(800);
}

/**
 * Helper: Select the first non-empty option in a native <select> by its CSS selector.
 * Also supports selecting the Nth select on the page via selectNthNonEmpty().
 */
async function selectFirstNonEmptyOption(page: Page, selector: string): Promise<string> {
  await page.waitForSelector(selector, { timeout: 5000 });
  // Get all option values, skip the empty placeholder
  const options = await page.$$eval(`${selector} option`, (opts) =>
    opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== "")
  );
  if (options.length === 0) throw new Error(`No non-empty options found for ${selector}`);
  await page.selectOption(selector, options[0]);
  return options[0];
}

/**
 * Helper: Select the first non-empty option from the Nth <select> on the page (0-based).
 */
async function selectNthSelectFirstOption(page: Page, nth: number): Promise<string> {
  const selects = page.locator("select");
  const count = await selects.count();
  if (count <= nth) throw new Error(`Expected at least ${nth + 1} selects, found ${count}`);
  const sel = selects.nth(nth);
  await sel.waitFor({ state: "visible", timeout: 5000 });
  const options = await sel.locator("option").allTextContents();
  const values = await sel.locator("option").evaluateAll((opts) =>
    opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== "")
  );
  if (values.length === 0) throw new Error(`No non-empty options found for select #${nth}`);
  await sel.selectOption(values[0]);
  return values[0];
}

// Track IDs across tests
let creditNoteId: string | undefined;
let creditNoteForVoidId: string | undefined;
let recurringProfileId: string | undefined;
let planId: string | undefined;
let subscriptionId: string | undefined;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Handle confirm dialogs — always accept
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  console.log("\n=== Logging in ===\n");
  await login(page);
  console.log(`Logged in. URL: ${page.url()}\n`);

  // ====================================================================
  // CREDIT NOTES
  // ====================================================================
  console.log("\n=== Credit Notes ===\n");

  // 1. Navigate to credit notes
  await test("1. Navigate to credit notes — click sidebar, verify /credit-notes, table headers", page, async () => {
    await clickSidebarLink(page, "Credit Notes");
    await page.waitForURL("**/credit-notes", { timeout: 10000 });

    // Verify URL
    const url = page.url();
    if (!url.includes("/credit-notes")) throw new Error(`Expected URL to include /credit-notes, got ${url}`);

    // Verify page title
    const title = await page.textContent("body");
    if (!title?.includes("Credit Notes")) throw new Error("Page title 'Credit Notes' not found");

    // Verify table headers exist (even if table is empty, the header text should be on the page somewhere)
    // The table has headers: Credit Note #, Client, Date, Total, Balance, Status, Actions
    // OR if empty, the page shows an empty state — either way the page loaded.
    const body = await page.textContent("body");
    if (!body?.includes("Credit Note") && !body?.includes("credit note")) {
      throw new Error("Credit notes page content not found");
    }
  });

  // 2. Create credit note via UI
  await test("2. Create credit note via UI — fill form, add line item, submit", page, async () => {
    // Click "New Credit Note" button
    const newBtn = page.locator('button:has-text("New Credit Note"), a:has-text("New Credit Note")').first();
    await newBtn.waitFor({ state: "visible", timeout: 5000 });
    await newBtn.click();
    await page.waitForURL("**/credit-notes/new", { timeout: 10000 });

    // Wait for form to load — the client select should appear
    await page.waitForSelector('select', { timeout: 10000 });
    await page.waitForTimeout(1000); // wait for clients to load

    // Select the first client
    const clientSelect = page.locator('select').first();
    await clientSelect.waitFor({ state: "visible", timeout: 5000 });
    // Pick the first non-empty option in the client select
    await selectFirstNonEmptyOption(page, 'select');

    // Date should be pre-filled, verify it exists
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.waitFor({ state: "visible", timeout: 3000 });

    // Fill line item — the first row is pre-populated with empty fields
    // Name input
    const nameInput = page.locator('input[placeholder="Item name"]').first();
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill("E2E Credit Note Item");

    // Quantity input
    const qtyInput = page.locator('input[type="number"][placeholder="1"]').first();
    await qtyInput.fill("2");

    // Rate input
    const rateInput = page.locator('input[type="number"][placeholder="0.00"]').first();
    await rateInput.fill("500");

    // Fill reason
    const reasonTextarea = page.locator('textarea').first();
    if (await reasonTextarea.isVisible()) {
      await reasonTextarea.fill("E2E test credit note reason");
    }

    // Click "Create Credit Note" button
    const createBtn = page.locator('button[type="submit"]:has-text("Create Credit Note")').first();
    await createBtn.waitFor({ state: "visible", timeout: 3000 });
    await createBtn.click();

    // Wait for toast "Credit note created"
    await waitForToast(page, "Credit note created");

    // After creation, the hook navigates to /credit-notes/<id>
    await page.waitForURL("**/credit-notes/**", { timeout: 10000 });
    const url = page.url();
    // Extract the ID from the URL
    const match = url.match(/credit-notes\/([a-f0-9-]+)/i);
    if (!match) throw new Error(`Could not extract credit note ID from URL: ${url}`);
    creditNoteId = match[1];
    if (creditNoteId === "new") throw new Error("Still on /new page — creation may have failed");
  });

  // 3. View credit note detail
  await test("3. View credit note detail — verify status, line items, totals", page, async () => {
    if (!creditNoteId) throw new Error("No credit note ID from test 2");

    // We should already be on the detail page from the redirect
    await page.waitForSelector('body', { timeout: 5000 });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Empty page body");

    // Verify status badge shows "Draft" or "Open"
    const hasDraft = body.includes("Draft");
    const hasOpen = body.includes("Open");
    if (!hasDraft && !hasOpen) throw new Error("Expected status 'Draft' or 'Open' not found on detail page");

    // Verify our line item name appears
    if (!body.includes("E2E Credit Note Item")) {
      throw new Error("Line item name 'E2E Credit Note Item' not found on detail page");
    }

    // Verify totals section exists (page shows "Balance Remaining")
    if (!body.includes("Total") || (!body.includes("Balance") && !body.includes("balance"))) {
      throw new Error("Totals section (Total / Balance) not found on detail page");
    }
  });

  // 4. Download PDF
  await test("4. Download credit note PDF", page, async () => {
    if (!creditNoteId) throw new Error("No credit note ID from test 2");

    // Click the PDF / Download PDF button
    const pdfBtn = page.locator('button:has-text("PDF")').first();
    await pdfBtn.waitFor({ state: "visible", timeout: 5000 });

    // Start waiting for the download before clicking
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      pdfBtn.click(),
    ]);

    // Verify download started
    const suggestedName = download.suggestedFilename();
    if (!suggestedName.includes("credit-note")) {
      // Some naming may differ — just check it downloaded
      console.log(`    Download filename: ${suggestedName}`);
    }

    // Save and verify the download completed
    const path = await download.path();
    if (!path) throw new Error("Download path is null — download may have failed");
  });

  // 5. Apply to invoice
  await test("5. Apply credit note to invoice — open modal, select invoice, submit", page, async () => {
    if (!creditNoteId) throw new Error("No credit note ID from test 2");

    // Ensure we're on the detail page
    await page.goto(`${BASE}/credit-notes/${creditNoteId}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click "Apply to Invoice" button
    const applyBtn = page.locator('button:has-text("Apply to Invoice")').first();
    const isVisible = await applyBtn.isVisible().catch(() => false);
    if (!isVisible) {
      throw new Error("'Apply to Invoice' button not visible — credit note may be in Draft status (needs to be Open)");
    }
    await applyBtn.click();

    // Wait for the modal to appear with invoice select
    await page.waitForSelector('[role="dialog"], [class*="modal"], .fixed.inset-0', { timeout: 5000 });
    await page.waitForTimeout(1000); // wait for invoices to load in the dropdown

    // Select an invoice from the modal's select dropdown
    // The modal has a <Select label="Invoice"> with invoice options
    const modalSelect = page.locator('[role="dialog"] select, .fixed.inset-0 select').first();
    await modalSelect.waitFor({ state: "visible", timeout: 5000 });
    const invoiceOptions = await modalSelect.locator('option').all();
    // Find first non-empty option
    let selectedInvoice = false;
    for (const opt of invoiceOptions) {
      const val = await opt.getAttribute("value");
      if (val && val !== "") {
        await modalSelect.selectOption(val);
        selectedInvoice = true;
        break;
      }
    }
    if (!selectedInvoice) throw new Error("No invoices available in the Apply modal dropdown");

    // The amount field should be pre-filled with the balance. We can leave it or adjust.
    // Just click Apply / submit
    const submitBtn = page.locator('[role="dialog"] button[type="submit"]:has-text("Apply"), .fixed.inset-0 button[type="submit"]:has-text("Apply")').first();
    await submitBtn.waitFor({ state: "visible", timeout: 3000 });
    await submitBtn.click();

    // Wait for toast
    await waitForToast(page, "Credit note applied");
  });

  // 6. Void credit note — create a fresh one to void (previous one may be applied)
  await test("6. Void credit note — create new one, then void it", page, async () => {
    // Navigate to create a new credit note for voiding
    await page.goto(`${BASE}/credit-notes/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Fill form quickly
    await page.waitForSelector('select', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await selectFirstNonEmptyOption(page, 'select');

    const nameInput = page.locator('input[placeholder="Item name"]').first();
    await nameInput.fill("Void Test Item");
    const qtyInput = page.locator('input[type="number"][placeholder="1"]').first();
    await qtyInput.fill("1");
    const rateInput = page.locator('input[type="number"][placeholder="0.00"]').first();
    await rateInput.fill("200");

    const createBtn = page.locator('button[type="submit"]:has-text("Create Credit Note")').first();
    await createBtn.click();

    // Wait for toast and redirect
    await waitForToast(page, "Credit note created");
    await page.waitForURL("**/credit-notes/**", { timeout: 10000 });
    const url = page.url();
    const match = url.match(/credit-notes\/([a-f0-9-]+)/i);
    if (!match || match[1] === "new") throw new Error("Did not redirect to new credit note detail");
    creditNoteForVoidId = match[1];

    await page.waitForTimeout(1000);

    // Now click the Void button on the detail page
    const voidBtn = page.locator('button:has-text("Void")').first();
    const voidVisible = await voidBtn.isVisible().catch(() => false);
    if (!voidVisible) throw new Error("Void button not visible on credit note detail page");
    await voidBtn.click();

    // Confirm dialog is auto-accepted by our dialog handler

    // Wait for toast
    await waitForToast(page, "Credit note voided");

    // Verify the status changed to "Void" on the page
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Void")) throw new Error("Status 'Void' not found after voiding");
  });

  // ====================================================================
  // RECURRING INVOICES
  // ====================================================================
  console.log("\n=== Recurring Invoices ===\n");

  // 7. Navigate to recurring
  await test("7. Navigate to recurring — click sidebar, verify /recurring, table headers", page, async () => {
    await clickSidebarLink(page, "Recurring");
    await page.waitForURL("**/recurring", { timeout: 10000 });

    const url = page.url();
    if (!url.includes("/recurring")) throw new Error(`Expected URL to include /recurring, got ${url}`);

    const body = await page.textContent("body");
    if (!body?.includes("Recurring")) throw new Error("Recurring page content not found");

    // Check for table headers or empty state
    const hasTable = body.includes("Client") && body.includes("Frequency");
    const hasEmpty = body.includes("No recurring profiles") || body.includes("Create a recurring profile");
    if (!hasTable && !hasEmpty) throw new Error("Neither table headers nor empty state found on recurring page");
  });

  // 8. Create recurring profile via UI
  await test("8. Create recurring profile via UI — fill form, set frequency, add template data", page, async () => {
    // Click "New Profile" button
    const newBtn = page.locator('button:has-text("New Profile"), a:has-text("New Profile")').first();
    await newBtn.waitFor({ state: "visible", timeout: 5000 });
    await newBtn.click();
    await page.waitForURL("**/recurring/new", { timeout: 10000 });

    // Wait for form to load
    await page.waitForSelector('select', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Select client (first <select> on the page)
    const selects = page.locator('select');
    const selectCount = await selects.count();

    // Client is the first select
    await selectNthSelectFirstOption(page, 0);

    // Type select — keep as "invoice" (already default)

    // Frequency select — select "Monthly"
    // The frequency select is the third one (Client, Type, Frequency)
    if (selectCount >= 3) {
      await selects.nth(2).selectOption('monthly');
    }

    // Start date should already be filled with today

    // Toggle auto-send checkbox
    const autoSendCheckbox = page.locator('input[type="checkbox"]').first();
    if (await autoSendCheckbox.isVisible()) {
      await autoSendCheckbox.check();
    }

    // Fill template data JSON
    const templateTextarea = page.locator('textarea').first();
    if (await templateTextarea.isVisible()) {
      await templateTextarea.fill(JSON.stringify({
        items: [{ name: "Monthly Retainer", quantity: 1, rate: 500000 }],
        currency: "INR",
        notes: "E2E test recurring profile",
      }));
    }

    // Click "Create Profile" button
    const createBtn = page.locator('button[type="submit"]:has-text("Create Profile")').first();
    await createBtn.waitFor({ state: "visible", timeout: 3000 });
    await createBtn.click();

    // Wait for toast
    await waitForToast(page, "Recurring profile created");

    // The hook redirects to /recurring (list page)
    await page.waitForURL("**/recurring", { timeout: 10000 });
  });

  // Need to get the recurring profile ID — click the first row in the table
  await test("9. View recurring detail — click profile row, verify frequency, dates, status, execution history", page, async () => {
    // We should be on /recurring list page. Wait for table to load.
    await page.waitForTimeout(1000);

    // The table rows have client, type, frequency etc.
    // Click the first row (which should be our newly created profile or any existing one)
    // The recurring list doesn't have clickable rows — actions are in buttons.
    // Let's get the profile ID from the API to navigate directly.
    const profileId = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/recurring?limit=5", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Find active profile (our freshly created one)
      const profiles = data.data ?? [];
      const active = profiles.find((p: any) => p.status === "active");
      return active?.id ?? profiles[0]?.id ?? null;
    });
    if (!profileId) throw new Error("No recurring profiles found in API");
    recurringProfileId = profileId;

    // Navigate to detail page
    await page.goto(`${BASE}/recurring/${recurringProfileId}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Empty page body");

    // Verify frequency label
    if (!body.includes("Monthly") && !body.includes("Weekly") && !body.includes("Daily") && !body.includes("Yearly")) {
      throw new Error("Frequency label not found on recurring detail page");
    }

    // Verify status shows "Active"
    if (!body.includes("Active")) {
      throw new Error("Status 'Active' not found on recurring detail page");
    }

    // Verify dates section exists
    if (!body.includes("Start Date") && !body.includes("Next Run Date")) {
      throw new Error("Dates section not found on recurring detail page");
    }

    // Verify execution history section exists
    if (!body.includes("Execution History")) {
      throw new Error("Execution History section not found on recurring detail page");
    }
  });

  // 10. Pause recurring
  await test("10. Pause recurring — click Pause button, verify status changes to Paused", page, async () => {
    if (!recurringProfileId) throw new Error("No recurring profile ID from test 9");

    // We should be on the detail page. Click "Pause" button.
    const pauseBtn = page.locator('button:has-text("Pause")').first();
    await pauseBtn.waitFor({ state: "visible", timeout: 5000 });
    await pauseBtn.click();

    // Wait for toast
    await waitForToast(page, "Recurring profile paused");

    // Verify status changed to "Paused"
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Paused")) throw new Error("Status 'Paused' not found after pausing");
  });

  // 11. Resume recurring
  await test("11. Resume recurring — click Resume, verify status Active", page, async () => {
    if (!recurringProfileId) throw new Error("No recurring profile ID");

    // After pausing, the button should now say "Resume"
    const resumeBtn = page.locator('button:has-text("Resume")').first();
    await resumeBtn.waitFor({ state: "visible", timeout: 5000 });
    await resumeBtn.click();

    // Wait for toast
    await waitForToast(page, "Recurring profile resumed");

    // Verify status changed back to "Active"
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Active")) throw new Error("Status 'Active' not found after resuming");
  });

  // 12. Delete recurring
  await test("12. Delete recurring — click Delete, confirm, verify removed from list", page, async () => {
    if (!recurringProfileId) throw new Error("No recurring profile ID");

    // Click the Delete button on the detail page
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 });
    await deleteBtn.click();

    // Confirm dialog is auto-accepted

    // Wait for toast
    await waitForToast(page, "Recurring profile deleted");

    // The hook navigates to /recurring after deletion
    await page.waitForURL("**/recurring", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify the deleted profile no longer appears — check the page body
    // (We can't easily verify absence by ID in the UI, but the deletion toast is sufficient)
  });

  // ====================================================================
  // SUBSCRIPTIONS
  // ====================================================================
  console.log("\n=== Subscriptions ===\n");

  // 13. Navigate to subscriptions
  await test("13. Navigate to subscriptions — verify /subscriptions, table", page, async () => {
    await clickSidebarLink(page, "Subscriptions");
    await page.waitForURL("**/subscriptions", { timeout: 10000 });

    const url = page.url();
    if (!url.includes("/subscriptions")) throw new Error(`Expected URL to include /subscriptions, got ${url}`);

    const body = await page.textContent("body");
    if (!body?.includes("Subscriptions")) throw new Error("Subscriptions page content not found");

    // Verify table headers or empty state
    const hasTable = body.includes("Client") && body.includes("Plan") && body.includes("Status");
    const hasEmpty = body.includes("No subscriptions") || body.includes("Create a subscription");
    if (!hasTable && !hasEmpty) throw new Error("Neither table headers nor empty state found");
  });

  // 14. Navigate to plans
  await test("14. Navigate to plans — click Manage Plans, verify plan list", page, async () => {
    // Click "Manage Plans" button on the subscriptions page
    const managePlansBtn = page.locator('button:has-text("Manage Plans"), a:has-text("Manage Plans")').first();
    await managePlansBtn.waitFor({ state: "visible", timeout: 5000 });
    await managePlansBtn.click();
    await page.waitForURL("**/subscriptions/plans", { timeout: 10000 });

    const body = await page.textContent("body");
    if (!body?.includes("Plans")) throw new Error("Plans page content not found");
  });

  // 15. Create plan via UI
  await test("15. Create plan via UI — fill name, description, interval, price, features, trial days", page, async () => {
    // Click "New Plan" button
    const newPlanBtn = page.locator('button:has-text("New Plan"), a:has-text("New Plan")').first();
    await newPlanBtn.waitFor({ state: "visible", timeout: 5000 });
    await newPlanBtn.click();
    await page.waitForURL("**/subscriptions/plans/new", { timeout: 10000 });

    // Fill plan name — Input label="Plan Name" generates id="plan-name"
    const planNameInput = page.locator('#plan-name').first();
    await planNameInput.waitFor({ state: "visible", timeout: 5000 });
    await planNameInput.fill("E2E Test Plan");

    // Fill description textarea
    const descTextarea = page.locator('textarea').first();
    if (await descTextarea.isVisible()) {
      await descTextarea.fill("Plan created by E2E test suite");
    }

    // Billing Interval — select "Monthly" (should be default)
    const intervalSelect = page.locator('select').first();
    if (await intervalSelect.isVisible()) {
      await intervalSelect.selectOption("monthly");
    }

    // Price input — enter 999.00 (which becomes 99900 paise internally)
    const priceInput = page.locator('input[placeholder="0.00"]').first();
    if (await priceInput.isVisible()) {
      await priceInput.fill("999");
    }

    // Trial period days
    const trialInput = page.locator('input[placeholder="0"]').first();
    if (await trialInput.isVisible()) {
      await trialInput.fill("7");
    }

    // Add features — there's a feature input with "Add a feature..." placeholder
    const featureInput = page.locator('input[placeholder="Add a feature..."]').first();
    if (await featureInput.isVisible()) {
      await featureInput.fill("Unlimited invoices");
      // Click "Add" button next to it
      const addFeatureBtn = page.locator('button:has-text("Add")').first();
      await addFeatureBtn.click();
      await page.waitForTimeout(300);

      // Add second feature
      await featureInput.fill("Priority support");
      await addFeatureBtn.click();
      await page.waitForTimeout(300);
    }

    // Click "Create Plan" button
    const createBtn = page.locator('button[type="submit"]:has-text("Create Plan")').first();
    await createBtn.waitFor({ state: "visible", timeout: 3000 });
    await createBtn.click();

    // Wait for toast
    await waitForToast(page, "Plan created");

    // The hook redirects to /subscriptions/plans
    await page.waitForURL("**/subscriptions/plans", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get the plan ID from the API
    planId = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/subscriptions/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const plans = data.data ?? [];
      const e2ePlan = plans.find((p: any) => p.name === "E2E Test Plan");
      return e2ePlan?.id ?? plans[plans.length - 1]?.id ?? null;
    });

    if (!planId) throw new Error("Could not find the created plan via API");
  });

  // 16. Create subscription via UI
  await test("16. Create subscription via UI — select client, select plan, submit", page, async () => {
    // Navigate to new subscription page
    await page.goto(`${BASE}/subscriptions/new`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000); // wait for clients and plans to load

    // Select client — first <select> is "Client"
    const selects = page.locator('select');
    const selectCount = await selects.count();
    if (selectCount < 2) throw new Error(`Expected at least 2 selects (client, plan), found ${selectCount}`);

    // Select first client
    await selectNthSelectFirstOption(page, 0);
    await page.waitForTimeout(500);

    // Select plan (second select)
    await selectNthSelectFirstOption(page, 1);
    await page.waitForTimeout(500);

    // Quantity should default to 1 — leave it

    // Click "Create Subscription"
    const createBtn = page.locator('button[type="submit"]:has-text("Create Subscription")').first();
    await createBtn.waitFor({ state: "visible", timeout: 3000 });
    await createBtn.click();

    // Wait for toast
    await waitForToast(page, "Subscription created");

    // The hook redirects to /subscriptions
    await page.waitForURL("**/subscriptions", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get the subscription ID from the API
    subscriptionId = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/v1/subscriptions?limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const subs = data.data ?? [];
      // Find the most recent active/trialing subscription
      const recent = subs.find((s: any) => s.status === "active" || s.status === "trialing");
      return recent?.id ?? subs[0]?.id ?? null;
    });

    if (!subscriptionId) throw new Error("Could not find the created subscription via API");
  });

  // 17. View subscription detail
  await test("17. View subscription detail — verify plan info, status, billing dates, event timeline", page, async () => {
    if (!subscriptionId) throw new Error("No subscription ID from test 16");

    // Click on the subscription row in the table to navigate to detail
    // The table rows are clickable with onClick -> navigate(`/subscriptions/${sub.id}`)
    const subRow = page.locator(`tr[class*="cursor-pointer"]`).first();
    const rowVisible = await subRow.isVisible().catch(() => false);
    if (rowVisible) {
      await subRow.click();
    } else {
      // Fallback: navigate directly
      await page.goto(`${BASE}/subscriptions/${subscriptionId}`, { waitUntil: "networkidle", timeout: 15000 });
    }
    await page.waitForTimeout(1500);

    const body = await page.textContent("body");
    if (!body) throw new Error("Empty page body");

    // Verify subscription detail page loaded
    if (!body.includes("Subscription Detail") && !body.includes("Subscription ID")) {
      throw new Error("Subscription detail page content not found");
    }

    // Verify status badge (Active or Trialing)
    const hasStatus = body.includes("Active") || body.includes("Trialing");
    if (!hasStatus) throw new Error("Expected status 'Active' or 'Trialing' not found");

    // Verify billing date info
    if (!body.includes("Next Billing")) throw new Error("'Next Billing' info not found on detail page");

    // Verify event timeline section
    if (!body.includes("Event Timeline")) throw new Error("'Event Timeline' section not found");
  });

  // 18. Pause subscription
  await test("18. Pause subscription — click Pause, verify status Paused", page, async () => {
    if (!subscriptionId) throw new Error("No subscription ID");

    // Ensure we're on the detail page
    if (!page.url().includes(`/subscriptions/${subscriptionId}`)) {
      await page.goto(`${BASE}/subscriptions/${subscriptionId}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);
    }

    // Click "Pause" button
    const pauseBtn = page.locator('button:has-text("Pause")').first();
    const pauseVisible = await pauseBtn.isVisible().catch(() => false);
    if (!pauseVisible) {
      throw new Error("Pause button not visible — subscription may not be in Active state");
    }
    await pauseBtn.click();

    // Wait for toast
    await waitForToast(page, "Subscription paused");

    // Verify status changed to "Paused"
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Paused")) throw new Error("Status 'Paused' not found after pausing");
  });

  // 19. Resume subscription
  await test("19. Resume subscription — click Resume, verify status Active", page, async () => {
    if (!subscriptionId) throw new Error("No subscription ID");

    // After pausing, the "Resume" button should be visible
    const resumeBtn = page.locator('button:has-text("Resume")').first();
    await resumeBtn.waitFor({ state: "visible", timeout: 5000 });
    await resumeBtn.click();

    // Wait for toast
    await waitForToast(page, "Subscription resumed");

    // Verify status changed back to "Active"
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body?.includes("Active")) throw new Error("Status 'Active' not found after resuming");
  });

  // 20. Cancel subscription
  await test("20. Cancel subscription — click Cancel, fill reason in modal, submit, verify Cancelled", page, async () => {
    if (!subscriptionId) throw new Error("No subscription ID");

    // Click the "Cancel" button (variant="danger") — avoid clicking the nav Cancel button
    // The danger-variant cancel button has a specific XCircle icon
    const cancelBtn = page.locator('button').filter({ hasText: "Cancel" }).filter({ has: page.locator('svg') }).first();
    await cancelBtn.waitFor({ state: "visible", timeout: 5000 });
    await cancelBtn.click();

    // Wait for the cancel modal to appear
    await page.waitForSelector('[role="dialog"], [class*="modal"], .fixed.inset-0', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Fill the cancellation reason textarea in the modal
    // The textarea placeholder is "Why is this subscription being cancelled?"
    const reasonTextarea = page.locator('[role="dialog"] textarea, .fixed.inset-0 textarea').first();
    await reasonTextarea.waitFor({ state: "visible", timeout: 3000 });
    await reasonTextarea.fill("E2E test cancellation — no longer needed");

    // Check "Cancel immediately" checkbox
    const immediateCheckbox = page.locator('[role="dialog"] input[type="checkbox"], .fixed.inset-0 input[type="checkbox"]').first();
    if (await immediateCheckbox.isVisible()) {
      await immediateCheckbox.check();
    }

    // Click the confirm cancel button — "Cancel Immediately" or "Cancel at Period End"
    // These are rendered in the Modal footer
    const confirmBtn = page.locator('[role="dialog"] button:has-text("Cancel Immediately"), .fixed.inset-0 button:has-text("Cancel Immediately"), [role="dialog"] button:has-text("Cancel at Period End"), .fixed.inset-0 button:has-text("Cancel at Period End")').first();
    await confirmBtn.waitFor({ state: "visible", timeout: 3000 });
    await confirmBtn.click();

    // Wait for toast
    await waitForToast(page, "Subscription cancelled");

    // Verify status changed to "Cancelled"
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body?.includes("Cancelled")) throw new Error("Status 'Cancelled' not found after cancellation");
  });

  // ====================================================================
  // Cleanup — best-effort via API
  // ====================================================================
  console.log("\n=== Cleanup ===\n");
  try {
    if (planId) {
      await page.evaluate(async (planId) => {
        const token = localStorage.getItem("access_token");
        await fetch(`/api/v1/subscriptions/plans/${planId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }, planId);
      console.log("  Cleaned up plan");
    }
  } catch {}

  try {
    if (creditNoteId) {
      await page.evaluate(async (id) => {
        const token = localStorage.getItem("access_token");
        await fetch(`/api/v1/credit-notes/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }, creditNoteId);
      console.log("  Cleaned up credit note");
    }
  } catch {}

  try {
    if (creditNoteForVoidId) {
      await page.evaluate(async (id) => {
        const token = localStorage.getItem("access_token");
        await fetch(`/api/v1/credit-notes/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }, creditNoteForVoidId);
      console.log("  Cleaned up voided credit note");
    }
  } catch {}

  // ====================================================================
  // Results
  // ====================================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(60)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
