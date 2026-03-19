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
