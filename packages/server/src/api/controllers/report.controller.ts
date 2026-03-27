import type { Request, Response } from "express";
import * as reportService from "../../services/report/report.service";
import * as gstr1Service from "../../services/tax/gstr1.service";

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const result = await reportService.getDashboardStats(req.user!.orgId);
  res.json({ success: true, data: result.data });
}

export async function getRevenueReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const result = await reportService.getRevenueReport(req.user!.orgId, from, to);
  res.json({ success: true, data: { months: result.data, baseCurrency: result.baseCurrency } });
}

export async function getReceivablesReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.getReceivablesReport(req.user!.orgId);
  // Frontend expects { clientId, clientName, outstanding, currency }[]
  const data = result.data.map((r) => ({
    ...r,
    outstanding: r.totalOutstanding,
    currency: result.baseCurrency,
  }));
  res.json({ success: true, data });
}

export async function getAgingReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.getAgingReport(req.user!.orgId);
  // Frontend expects { clientId, clientName, current, days1to30, ..., total, currency }[]
  const data = result.data.map((r) => ({
    ...r,
    total: r.current + r.days1to30 + r.days31to60 + r.days61to90 + r.days90plus,
    currency: result.baseCurrency,
  }));
  res.json({ success: true, data });
}

export async function getExpenseReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const result = await reportService.getExpenseReport(req.user!.orgId, from, to);
  // Frontend expects { category, total, count, currency }[]
  const data = result.data.map((r) => ({
    category: r.categoryName,
    total: r.total,
    count: r.count,
    currency: "INR",
  }));
  res.json({ success: true, data });
}

export async function getProfitLossReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const result = await reportService.getProfitLossReport(req.user!.orgId, from, to);
  // Frontend expects { months: [{month, revenue, expenses, net}], totals: {revenue, expenses, net} }
  const months = result.data.map((r) => ({
    month: r.month,
    revenue: r.revenue,
    expenses: r.expenses,
    net: r.revenue - r.expenses,
  }));
  const totals = months.reduce(
    (acc, m) => ({ revenue: acc.revenue + m.revenue, expenses: acc.expenses + m.expenses, net: acc.net + m.net }),
    { revenue: 0, expenses: 0, net: 0 }
  );
  res.json({ success: true, data: { months, totals } });
}

export async function getTaxReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(q.to) : undefined;
  const result = await reportService.getTaxReport(req.user!.orgId, from, to);
  res.json({ success: true, data: result.data });
}

export async function getTopClients(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const limit = q.limit ? parseInt(q.limit, 10) : 10;
  const result = await reportService.getTopClients(req.user!.orgId, from, to, limit);
  res.json({ success: true, data: result.data });
}

// ── CSV Export endpoints ────────────────────────────────────────────────────

export async function exportRevenueReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const result = await reportService.getRevenueReport(req.user!.orgId, from, to);
  const headers = ["Month", "Revenue (paise)"];
  const rows = result.data.map((r) => [r.month, r.revenue]);
  sendCsv(res, "revenue-report.csv", toCsv(headers, rows));
}

export async function exportReceivablesReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.getReceivablesReport(req.user!.orgId);
  const headers = ["Client ID", "Client Name", "Total Outstanding (paise)", "Invoice Count"];
  const rows = result.data.map((r) => [r.clientId, r.clientName, r.totalOutstanding, r.invoiceCount]);
  sendCsv(res, "receivables-report.csv", toCsv(headers, rows));
}

export async function exportExpenseReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = q.to ? new Date(q.to) : new Date();
  const result = await reportService.getExpenseReport(req.user!.orgId, from, to);
  const headers = ["Category ID", "Category Name", "Total (paise)", "Count"];
  const rows = result.data.map((r) => [r.categoryId, r.categoryName, r.total, r.count]);
  sendCsv(res, "expense-report.csv", toCsv(headers, rows));
}

export async function exportTaxReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : undefined;
  const to = q.to ? new Date(q.to) : undefined;
  const result = await reportService.getTaxReport(req.user!.orgId, from, to);
  const headers = ["Tax Rate Name", "Type", "Rate (%)", "Taxable Amount (paise)", "CGST (paise)", "SGST (paise)", "IGST (paise)", "Total Tax (paise)", "Invoice Count"];
  const rows = result.data.map((r) => [
    r.taxRateName, r.taxRateType, r.rate, r.taxableAmount, r.cgst, r.sgst, r.igst, r.totalTax, r.invoiceCount,
  ]);
  sendCsv(res, "tax-report.csv", toCsv(headers, rows));
}

// ── GSTR-1 Endpoints ─────────────────────────────────────────────────────────

export async function getGSTR1(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const period = q.period; // YYYY-MM
  if (!period) {
    res.status(400).json({ success: false, error: { code: "MISSING_PERIOD", message: "period query parameter is required (YYYY-MM)" } });
    return;
  }
  const data = await gstr1Service.generateGSTR1(req.user!.orgId, period);
  res.json({ success: true, data });
}

export async function getGSTR1JSON(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const period = q.period;
  if (!period) {
    res.status(400).json({ success: false, error: { code: "MISSING_PERIOD", message: "period query parameter is required (YYYY-MM)" } });
    return;
  }
  const data = await gstr1Service.generateGSTR1(req.user!.orgId, period);
  const portalJSON = gstr1Service.toGSTPortalJSON(data);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="GSTR1_${data.gstin}_${data.period}.json"`);
  res.send(JSON.stringify(portalJSON, null, 2));
}

export async function getGSTR1CSV(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const period = q.period;
  const section = q.section ?? "b2b"; // default to B2B section
  if (!period) {
    res.status(400).json({ success: false, error: { code: "MISSING_PERIOD", message: "period query parameter is required (YYYY-MM)" } });
    return;
  }
  const data = await gstr1Service.generateGSTR1(req.user!.orgId, period);
  const csvSections = gstr1Service.toCSV(data);

  const validSections = ["b2b", "b2cl", "b2cs", "cdnr", "hsn", "docs"];
  const sectionKey = validSections.includes(section) ? section : "b2b";
  const csvContent = csvSections[sectionKey] ?? "";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="GSTR1_${sectionKey}_${data.period}.csv"`);
  res.send(csvContent);
}
