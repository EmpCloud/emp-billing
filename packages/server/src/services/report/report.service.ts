import { getDB } from "../../db/adapters/index";
import { InvoiceStatus } from "@emp-billing/shared";

// ============================================================================
// REPORT SERVICE
// ============================================================================

// ── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getDashboardStats(orgId: string) {
  const db = await getDB();

  // Invoice counts by status
  const statusCounts = await db.raw<{ status: string; count: number }[]>(
    `SELECT status, COUNT(*) as count FROM invoices WHERE org_id = ? GROUP BY status`,
    [orgId]
  );

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = Number(row.count);
  }

  // Total revenue (sum of paid invoices)
  const [revenueRow] = await db.raw<{ total: number }[]>(
    `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE org_id = ? AND status = ?`,
    [orgId, InvoiceStatus.PAID]
  );
  const totalRevenue = Number(revenueRow?.total ?? 0);

  // Total outstanding (amount_due on non-void, non-written-off, non-paid invoices)
  const [outstandingRow] = await db.raw<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount_due), 0) as total FROM invoices
     WHERE org_id = ? AND status NOT IN (?, ?, ?)`,
    [orgId, InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF]
  );
  const totalOutstanding = Number(outstandingRow?.total ?? 0);

  // Total overdue
  const [overdueRow] = await db.raw<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount_due), 0) as total FROM invoices
     WHERE org_id = ? AND status = ?`,
    [orgId, InvoiceStatus.OVERDUE]
  );
  const totalOverdue = Number(overdueRow?.total ?? 0);

  // Total expenses
  const [expenseRow] = await db.raw<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE org_id = ?`,
    [orgId]
  );
  const totalExpenses = Number(expenseRow?.total ?? 0);

  // Recent 5 invoices
  const recentInvoices = await db.raw<Record<string, unknown>[]>(
    `SELECT * FROM invoices WHERE org_id = ? ORDER BY created_at DESC LIMIT 5`,
    [orgId]
  );

  // Recent 5 payments
  const recentPayments = await db.raw<Record<string, unknown>[]>(
    `SELECT * FROM payments WHERE org_id = ? AND is_refund = false ORDER BY date DESC LIMIT 5`,
    [orgId]
  );

  // Receivables aging
  const agingBuckets = await db.raw<{ bucket: string; total: number }[]>(
    `SELECT
       CASE
         WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'current'
         WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30'
         WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60'
         WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN '61-90'
         ELSE '90+'
       END as bucket,
       COALESCE(SUM(amount_due), 0) as total
     FROM invoices
     WHERE org_id = ? AND status NOT IN (?, ?, ?)
     GROUP BY bucket`,
    [orgId, InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF]
  );

  const aging: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const row of agingBuckets) {
    aging[row.bucket] = Number(row.total);
  }

  return {
    data: {
      invoiceCounts: countMap,
      totalRevenue,
      totalOutstanding,
      totalOverdue,
      totalExpenses,
      recentInvoices,
      recentPayments,
      receivablesAging: {
        current: aging["current"],
        days1to30: aging["1-30"],
        days31to60: aging["31-60"],
        days61to90: aging["61-90"],
        days90plus: aging["90+"],
      },
    },
  };
}

// ── Revenue Report ──────────────────────────────────────────────────────────

export async function getRevenueReport(orgId: string, from: Date, to: Date) {
  const db = await getDB();

  const rows = await db.raw<{ month: string; revenue: number }[]>(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') as month, COALESCE(SUM(total), 0) as revenue
     FROM invoices
     WHERE org_id = ? AND status = ? AND paid_at >= ? AND paid_at <= ?
     GROUP BY month
     ORDER BY month ASC`,
    [orgId, InvoiceStatus.PAID, from, to]
  );

  return { data: rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) })) };
}

// ── Receivables Report ──────────────────────────────────────────────────────

export async function getReceivablesReport(orgId: string) {
  const db = await getDB();

  const rows = await db.raw<{ client_id: string; client_name: string; total_outstanding: number; invoice_count: number }[]>(
    `SELECT i.client_id, c.name as client_name,
            COALESCE(SUM(i.amount_due), 0) as total_outstanding,
            COUNT(*) as invoice_count
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.org_id = ? AND i.status NOT IN (?, ?, ?)
     GROUP BY i.client_id, c.name
     ORDER BY total_outstanding DESC`,
    [orgId, InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF]
  );

  return {
    data: rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      totalOutstanding: Number(r.total_outstanding),
      invoiceCount: Number(r.invoice_count),
    })),
  };
}

// ── Aging Report ────────────────────────────────────────────────────────────

export async function getAgingReport(orgId: string) {
  const db = await getDB();

  const rows = await db.raw<{
    client_id: string;
    client_name: string;
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  }[]>(
    `SELECT
       i.client_id, c.name as client_name,
       COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) <= 0 THEN i.amount_due ELSE 0 END), 0) as current,
       COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 1 AND 30 THEN i.amount_due ELSE 0 END), 0) as days_1_30,
       COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 31 AND 60 THEN i.amount_due ELSE 0 END), 0) as days_31_60,
       COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 61 AND 90 THEN i.amount_due ELSE 0 END), 0) as days_61_90,
       COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) > 90 THEN i.amount_due ELSE 0 END), 0) as days_90_plus
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.org_id = ? AND i.status NOT IN (?, ?, ?)
     GROUP BY i.client_id, c.name
     ORDER BY c.name ASC`,
    [orgId, InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF]
  );

  return {
    data: rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      current: Number(r.current),
      days1to30: Number(r.days_1_30),
      days31to60: Number(r.days_31_60),
      days61to90: Number(r.days_61_90),
      days90plus: Number(r.days_90_plus),
    })),
  };
}

