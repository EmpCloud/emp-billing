import type { Request, Response } from "express";
import * as reportService from "../../services/report/report.service";

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
  const from = new Date(q.from);
  const to = new Date(q.to);
  const result = await reportService.getRevenueReport(req.user!.orgId, from, to);
  res.json({ success: true, data: result.data });
}

export async function getReceivablesReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.getReceivablesReport(req.user!.orgId);
  res.json({ success: true, data: result.data });
}

export async function getAgingReport(req: Request, res: Response): Promise<void> {
  const result = await reportService.getAgingReport(req.user!.orgId);
  res.json({ success: true, data: result.data });
}

export async function getExpenseReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = new Date(q.from);
  const to = new Date(q.to);
  const result = await reportService.getExpenseReport(req.user!.orgId, from, to);
  res.json({ success: true, data: result.data });
}

export async function getProfitLossReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = new Date(q.from);
  const to = new Date(q.to);
  const result = await reportService.getProfitLossReport(req.user!.orgId, from, to);
  res.json({ success: true, data: result.data });
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
  const from = new Date(q.from);
  const to = new Date(q.to);
  const limit = q.limit ? parseInt(q.limit, 10) : 10;
  const result = await reportService.getTopClients(req.user!.orgId, from, to, limit);
  res.json({ success: true, data: result.data });
}

// ── CSV Export endpoints ────────────────────────────────────────────────────

export async function exportRevenueReport(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const from = new Date(q.from);
  const to = new Date(q.to);
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
  const from = new Date(q.from);
  const to = new Date(q.to);
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
