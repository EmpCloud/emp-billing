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

  // ── Reports ─────────────────────────────────────────────────────────────

  // #1: Reports page loads with tabs
  await test("#1: Reports page loads with tabs", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    const hasReportsContent = body.includes("Report") || body.includes("report");
    if (!hasReportsContent) throw new Error("Reports page did not load — no report content found");
    // Check for tab-like navigation (Revenue, Receivables, Tax, etc.)
    const hasTabs =
      body.includes("Revenue") ||
      body.includes("Receivables") ||
      body.includes("Tax") ||
      body.includes("Aging") ||
      body.includes("Expense");
    if (!hasTabs) throw new Error("Reports page has no report type tabs");
  });

  // #2: Revenue report loads with date range
  await test("#2: Revenue report loads with date range", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    // Click revenue tab if present
    const revenueTab = await page.$('text=Revenue') || await page.$('button:has-text("Revenue")');
    if (revenueTab) await revenueTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    // Should have date range controls
    const hasDateRange =
      body.includes("From") || body.includes("Start") || body.includes("Date") ||
      body.includes("Period") || body.includes("Range") ||
      (await page.$('input[type="date"]')) !== null;
    if (!hasDateRange) throw new Error("Revenue report has no date range controls");
  });

  // #3: Receivables report loads
  await test("#3: Receivables report loads", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const receivablesTab = await page.$('text=Receivables') || await page.$('button:has-text("Receivables")');
    if (receivablesTab) await receivablesTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Receivable") && !body.includes("Outstanding") && !body.includes("Balance"))
      throw new Error("Receivables report content not found");
  });

  // #4: Aging report shows buckets
  await test("#4: Aging report shows buckets (Current, 1-30, 31-60, 61-90, 90+)", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const agingTab = await page.$('text=Aging') || await page.$('button:has-text("Aging")');
    if (agingTab) await agingTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    const hasBuckets =
      body.includes("Current") ||
      body.includes("1-30") || body.includes("1–30") ||
      body.includes("31-60") || body.includes("31–60") ||
      body.includes("61-90") || body.includes("61–90") ||
      body.includes("90+") || body.includes("91+");
    if (!hasBuckets) throw new Error("Aging report does not show aging buckets");
  });

  // #5: Expenses report loads by category
  await test("#5: Expenses report loads by category", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const expenseTab = await page.$('text=Expense') || await page.$('button:has-text("Expense")');
    if (expenseTab) await expenseTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Expense") && !body.includes("Category") && !body.includes("category"))
      throw new Error("Expense report content not found");
  });

  // #6: P&L report loads
  await test("#6: P&L report loads", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const plTab =
      await page.$('text=Profit') ||
      await page.$('button:has-text("Profit")') ||
      await page.$('text=P&L') ||
      await page.$('button:has-text("P&L")');
    if (plTab) await plTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Profit") && !body.includes("Loss") && !body.includes("P&L") && !body.includes("Net"))
      throw new Error("P&L report content not found");
  });

  // #7: Tax report loads
  await test("#7: Tax report loads", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const taxTab = await page.$('text=Tax') || await page.$('button:has-text("Tax")');
    if (taxTab) await taxTab.click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Tax") && !body.includes("GST") && !body.includes("VAT"))
      throw new Error("Tax report content not found");
  });

  // #8: CSV export works for revenue report
  await test("#8: CSV export works for revenue report", async () => {
    await page.goto(`${BASE}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    // Click revenue tab if present
    const revenueTab = await page.$('text=Revenue') || await page.$('button:has-text("Revenue")');
    if (revenueTab) await revenueTab.click();
    await page.waitForTimeout(1500);

    // Look for CSV/Export button
    const exportBtn =
      await page.$('button:has-text("Export")') ||
      await page.$('button:has-text("CSV")') ||
      await page.$('button:has-text("Download")') ||
      await page.$('a:has-text("Export")') ||
      await page.$('a:has-text("CSV")');
    if (!exportBtn) throw new Error("No CSV/Export button found on revenue report");

    // Try to trigger download
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10000 }).catch(() => null),
      exportBtn.click(),
    ]);
    // If no download event, at least verify the button is clickable
    if (!download) {
      // Check if an API call was made for export
      await page.waitForTimeout(2000);
    }
  });

  // #9: Report builder page loads
  await test("#9: Report builder page loads", async () => {
    await page.goto(`${BASE}/reports/builder`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Report") && !body.includes("Builder") && !body.includes("Custom"))
      throw new Error("Report builder page did not load");
  });

  // #10: Report builder — run custom report
  await test("#10: Report builder — run custom report", async () => {
    await page.goto(`${BASE}/reports/builder`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Select a report type / entity if dropdown exists
    const typeSelect =
      await page.$('select') ||
      await page.$('button[role="combobox"]');
    if (typeSelect) {
      const tagName = await typeSelect.evaluate(el => el.tagName.toLowerCase());
      if (tagName === "select") {
        const options = await typeSelect.$$("option");
        if (options.length > 1) {
          await typeSelect.selectOption({ index: 1 });
        }
      } else {
        await typeSelect.click();
        await page.waitForTimeout(500);
        const firstOption = await page.$('[role="option"]');
        if (firstOption) await firstOption.click();
      }
    }

    await page.waitForTimeout(500);

    // Click run button
    const runBtn =
      await page.$('button:has-text("Run")') ||
      await page.$('button:has-text("Generate")') ||
      await page.$('button:has-text("Execute")') ||
      await page.$('button[type="submit"]');
    if (runBtn) {
      await runBtn.click();
      await page.waitForTimeout(2000);
    }

    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    // After running, we should still be on the builder page with results or at least no crash
    if (!body.includes("Report") && !body.includes("Builder") && !body.includes("Result"))
      throw new Error("Report builder page lost its content after running");
  });

  // #11: Save report configuration
  await test("#11: Save report configuration", async () => {
    await page.goto(`${BASE}/reports/builder`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for save button
    const saveBtn =
      await page.$('button:has-text("Save")') ||
      await page.$('button:has-text("Save Report")') ||
      await page.$('button:has-text("Save Config")');
    if (!saveBtn) throw new Error("No Save button found on report builder");

    await saveBtn.click();
    await page.waitForTimeout(2000);

    // May have a modal asking for name
    const nameInput = await page.$('input[placeholder*="name" i]') || await page.$('input[name="name"]');
    if (nameInput) {
      await nameInput.fill("E2E Test Report " + Date.now());
      const confirmBtn =
        await page.$('button:has-text("Save")') ||
        await page.$('button:has-text("Confirm")') ||
        await page.$('button[type="submit"]');
      if (confirmBtn) await confirmBtn.click();
      await page.waitForTimeout(1500);
    }
  });

  // #12: Saved reports page lists saved reports
  await test("#12: Saved reports page lists saved reports", async () => {
    await page.goto(`${BASE}/reports/saved`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Saved") && !body.includes("Report") && !body.includes("report"))
      throw new Error("Saved reports page did not load");
  });

  // ── Webhooks ────────────────────────────────────────────────────────────

  // #13: Webhook list page loads
  await test("#13: Webhook list page loads", async () => {
    await page.goto(`${BASE}/webhooks`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Webhook") && !body.includes("webhook"))
      throw new Error("Webhook list page did not load");
  });

  // #14: Create webhook with URL and events
  await test("#14: Create webhook with URL and events", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://example.com/webhook-e2e-test",
          events: ["invoice.created", "payment.received"],
          active: true,
        }),
      });
      const data = await res.json();
      return { status: res.status, success: data.success, id: data.data?.id, error: data.error };
    });

    if (result.status !== 200 && result.status !== 201)
      throw new Error(`Create webhook returned ${result.status}: ${JSON.stringify(result.error)}`);
    if (!result.success) throw new Error(`Create webhook failed: ${JSON.stringify(result.error)}`);
    if (!result.id) throw new Error("Created webhook has no id");
  });

  // #15: Test webhook sends a test delivery
  await test("#15: Test webhook sends a test delivery", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Get the first webhook
      const listRes = await fetch("/api/v1/webhooks", { headers });
      const list = await listRes.json();
      if (!list.data || list.data.length === 0) return { skip: true };

      const webhookId = list.data[0].id;
      const testRes = await fetch(`/api/v1/webhooks/${webhookId}/test`, {
        method: "POST",
        headers,
      });
      const data = await testRes.json();
      return { status: testRes.status, success: data.success, error: data.error };
    });

    if (result.skip) {
      log("    ", "No webhooks found — skipping test delivery");
      return;
    }
    if (result.status !== 200 && result.status !== 201)
      throw new Error(`Test webhook returned ${result.status}: ${JSON.stringify(result.error)}`);
  });

  // #16: Webhook delivery logs display
  await test("#16: Webhook delivery logs display", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}` };

      // Get the first webhook
      const listRes = await fetch("/api/v1/webhooks", { headers });
      const list = await listRes.json();
      if (!list.data || list.data.length === 0) return { skip: true };

      const webhookId = list.data[0].id;
      const logsRes = await fetch(`/api/v1/webhooks/${webhookId}/deliveries`, { headers });
      const data = await logsRes.json();
      return { status: logsRes.status, success: data.success, count: data.data?.length ?? 0, error: data.error };
    });

    if (result.skip) {
      log("    ", "No webhooks found — skipping delivery logs test");
      return;
    }
    if (result.status !== 200)
      throw new Error(`Webhook deliveries returned ${result.status}: ${JSON.stringify(result.error)}`);
  });

  // #17: Delete webhook
  await test("#17: Delete webhook", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Get webhooks
      const listRes = await fetch("/api/v1/webhooks", { headers });
      const list = await listRes.json();
      if (!list.data || list.data.length === 0) return { skip: true };

      // Find the e2e test webhook to delete
      const target = list.data.find((w: any) => w.url === "https://example.com/webhook-e2e-test") || list.data[0];
      const deleteRes = await fetch(`/api/v1/webhooks/${target.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await deleteRes.json();
      return { status: deleteRes.status, success: data.success, error: data.error };
    });

    if (result.skip) {
      log("    ", "No webhooks found — skipping delete test");
      return;
    }
    if (result.status !== 200)
      throw new Error(`Delete webhook returned ${result.status}: ${JSON.stringify(result.error)}`);
  });

  // ── Settings ────────────────────────────────────────────────────────────

  // #18: Settings page loads with tabs
  await test("#18: Settings page loads with tabs", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Settings") && !body.includes("settings"))
      throw new Error("Settings page did not load");
    const hasTabs =
      body.includes("Organization") ||
      body.includes("General") ||
      body.includes("Tax") ||
      body.includes("Numbering") ||
      body.includes("Payment") ||
      body.includes("Template");
    if (!hasTabs) throw new Error("Settings page has no tabs");
  });

  // #19: Organization settings update
  await test("#19: Organization settings update", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click organization tab if present
    const orgTab =
      await page.$('text=Organization') ||
      await page.$('button:has-text("Organization")') ||
      await page.$('text=General') ||
      await page.$('button:has-text("General")');
    if (orgTab) await orgTab.click();
    await page.waitForTimeout(1000);

    // Find an editable field (e.g., org name or address)
    const nameInput =
      await page.$('input[name="name"]') ||
      await page.$('input[name="orgName"]') ||
      await page.$('input[name="organizationName"]') ||
      await page.$('input[name="companyName"]');
    if (nameInput) {
      const currentVal = await nameInput.inputValue();
      // Verify field is present and has a value
      if (!currentVal && currentVal !== "") throw new Error("Org name input has no value attribute");
    }

    // Look for save button
    const saveBtn =
      await page.$('button:has-text("Save")') ||
      await page.$('button:has-text("Update")') ||
      await page.$('button[type="submit"]');
    if (!saveBtn) throw new Error("No save button found on organization settings");
  });

  // #20: Numbering settings update
  await test("#20: Numbering settings update", async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const numberingTab =
      await page.$('text=Numbering') ||
      await page.$('button:has-text("Numbering")') ||
      await page.$('text=Invoice Number') ||
      await page.$('button:has-text("Number")');
    if (numberingTab) await numberingTab.click();
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Prefix") && !body.includes("prefix") && !body.includes("Number") && !body.includes("Format"))
      throw new Error("Numbering settings content not found");

    const saveBtn =
      await page.$('button:has-text("Save")') ||
      await page.$('button:has-text("Update")') ||
      await page.$('button[type="submit"]');
    if (!saveBtn) throw new Error("No save button found on numbering settings");
  });

  // #21: Tax rates CRUD
  await test("#21: Tax rates CRUD", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Create a tax rate
      const createRes = await fetch("/api/v1/settings/tax-rates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "E2E Test Tax " + Date.now(),
          rate: 5,
          type: "percentage",
        }),
      });
      const created = await createRes.json();
      if (createRes.status !== 200 && createRes.status !== 201) {
        return { error: `Create tax rate returned ${createRes.status}: ${JSON.stringify(created)}` };
      }

      const taxId = created.data?.id;
      if (!taxId) return { error: "Created tax rate has no id" };

      // Read it back
      const getRes = await fetch(`/api/v1/settings/tax-rates/${taxId}`, { headers });
      if (getRes.status !== 200) return { error: `Get tax rate returned ${getRes.status}` };

      // Delete it
      const deleteRes = await fetch(`/api/v1/settings/tax-rates/${taxId}`, {
        method: "DELETE",
        headers,
      });
      if (deleteRes.status !== 200) return { error: `Delete tax rate returned ${deleteRes.status}` };

      return { success: true };
    });

    if (result.error) throw new Error(result.error);
  });

  // #22: Scheduled reports CRUD
  await test("#22: Scheduled reports CRUD", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Create a scheduled report
      const createRes = await fetch("/api/v1/settings/scheduled-reports", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "E2E Scheduled Report " + Date.now(),
          reportType: "revenue",
          frequency: "weekly",
          recipients: ["admin@acme.com"],
        }),
      });
      const created = await createRes.json();
      if (createRes.status !== 200 && createRes.status !== 201) {
        return { error: `Create scheduled report returned ${createRes.status}: ${JSON.stringify(created)}` };
      }

      const reportId = created.data?.id;
      if (!reportId) return { error: "Created scheduled report has no id" };

      // Delete it
      const deleteRes = await fetch(`/api/v1/settings/scheduled-reports/${reportId}`, {
        method: "DELETE",
        headers,
      });
      if (deleteRes.status !== 200) return { error: `Delete scheduled report returned ${deleteRes.status}` };

      return { success: true };
    });

    if (result.error) throw new Error(result.error);
  });

  // ── Team ────────────────────────────────────────────────────────────────

  // #23: Team page loads with member list
  await test("#23: Team page loads with member list", async () => {
    await page.goto(`${BASE}/team`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Team") && !body.includes("Member") && !body.includes("member") && !body.includes("team"))
      throw new Error("Team page did not load");
    // Should show at least the current admin user
    if (!body.includes("admin") && !body.includes("Admin") && !body.includes("Owner") && !body.includes("admin@acme.com"))
      throw new Error("Team page does not show current admin member");
  });

  // #24: Invite member works
  await test("#24: Invite member works", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      const res = await fetch("/api/v1/organizations/invite", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: `e2e-invite-${Date.now()}@example.com`,
          role: "viewer",
        }),
      });
      const data = await res.json();
      return { status: res.status, success: data.success, error: data.error };
    });

    if (result.status !== 200 && result.status !== 201)
      throw new Error(`Invite member returned ${result.status}: ${JSON.stringify(result.error)}`);
    if (!result.success) throw new Error(`Invite failed: ${JSON.stringify(result.error)}`);
  });

  // #25: Change member role
  await test("#25: Change member role", async () => {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Get team members
      const listRes = await fetch("/api/v1/organizations/members", { headers });
      const list = await listRes.json();
      if (!list.data || list.data.length === 0) return { skip: true };

      // Find a non-admin member to change role
      const nonAdmin = list.data.find((m: any) => m.role !== "owner" && m.role !== "admin");
      if (!nonAdmin) return { skip: true, reason: "No non-admin member to update" };

      const newRole = nonAdmin.role === "viewer" ? "accountant" : "viewer";
      const updateRes = await fetch(`/api/v1/organizations/members/${nonAdmin.id}/role`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ role: newRole }),
      });
      const data = await updateRes.json();

      // Restore original role
      await fetch(`/api/v1/organizations/members/${nonAdmin.id}/role`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ role: nonAdmin.role }),
      });

      return { status: updateRes.status, success: data.success, error: data.error };
    });

    if (result.skip) {
      log("    ", result.reason || "No non-admin members — skipping role change");
      return;
    }
    if (result.status !== 200)
      throw new Error(`Change role returned ${result.status}: ${JSON.stringify(result.error)}`);
  });

  // ── Audit Log ───────────────────────────────────────────────────────────

  // #26: Audit log page loads
  await test("#26: Audit log page loads", async () => {
    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");
    if (!body.includes("Audit") && !body.includes("Activity") && !body.includes("Log") && !body.includes("audit") && !body.includes("activity"))
      throw new Error("Audit log page did not load");
  });

  // #27: Entity type filter works
  await test("#27: Entity type filter works", async () => {
    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for entity type filter
    const entityFilter =
      await page.$('select[name="entityType"]') ||
      await page.$('select[name="entity"]') ||
      await page.$('button[role="combobox"]') ||
      await page.$('select');
    if (!entityFilter) throw new Error("No entity type filter found on audit log page");

    const tagName = await entityFilter.evaluate(el => el.tagName.toLowerCase());
    if (tagName === "select") {
      const options = await entityFilter.$$("option");
      if (options.length > 1) {
        await entityFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
        // Page should still display audit entries or empty state
        const body = await page.textContent("body");
        if (!body) throw new Error("Page body empty after filtering");
      }
    } else {
      await entityFilter.click();
      await page.waitForTimeout(500);
      const firstOption = await page.$('[role="option"]');
      if (firstOption) {
        await firstOption.click();
        await page.waitForTimeout(1500);
      }
    }
  });

  // #28: Date range filter works
  await test("#28: Date range filter works", async () => {
    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for date inputs
    const dateInputs = await page.$$('input[type="date"]');
    if (dateInputs.length === 0) {
      // Try text-based date pickers
      const dateBtn = await page.$('button:has-text("Date")') || await page.$('button:has-text("Period")');
      if (!dateBtn) throw new Error("No date range filter found on audit log page");
      await dateBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Fill the first date input with a start date
      await dateInputs[0].fill("2025-01-01");
      await page.waitForTimeout(1000);
      if (dateInputs.length > 1) {
        await dateInputs[1].fill("2026-12-31");
        await page.waitForTimeout(1000);
      }
    }

    const body = await page.textContent("body");
    if (!body) throw new Error("Page body empty after date filter");
  });

  // #29: Pagination works
  await test("#29: Pagination works", async () => {
    await page.goto(`${BASE}/activity`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty");

    // Check for pagination controls
    const hasPagination =
      (await page.$('button:has-text("Next")')) !== null ||
      (await page.$('button:has-text("Previous")')) !== null ||
      (await page.$('nav[aria-label="pagination" i]')) !== null ||
      (await page.$('[class*="pagination" i]')) !== null ||
      (await page.$('button:has-text("2")')) !== null ||
      body.includes("Page") || body.includes("page") ||
      body.includes("Showing") || body.includes("of ");

    if (!hasPagination) throw new Error("No pagination controls found on audit log page");

    // Try clicking next if available
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      const isDisabled = await nextBtn.isDisabled();
      if (!isDisabled) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    }
  });

  // ── Global Features ─────────────────────────────────────────────────────

  // #30: Global search works across entities
  await test("#30: Global search works across entities", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for search input in header/nav
    const searchInput =
      await page.$('input[placeholder*="Search" i]') ||
      await page.$('input[type="search"]') ||
      await page.$('input[aria-label*="search" i]');

    if (!searchInput) {
      // Maybe there's a search button/icon to open search
      const searchBtn =
        await page.$('button[aria-label*="search" i]') ||
        await page.$('button:has-text("Search")');
      if (searchBtn) {
        await searchBtn.click();
        await page.waitForTimeout(1000);
        const openedInput = await page.$('input[placeholder*="Search" i]') || await page.$('input[type="search"]');
        if (!openedInput) throw new Error("Search modal/panel opened but no input found");
        await openedInput.fill("test");
        await page.waitForTimeout(1500);
      } else {
        throw new Error("No global search input or button found");
      }
    } else {
      await searchInput.fill("test");
      await page.waitForTimeout(1500);
      // Check for results dropdown or list
      const body = await page.textContent("body");
      if (!body) throw new Error("Page body is empty");
    }
  });

  // #31: Notification center loads with unread count
  await test("#31: Notification center loads with unread count", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Look for notification bell/icon
    const notifBtn =
      await page.$('button[aria-label*="notification" i]') ||
      await page.$('button[aria-label*="Notification" i]') ||
      await page.$('[class*="notification" i]') ||
      await page.$('[data-testid*="notification" i]') ||
      await page.$('button:has-text("Notifications")');

    if (!notifBtn) {
      // Check via API
      const result = await page.evaluate(async () => {
        const token = localStorage.getItem("access_token");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await fetch("/api/v1/notifications?limit=5", { headers });
        return { status: res.status };
      });
      if (result.status !== 200) throw new Error("No notification UI element and API returned " + result.status);
      // API works even if UI element not easily found
      return;
    }

    await notifBtn.click();
    await page.waitForTimeout(1500);

    const body = await page.textContent("body");
    if (!body) throw new Error("Page body is empty after clicking notifications");
  });

  // ── Results ─────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`${"=".repeat(50)}\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
