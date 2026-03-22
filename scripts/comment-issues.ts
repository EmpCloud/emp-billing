const TOKEN = process.env.GITHUB_TOKEN || "";
const REPO = "EmpCloud/emp-billing";
const COMMIT = "2c5cc95";
const COMMIT_URL = `https://github.com/${REPO}/commit/${COMMIT}`;

interface IssueComment {
  issue: number;
  body: string;
}

const comments: IssueComment[] = [
  {
    issue: 1,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** Payment method dropdown used a plain HTML \`<select>\` with no search/filter capability.

**Fix:** Created a new \`SearchableSelect\` component with type-to-filter, keyboard support, and click-outside-to-close. Applied to both PaymentRecordPage and PaymentListPage.

**Files changed:**
- \`packages/client/src/components/common/Input.tsx\` — new SearchableSelect component
- \`packages/client/src/pages/payments/PaymentRecordPage.tsx\`
- \`packages/client/src/pages/payments/PaymentListPage.tsx\``,
  },
  {
    issue: 2,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause (phone):** The phone field in CreateClientSchema had no format validation — just \`z.string().optional()\`, allowing alphabetic characters.

**Root cause (address):** Country, State, and City were plain text \`<Input>\` fields with no dropdown behavior or cascading data source.

**Fix:**
1. Added phone regex pattern \`/^\\+?[\\d\\s\\-().]+$/\` to Zod schema + onKeyDown handler to block non-numeric input in real-time
2. Created \`AddressFields\` component with cascading Country → State → City dropdowns (9 countries with states and cities). Falls back to free-text input for unlisted locations.

**Files changed:**
- \`packages/shared/src/validators/index.ts\` — phone validation
- \`packages/client/src/data/location-data.ts\` — new location dataset
- \`packages/client/src/components/common/AddressFields.tsx\` — new cascading dropdown component
- \`packages/client/src/pages/clients/ClientCreatePage.tsx\`
- \`packages/client/src/pages/clients/ClientEditPage.tsx\``,
  },
  {
    issue: 3,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** The receipt Handlebars template expected fields named \`payment.paymentDate\`, \`payment.currency\`, and \`payment.referenceNumber\`, but the Payment model uses \`date\`, has no \`currency\` field, and uses \`reference\`. The service passed the raw payment object without mapping these fields, causing the template to render with undefined values and PDF generation to fail.

**Fix:**
1. Added field mapping in \`getPaymentReceiptPdf()\` — \`paymentDate\` from \`date\`, \`referenceNumber\` from \`reference\`, \`currency\` from linked invoice
2. Added try/catch with toast.error in the download hook so failures show a user-visible error

**Files changed:**
- \`packages/server/src/services/payment/payment.service.ts\`
- \`packages/client/src/api/hooks/payment.hooks.ts\``,
  },
  {
    issue: 4,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** When clearing \`maxRedemptions\` in the edit form, the value becomes \`""\` (empty string). The onSubmit handler converted falsy values to \`undefined\`, which Zod's \`.partial()\` strips from the parsed object. The server's update logic skips \`undefined\` fields entirely, so the DB value was never cleared.

**Fix:**
1. Changed form submission to send \`null\` instead of \`undefined\` when clearing maxRedemptions
2. Updated \`UpdateCouponSchema\` to accept \`null\` via \`.nullable().optional()\`

**Files changed:**
- \`packages/client/src/pages/coupons/CouponEditPage.tsx\`
- \`packages/shared/src/validators/index.ts\``,
  },
  {
    issue: 5,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** The \`maxRedemptionsPerClient\` field used \`{ valueAsNumber: true }\` in the \`register()\` call. When left blank, \`valueAsNumber\` converts \`""\` to \`NaN\`, which fails Zod validation. The form stays invalid, keeping the Create button disabled — even though the UI text says blank = unlimited.

**Fix:** Removed \`{ valueAsNumber: true }\` from \`register("maxRedemptionsPerClient")\` on both create and edit pages. The Zod schema's \`z.coerce.number()\` handles the conversion correctly.

**Files changed:**
- \`packages/client/src/pages/coupons/CouponCreatePage.tsx\`
- \`packages/client/src/pages/coupons/CouponEditPage.tsx\``,
  },
  {
    issue: 6,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause (multi-part):**
1. The \`useValidateCoupon\` hook showed generic "Invalid coupon code" for ALL server errors — hiding specific messages like "expired" or "minimum amount required"
2. The \`validateCoupon\` controller dropped \`amount: 0\` (falsy) to \`undefined\`
3. The \`createCoupon\` service's duplicate check didn't normalize case, while storing with \`.toUpperCase()\`

**Fix:**
1. Updated error handlers to display actual server error messages
2. Changed \`amount ? Number(amount)\` to \`amount != null ? Number(amount)\`
3. Added \`.toUpperCase()\` to duplicate check query

**Files changed:**
- \`packages/client/src/api/hooks/coupon.hooks.ts\`
- \`packages/server/src/api/controllers/coupon.controller.ts\`
- \`packages/server/src/services/coupon/coupon.service.ts\``,
  },
  {
    issue: 7,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** The \`useDownloadQuotePdf\` hook had no error handling. If the server returned an error, the promise rejection was silently swallowed and the user saw nothing happen. Also, the programmatic anchor click didn't work in all browsers without DOM attachment.

**Fix:**
1. Added try/catch with \`toast.error("Failed to download PDF")\`
2. Added \`document.body.appendChild(a)\` before click and \`a.remove()\` after for cross-browser reliability

**Files changed:**
- \`packages/client/src/api/hooks/quote.hooks.ts\``,
  },
  {
    issue: 8,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause (3 bugs):**
1. **BOM not stripped:** CSV files from Excel/Google Sheets include a UTF-8 BOM character (\`\\uFEFF\`). The parser didn't strip it, causing the first header to be \`"\\uFEFFname"\` instead of \`"name"\` — all rows skipped with "missing required field"
2. **paymentTerms as string:** The import inserted string \`"net_30"\` into an INTEGER column, causing a DB type error
3. **Misleading toast:** Success message shown even when 0 rows were imported

**Fix:**
1. Strip BOM in \`parseCSV()\`
2. Parse paymentTerms as \`parseInt()\` with default \`30\`
3. Show actual import/skip counts and surface server error messages

**Files changed:**
- \`packages/server/src/utils/csv.ts\`
- \`packages/server/src/services/import-export/csv.service.ts\`
- \`packages/client/src/api/hooks/client.hooks.ts\`
- \`packages/server/src/utils/csv.test.ts\` — added BOM test`,
  },
  {
    issue: 9,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** In the \`updateQuote\` service function:
1. \`issueDate\` was completely absent from the update logic — never written to DB
2. \`clientId\`, \`currency\`, and \`expiryDate\` used truthy checks (\`if (input.clientId)\`) instead of \`!== undefined\`, so fields set to empty string or certain values were silently skipped

**Fix:** Changed all field-presence checks to use \`!== undefined\` and added \`issueDate\` handling.

**Files changed:**
- \`packages/server/src/services/quote/quote.service.ts\``,
  },
];

async function postComment(issue: number, body: string) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/issues/${issue}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({ body }),
    }
  );
  const data = await resp.json();
  if (resp.ok) {
    console.log(`[OK] Issue #${issue}: ${data.html_url}`);
  } else {
    console.log(`[ERR] Issue #${issue}: ${data.message}`);
  }
}

(async () => {
  for (const c of comments) {
    await postComment(c.issue, c.body);
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log("\nDone — all comments posted.");
})();
