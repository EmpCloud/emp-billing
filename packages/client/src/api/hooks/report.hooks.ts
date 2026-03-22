import { useQuery } from "@tanstack/react-query";
import { apiGet, api } from "../client";
import type { DashboardStats } from "@emp-billing/shared";

const REPORTS_KEY = "reports";

export function useDashboardStats() {
  return useQuery({
    queryKey: [REPORTS_KEY, "dashboard"],
    queryFn: () => apiGet<DashboardStats>("/reports/dashboard"),
  });
}

export function useRevenueReport(from?: string, to?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "revenue", from, to],
    queryFn: () =>
      apiGet<{ months: { month: string; revenue: number }[] }>(
        "/reports/revenue",
        { from, to },
      ),
  });
}

export function useReceivablesReport() {
  return useQuery({
    queryKey: [REPORTS_KEY, "receivables"],
    queryFn: () =>
      apiGet<
        {
          clientId: string;
          clientName: string;
          outstanding: number;
          currency: string;
        }[]
      >("/reports/receivables"),
  });
}

export function useAgingReport() {
  return useQuery({
    queryKey: [REPORTS_KEY, "aging"],
    queryFn: () =>
      apiGet<
        {
          clientId: string;
          clientName: string;
          current: number;
          days1to30: number;
          days31to60: number;
          days61to90: number;
          days90plus: number;
          total: number;
          currency: string;
        }[]
      >("/reports/aging"),
  });
}

export function useExpenseReport(from?: string, to?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "expenses", from, to],
    queryFn: () =>
      apiGet<
        { category: string; total: number; count: number; currency: string }[]
      >("/reports/expenses", { from, to }),
  });
}

export function useProfitLossReport(from?: string, to?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "profit-loss", from, to],
    queryFn: () =>
      apiGet<
        {
          months: {
            month: string;
            revenue: number;
            expenses: number;
            net: number;
          }[];
          totals: { revenue: number; expenses: number; net: number };
        }
      >("/reports/profit-loss", { from, to }),
  });
}

export function useTaxReport(from?: string, to?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "tax", from, to],
    queryFn: () =>
      apiGet<
        {
          taxRateId: string | null;
          taxRateName: string;
          taxRateType: string;
          rate: number;
          taxableAmount: number;
          cgst: number;
          sgst: number;
          igst: number;
          totalTax: number;
          invoiceCount: number;
        }[]
      >("/reports/tax", { from, to }),
  });
}

export function useTopClients(from?: string, to?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "clients", "top", from, to],
    queryFn: () =>
      apiGet<
        {
          clientId: string;
          clientName: string;
          revenue: number;
          invoiceCount: number;
          currency: string;
        }[]
      >("/reports/clients/top", { from, to }),
  });
}

// ── GSTR-1 types ────────────────────────────────────────────────────────────

export interface GSTR1RateItem {
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

export interface GSTR1B2BInvoice {
  recipientGstin: string;
  recipientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  placeOfSupplyName: string;
  reverseCharge: boolean;
  invoiceType: string;
  items: GSTR1RateItem[];
}

export interface GSTR1B2BEntry {
  recipientGstin: string;
  recipientName: string;
  invoices: GSTR1B2BInvoice[];
}

export interface GSTR1B2CLEntry {
  placeOfSupply: string;
  placeOfSupplyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cessAmount: number;
}

export interface GSTR1B2CSEntry {
  placeOfSupply: string;
  placeOfSupplyName: string;
  taxType: string;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

export interface GSTR1CDNEntry {
  recipientGstin: string;
  recipientName: string;
  noteNumber: string;
  noteDate: string;
  noteType: string;
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
  noteValue: number;
  items: GSTR1RateItem[];
}

export interface GSTR1HSNEntry {
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  taxableValue: number;
  rate: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalValue: number;
}

export interface GSTR1DocSummary {
  documentType: string;
  fromNumber: string;
  toNumber: string;
  totalIssued: number;
  totalCancelled: number;
  netIssued: number;
}

export interface GSTR1Data {
  period: string;
  gstin: string;
  orgName: string;
  b2b: GSTR1B2BEntry[];
  b2cl: GSTR1B2CLEntry[];
  b2cs: GSTR1B2CSEntry[];
  cdnr: GSTR1CDNEntry[];
  hsn: GSTR1HSNEntry[];
  docs: GSTR1DocSummary[];
  summary: {
    totalTaxableValue: number;
    totalIgst: number;
    totalCgst: number;
    totalSgst: number;
    totalCess: number;
    totalTax: number;
    totalInvoiceValue: number;
    b2bCount: number;
    b2clCount: number;
    b2csCount: number;
    cdnrCount: number;
  };
}

export function useGSTR1Report(period?: string) {
  return useQuery({
    queryKey: [REPORTS_KEY, "gstr1", period],
    queryFn: () => apiGet<GSTR1Data>("/reports/gstr1", { period }),
    enabled: !!period,
  });
}

// ── CSV export helpers ────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportRevenueReportCsv(from?: string, to?: string) {
  const res = await api.get("/reports/revenue/export", {
    params: { from, to },
    responseType: "blob",
  });
  triggerDownload(res.data, "revenue-report.csv");
}

export async function exportReceivablesReportCsv() {
  const res = await api.get("/reports/receivables/export", {
    responseType: "blob",
  });
  triggerDownload(res.data, "receivables-report.csv");
}

export async function exportExpenseReportCsv(from?: string, to?: string) {
  const res = await api.get("/reports/expenses/export", {
    params: { from, to },
    responseType: "blob",
  });
  triggerDownload(res.data, "expense-report.csv");
}

export async function exportTaxReportCsv(from?: string, to?: string) {
  const res = await api.get("/reports/tax/export", {
    params: { from, to },
    responseType: "blob",
  });
  triggerDownload(res.data, "tax-report.csv");
}

export async function exportGSTR1JSON(period: string) {
  const res = await api.get("/reports/gstr1/json", {
    params: { period },
    responseType: "blob",
  });
  triggerDownload(res.data, `GSTR1_${period}.json`);
}

export async function exportGSTR1CSV(period: string, section: string) {
  const res = await api.get("/reports/gstr1/csv", {
    params: { period, section },
    responseType: "blob",
  });
  triggerDownload(res.data, `GSTR1_${section}_${period}.csv`);
}
