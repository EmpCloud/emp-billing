import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const puppeteer = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "server", "node_modules", "puppeteer"));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const BASE = "http://localhost:5174";

const FAKE_AUTH = JSON.stringify({
  state: {
    user: {
      id: "usr-1",
      email: "admin@empcloud.com",
      role: "owner",
      orgId: "org-1",
      orgName: "EmpCloud Demo",
      firstName: "Admin",
      lastName: "User",
    },
    accessToken: "fake-token-for-screenshots",
    isAuthenticated: true,
  },
  version: 0,
});

const screens = [
  { name: "01-login", path: "/login", title: "Login" },
  { name: "02-register", path: "/register", title: "Register" },
  { name: "03-forgot-password", path: "/forgot-password", title: "Forgot Password" },
  { name: "04-dashboard", path: "/dashboard", title: "Dashboard", auth: true },
  { name: "05-invoices", path: "/invoices", title: "Invoices", auth: true },
  { name: "06-invoice-create", path: "/invoices/new", title: "Create Invoice", auth: true },
  { name: "07-quotes", path: "/quotes", title: "Quotes", auth: true },
  { name: "08-quote-create", path: "/quotes/new", title: "Create Quote", auth: true },
  { name: "09-clients", path: "/clients", title: "Clients", auth: true },
  { name: "10-client-create", path: "/clients/new", title: "Add Client", auth: true },
  { name: "11-products", path: "/products", title: "Products", auth: true },
  { name: "12-product-create", path: "/products/new", title: "Add Product", auth: true },
  { name: "13-payments", path: "/payments", title: "Payments", auth: true },
  { name: "14-expenses", path: "/expenses", title: "Expenses", auth: true },
  { name: "15-expense-create", path: "/expenses/new", title: "Create Expense", auth: true },
  { name: "16-credit-notes", path: "/credit-notes", title: "Credit Notes", auth: true },
  { name: "17-recurring", path: "/recurring", title: "Recurring Invoices", auth: true },
  { name: "18-vendors", path: "/vendors", title: "Vendors", auth: true },
  { name: "19-reports", path: "/reports", title: "Reports", auth: true },
  { name: "20-report-builder", path: "/reports/builder", title: "Report Builder", auth: true },
  { name: "21-subscriptions", path: "/subscriptions", title: "Subscriptions", auth: true },
  { name: "22-plans", path: "/subscriptions/plans", title: "Plans", auth: true },
  { name: "23-settings", path: "/settings", title: "Settings", auth: true },
  { name: "24-team", path: "/team", title: "Team", auth: true },
  { name: "25-portal-login", path: "/portal/login", title: "Client Portal Login" },
];

async function setupPage(page, needsAuth) {
  // Intercept only /api/v1 backend calls — NOT Vite resources
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/v1/")) {
      req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      });
    } else {
      req.continue();
    }
  });

  // Navigate to base to set localStorage before going to target page
  await page.goto(BASE + "/login", { waitUntil: "networkidle2", timeout: 15000 });

  if (needsAuth) {
    await page.evaluate((authState) => {
      localStorage.setItem("emp-billing-auth", authState);
      localStorage.setItem("access_token", "fake-token-for-screenshots");
    }, FAKE_AUTH);
  } else {
    await page.evaluate(() => {
      localStorage.removeItem("emp-billing-auth");
      localStorage.removeItem("access_token");
    });
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const screen of screens) {
    const page = await browser.newPage();

    // Suppress console errors to avoid noise
    page.on("pageerror", () => {});

    try {
      await setupPage(page, screen.auth);

      await page.goto(`${BASE}${screen.path}`, {
        waitUntil: "networkidle2",
        timeout: 15000,
      });

      // Wait for React renders and any loading states to settle
      await new Promise((r) => setTimeout(r, 2500));

      const filePath = path.join(SCREENSHOT_DIR, `${screen.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ ${screen.name} — ${screen.title}`);
    } catch (err) {
      console.error(`✗ ${screen.name} — ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone! ${screens.length} screenshots saved to docs/screenshots/`);
}

main().catch(console.error);
