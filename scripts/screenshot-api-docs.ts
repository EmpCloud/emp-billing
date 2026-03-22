import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Swagger UI is on the server port with trailing slash
  await page.goto("http://localhost:4001/api/docs/", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(3000);

  const filepath = path.join(__dirname, "../docs/screenshots/35-api-docs.png");
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`OK: ${filepath}`);

  await browser.close();
}

main().catch(console.error);
