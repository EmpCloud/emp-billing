const TOKEN = process.env.GITHUB_TOKEN || "";
const REPO = "EmpCloud/emp-billing";
const COMMIT = "5236890";
const COMMIT_URL = `https://github.com/${REPO}/commit/${COMMIT}`;

const comments = [
  {
    issue: 10,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** The \`search\` parameter was sent by the frontend but never extracted by the expense controller. The controller passed \`categoryId\`, \`status\`, \`from\`, \`to\` to the service but skipped \`search\`. Additionally, the service had no search filtering logic.

**Fix:**
1. Added \`search: z.string().optional()\` to \`ExpenseFilterSchema\`
2. Added \`search: query.search\` extraction in expense controller
3. Added case-insensitive text search on \`description\` and \`vendorName\` fields in expense service

**Files changed:**
- \`packages/shared/src/validators/index.ts\`
- \`packages/server/src/api/controllers/expense.controller.ts\`
- \`packages/server/src/services/expense/expense.service.ts\``,
  },
  {
    issue: 11,
    body: `**Fixed in [${COMMIT}](${COMMIT_URL})**

**Root cause:** The \`deleteExpense\` function called \`db.softDelete()\` which tries to set \`is_active = false\` and \`deleted_at = new Date()\`. However, the \`expenses\` table does not have these columns, causing a database error on every delete attempt.

**Fix:** Changed \`db.softDelete()\` to \`db.delete()\` (hard delete) since the expenses table was not designed for soft deletes.

**Files changed:**
- \`packages/server/src/services/expense/expense.service.ts\`
- \`packages/server/src/services/expense/expense.service.test.ts\``,
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
})();
