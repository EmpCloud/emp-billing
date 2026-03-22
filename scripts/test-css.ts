import { chromium } from "playwright";

const URL = "https://hyperconscientiously-uncognisable-ozell.ngrok-free.dev";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console errors and failed requests
  const errors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.url()} => ${req.failure()?.errorText}`);
  });

  // Track CSS and JS responses
  const assetResponses: { url: string; status: number; type: string }[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/assets/")) {
      assetResponses.push({
        url,
        status: res.status(),
        type: res.headers()["content-type"] || "unknown",
      });
    }
  });

  console.log(`\nNavigating to ${URL}...\n`);

  // ngrok free tier shows an interstitial — click through it
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });

  // Check for ngrok interstitial
  const visitButton = await page.$('button:has-text("Visit Site")');
  if (visitButton) {
    console.log("Ngrok interstitial detected — clicking 'Visit Site'...");
    await visitButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  }

  // Wait a moment for styles to apply
  await page.waitForTimeout(2000);

  console.log("=== Asset Responses ===");
  for (const a of assetResponses) {
    console.log(`  ${a.status} ${a.type} — ${a.url}`);
  }

  console.log("\n=== Console Errors ===");
  for (const e of errors) {
    console.log(`  ${e}`);
  }

  console.log("\n=== Failed Requests ===");
  for (const f of failedRequests) {
    console.log(`  ${f}`);
  }

  // Check computed styles on body
  const bodyStyles = await page.evaluate(() => {
    const body = document.body;
    const computed = getComputedStyle(body);
    return {
      fontFamily: computed.fontFamily,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
    };
  });
  console.log("\n=== Body Computed Styles ===");
  console.log(`  font-family: ${bodyStyles.fontFamily}`);
  console.log(`  background-color: ${bodyStyles.backgroundColor}`);
  console.log(`  color: ${bodyStyles.color}`);

  // Check how many stylesheets are loaded
  const stylesheetCount = await page.evaluate(
    () => document.styleSheets.length
  );
  console.log(`\n=== Loaded Stylesheets: ${stylesheetCount} ===`);

  // Check each stylesheet
  const sheetInfo = await page.evaluate(() => {
    return Array.from(document.styleSheets).map((s) => ({
      href: s.href,
      disabled: s.disabled,
      rulesCount: (() => {
        try {
          return s.cssRules?.length ?? -1;
        } catch {
          return -1;
        }
      })(),
    }));
  });
  for (const s of sheetInfo) {
    console.log(
      `  href=${s.href} disabled=${s.disabled} rules=${s.rulesCount}`
    );
  }

  // Take screenshot
  await page.screenshot({ path: "scripts/ngrok-test.png", fullPage: true });
  console.log("\nScreenshot saved to scripts/ngrok-test.png");

  // Check page title
  const title = await page.title();
  console.log(`Page title: ${title}`);

  await browser.close();
})();