// ── Expense Report ──────────────────────────────────────────────────────────

export async function getExpenseReport(orgId: string, from: Date, to: Date) {
  const db = await getDB();

  const rows = await db.raw<{ category_id: string; category_name: string; total: number; count: number }[]>(
    `SELECT e.category_id, ec.name as category_name,
            COALESCE(SUM(e.amount), 0) as total,
            COUNT(*) as count
     FROM expenses e
     JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.org_id = ? AND e.date >= ? AND e.date <= ?
     GROUP BY e.category_id, ec.name
     ORDER BY total DESC`,
    [orgId, from, to]
  );

  return {
    data: rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      total: Number(r.total),
      count: Number(r.count),
    })),
  };
}

// ── Profit & Loss Report ────────────────────────────────────────────────────

export async function getProfitLossReport(orgId: string, from: Date, to: Date) {
  const db = await getDB();

  // Monthly revenue from paid invoices
  const revenueRows = await db.raw<{ month: string; total: number }[]>(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') as month, COALESCE(SUM(total), 0) as total
     FROM invoices
     WHERE org_id = ? AND status = ? AND paid_at >= ? AND paid_at <= ?
     GROUP BY month
     ORDER BY month ASC`,
    [orgId, InvoiceStatus.PAID, from, to]
  );

  // Monthly expenses
  const expenseRows = await db.raw<{ month: string; total: number }[]>(
    `SELECT DATE_FORMAT(date, '%Y-%m') as month, COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE org_id = ? AND date >= ? AND date <= ?
     GROUP BY month
     ORDER BY month ASC`,
    [orgId, from, to]
  );

  // Merge into a single list by month
  const monthMap = new Map<string, { revenue: number; expenses: number }>();

  for (const row of revenueRows) {
    monthMap.set(row.month, { revenue: Number(row.total), expenses: 0 });
  }
  for (const row of expenseRows) {
    const existing = monthMap.get(row.month) ?? { revenue: 0, expenses: 0 };
    existing.expenses = Number(row.total);
    monthMap.set(row.month, existing);
  }

  const data = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month,
      revenue: vals.revenue,
      expenses: vals.expenses,
      profit: vals.revenue - vals.expenses,
    }));

  return { data };
}

// ── Tax Report ─────────────────────────────────────────────────────────

export async function getTaxReport(orgId: string, from?: Date, to?: Date) {
  const db = await getDB();

  // Build date filter clause for invoice issue_date
  const dateConditions: string[] = ["i.org_id = ?", "i.status NOT IN (?, ?)"];
  const params: unknown[] = [orgId, InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF];

  if (from) {
    dateConditions.push("i.issue_date >= ?");
    params.push(from);
  }
  if (to) {
    dateConditions.push("i.issue_date <= ?");
    params.push(to);
  }

  const whereClause = dateConditions.join(" AND ");

  // Group by tax_rate_id and tax_rate to get per-rate breakdown
  const rows = await db.raw<{
    tax_rate_id: string | null;
    tax_rate: number;
    tax_rate_name: string | null;
    tax_rate_type: string | null;
    tax_components: string | null;
    taxable_amount: number;
    tax_amount: number;
    invoice_count: number;
  }[]>(
    `SELECT
       ii.tax_rate_id,
       ii.tax_rate,
       tr.name as tax_rate_name,
       tr.type as tax_rate_type,
       tr.components as tax_components,
       COALESCE(SUM(ii.amount - ii.tax_amount), 0) as taxable_amount,
       COALESCE(SUM(ii.tax_amount), 0) as tax_amount,
       COUNT(DISTINCT ii.invoice_id) as invoice_count
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     LEFT JOIN tax_rates tr ON tr.id = ii.tax_rate_id
     WHERE ${whereClause}
     GROUP BY ii.tax_rate_id, ii.tax_rate, tr.name, tr.type, tr.components
     ORDER BY ii.tax_rate ASC`,
    params
  );

  const data = rows.map((r) => {
    const rate = Number(r.tax_rate);
    const taxableAmount = Number(r.taxable_amount);
    const totalTax = Number(r.tax_amount);
    const taxType = r.tax_rate_type ?? "custom";

    // Compute CGST/SGST/IGST breakdown based on tax type
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (taxType === "igst") {
      igst = totalTax;
    } else if (taxType === "gst") {
      // GST splits equally into CGST and SGST
      cgst = Math.round(totalTax / 2);
      sgst = totalTax - cgst; // avoid rounding loss
    } else {
      // VAT, sales_tax, custom — report full amount as total only
      igst = 0;
      cgst = 0;
      sgst = 0;
    }

    return {
      taxRateId: r.tax_rate_id,
      taxRateName: r.tax_rate_name ?? `Tax ${rate}%`,
      taxRateType: taxType,
      rate,
      taxableAmount,
      cgst,
      sgst,
      igst,
      totalTax,
      invoiceCount: Number(r.invoice_count),
    };
  });

  return { data };
}

// ── Top Clients ─────────────────────────────────────────────────────────────

export async function getTopClients(orgId: string, from: Date, to: Date, limit = 10) {
  const db = await getDB();

  const rows = await db.raw<{ client_id: string; client_name: string; revenue: number; invoice_count: number }[]>(
    `SELECT i.client_id, c.name as client_name,
            COALESCE(SUM(i.total), 0) as revenue,
            COUNT(*) as invoice_count
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.org_id = ? AND i.status = ? AND i.paid_at >= ? AND i.paid_at <= ?
     GROUP BY i.client_id, c.name
     ORDER BY revenue DESC
     LIMIT ?`,
    [orgId, InvoiceStatus.PAID, from, to, limit]
  );

  return {
    data: rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      revenue: Number(r.revenue),
      invoiceCount: Number(r.invoice_count),
    })),
  };
}
