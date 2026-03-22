import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:5174";
const API_URL = process.env.API_URL || "http://localhost:4001";
const SCREENSHOT_DIR = path.join(__dirname, "../docs/screenshots");

// Demo credentials (from seed data)
const DEMO_EMAIL = "admin@acme.com";
const DEMO_PASSWORD = "Admin@123";

interface ScreenshotTask {
  name: string;
  filename: string;
  path: string;
  action?: (page: import("playwright").Page) => Promise<void>;
}

const NEW_SCREENSHOTS: ScreenshotTask[] = [
  {
    name: "Invoice Detail",
    filename: "26-invoice-detail.png",
    path: "/invoices",
    action: async (page) => {
      await page.waitForTimeout(2000);
      const firstRow = page.locator("table tbody tr").first();
      if (await firstRow.count()) {
        await firstRow.click();
        await page.waitForTimeout(3000);
      }
    },
  },
  {
    name: "Client Detail",
    filename: "27-client-detail.png",
    path: "/clients",
    action: async (page) => {
      await page.waitForTimeout(2000);
      const viewBtn = page.locator("button:has-text('View')").first();
      if (await viewBtn.count()) {
        await viewBtn.click();
        await page.waitForTimeout(3000);
      }
    },
  },
  {
    name: "Coupons",
    filename: "28-coupons.png",
    path: "/coupons",
  },
  {
    name: "Webhooks",
    filename: "29-webhooks.png",
    path: "/webhooks",
  },
  {
    name: "Audit Log",
    filename: "30-audit-log.png",
    path: "/audit",
  },
  {
    name: "Metrics Dashboard",
    filename: "31-metrics.png",
    path: "/metrics",
  },
  {
    name: "Disputes",
    filename: "32-disputes.png",
    path: "/disputes",
  },
  {
    name: "Usage Records",
    filename: "33-usage.png",
    path: "/usage",
  },
  {
    name: "Dunning / Payment Retry",
    filename: "34-dunning.png",
    path: "/dunning",
  },
];

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Determine the correct URL — try Vite dev server first, then production
  let appUrl = BASE_URL;
  try {
    const res = await fetch(`${BASE_URL}/`, { method: "HEAD" });
    if (res.ok) {
      console.log(`Using dev server at ${BASE_URL}`);
    }
  } catch {
    appUrl = API_URL;
    console.log(`Dev server not available, using production at ${API_URL}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Login
  console.log("Logging in...");
  await page.goto(`${appUrl}/login`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);

  // Check if CSS loaded by looking for styled elements
  const emailInput = page.locator('input[type="email"], input[id="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await emailInput.count()) {
    await emailInput.fill(DEMO_EMAIL);
    await passwordInput.fill(DEMO_PASSWORD);

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForURL("**/dashboard**", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    console.log("Logged in successfully");
  }

  // Take each screenshot
  for (const task of NEW_SCREENSHOTS) {
    const filepath = path.join(SCREENSHOT_DIR, task.filename);

    try {
      console.log(`Capturing: ${task.name}...`);

      await page.goto(`${appUrl}${task.path}`, { waitUntil: "networkidle", timeout: 15000 });
      // Wait extra for CSS and data to load
      await page.waitForTimeout(3000);

      // Execute custom action if defined
      if (task.action) {
        await task.action(page);
      }

      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`  OK: ${task.filename}`);
    } catch (err) {
      console.error(`  FAIL: ${task.name} — ${(err as Error).message}`);
    }
  }

  // API docs screenshot (separate — no auth needed)
  try {
    console.log("Capturing: API Documentation...");
    await page.goto(`${API_URL}/api/docs`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "35-api-docs.png"),
      fullPage: false,
    });
    console.log("  OK: 35-api-docs.png");
  } catch (err) {
    console.error(`  FAIL: API Docs — ${(err as Error).message}`);
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch(console.error);
