import { chromium } from "playwright";

const URL = "https://hyperconscientiously-uncognisable-ozell.ngrok-free.dev";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    networkErrors.push(`${req.method()} ${req.url()} => ${req.failure()?.errorText}`);
  });

  // Track API calls
  const apiCalls: { method: string; url: string; status: number; body: string }[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiCalls.push({
        method: res.request().method(),
        url: res.url(),
        status: res.status(),
        body: body.substring(0, 500),
      });
    }
  });

  console.log(`\n1. Navigating to ${URL}...\n`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });

  // Handle ngrok interstitial
  const visitButton = await page.$('button:has-text("Visit Site")');
  if (visitButton) {
    console.log("   Ngrok interstitial — clicking 'Visit Site'...");
    await visitButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scripts/test-01-login-page.png", fullPage: true });
  console.log("   Screenshot: scripts/test-01-login-page.png");

  // Check current URL
  console.log(`   Current URL: ${page.url()}`);
  console.log(`   Page title: ${await page.title()}`);

  // Check if login form exists
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  const submitBtn = await page.$('button[type="submit"]');

  console.log(`\n2. Form state:`);
  console.log(`   Email input found: ${!!emailInput}`);
  console.log(`   Password input found: ${!!passwordInput}`);
  console.log(`   Submit button found: ${!!submitBtn}`);

  if (emailInput) {
    const emailValue = await emailInput.inputValue();
    console.log(`   Email value: "${emailValue}"`);
  }
  if (passwordInput) {
    const passValue = await passwordInput.inputValue();
    console.log(`   Password value: "${passValue}"`);
  }

  // Check body styles to confirm CSS is loaded
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  console.log(`   Font: ${fontFamily}`);

  // Try to login
  console.log(`\n3. Attempting login...`);
  if (submitBtn) {
    await submitBtn.click();
    console.log("   Clicked submit");

    // Wait for navigation or API response
    await page.waitForTimeout(5000);

    console.log(`   URL after login: ${page.url()}`);
    await page.screenshot({ path: "scripts/test-02-after-login.png", fullPage: true });
    console.log("   Screenshot: scripts/test-02-after-login.png");
  }

  console.log(`\n4. API Calls:`);
  for (const c of apiCalls) {
    console.log(`   ${c.method} ${c.url}`);
    console.log(`     Status: ${c.status}`);
    console.log(`     Body: ${c.body}`);
  }

  console.log(`\n5. Console Errors:`);
  for (const e of errors) {
    console.log(`   ${e}`);
  }

  console.log(`\n6. Network Errors:`);
  for (const e of networkErrors) {
    console.log(`   ${e}`);
  }

  await browser.close();
})();
