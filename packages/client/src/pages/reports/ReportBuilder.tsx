import { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Receipt,
  DollarSign,
  Percent,
  Download,
  Save,
  Play,
  FileText,
  Wrench,
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@emp-billing/shared";
import { apiGet, apiPost, api } from "@/api/client";
import { useClients } from "@/api/hooks/client.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/common/Button";
import { Input, Select } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { Spinner } from "@/components/common/Spinner";
import {
  ReportFilters,
  type ReportFilterValues,
} from "@/components/reports/ReportFilters";
import { ReportTable, type ReportColumn } from "@/components/reports/ReportTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportType =
  | "revenue"
  | "receivables"
  | "tax"
  | "expenses"
  | "aging"
  | "pnl"
  | "custom";

interface SavedReportConfig {
  name: string;
  reportType: ReportType;
  filters: ReportFilterValues;
  visibleColumns: string[];
}

// ---------------------------------------------------------------------------
// Report type options
// ---------------------------------------------------------------------------

const REPORT_TYPES: { key: ReportType; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "revenue", label: "Revenue", icon: <TrendingUp className="h-5 w-5" />, description: "Revenue by period, client, or status" },
  { key: "receivables", label: "Receivables", icon: <DollarSign className="h-5 w-5" />, description: "Outstanding amounts by client" },
  { key: "tax", label: "Tax", icon: <Percent className="h-5 w-5" />, description: "Tax collected, GST/VAT breakdown" },
  { key: "expenses", label: "Expenses", icon: <Receipt className="h-5 w-5" />, description: "Expenses by category and period" },
  { key: "aging", label: "Aging", icon: <Clock className="h-5 w-5" />, description: "Receivables aging analysis" },
  { key: "pnl", label: "Profit & Loss", icon: <BarChart3 className="h-5 w-5" />, description: "Revenue vs expenses over time" },
  { key: "custom", label: "Custom", icon: <Wrench className="h-5 w-5" />, description: "Build a fully custom report" },
];

// ---------------------------------------------------------------------------
// Column definitions per report type
// ---------------------------------------------------------------------------

function getColumnsForType(reportType: ReportType): ReportColumn[] {
  const moneyFmt = (val: unknown) =>
    typeof val === "number" ? formatMoney(val, "INR") : "-";

  switch (reportType) {
    case "revenue":
      return [
        { key: "month", label: "Period", align: "left" },
        { key: "clientName", label: "Client", align: "left" },
        { key: "invoiceNumber", label: "Invoice #", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "revenue", label: "Revenue", align: "right", format: moneyFmt, summable: true },
        { key: "tax", label: "Tax", align: "right", format: moneyFmt, summable: true, defaultVisible: false },
        { key: "total", label: "Total", align: "right", format: moneyFmt, summable: true },
      ];
    case "receivables":
      return [
        { key: "clientName", label: "Client", align: "left" },
        { key: "invoiceNumber", label: "Invoice #", align: "left" },
        { key: "issueDate", label: "Issue Date", align: "left" },
        { key: "dueDate", label: "Due Date", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "invoiceTotal", label: "Invoice Total", align: "right", format: moneyFmt, summable: true },
        { key: "amountPaid", label: "Amount Paid", align: "right", format: moneyFmt, summable: true, defaultVisible: false },
        { key: "outstanding", label: "Outstanding", align: "right", format: moneyFmt, summable: true },
      ];
    case "tax":
      return [
        { key: "taxRateName", label: "Tax Rate", align: "left" },
        { key: "rate", label: "Rate (%)", align: "right" },
        { key: "taxableAmount", label: "Taxable Amount", align: "right", format: moneyFmt, summable: true },
        { key: "cgst", label: "CGST", align: "right", format: moneyFmt, summable: true },
        { key: "sgst", label: "SGST", align: "right", format: moneyFmt, summable: true },
        { key: "igst", label: "IGST", align: "right", format: moneyFmt, summable: true },
        { key: "totalTax", label: "Total Tax", align: "right", format: moneyFmt, summable: true },
        { key: "invoiceCount", label: "Invoices", align: "right", summable: true },
      ];
    case "expenses":
      return [
        { key: "category", label: "Category", align: "left" },
        { key: "vendorName", label: "Vendor", align: "left", defaultVisible: false },
        { key: "date", label: "Date", align: "left" },
        { key: "description", label: "Description", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "amount", label: "Amount", align: "right", format: moneyFmt, summable: true },
        { key: "tax", label: "Tax", align: "right", format: moneyFmt, summable: true, defaultVisible: false },
        { key: "total", label: "Total", align: "right", format: moneyFmt, summable: true },
        { key: "count", label: "Count", align: "right", summable: true },
      ];
    case "aging":
      return [
        { key: "clientName", label: "Client", align: "left" },
        { key: "current", label: "Current", align: "right", format: moneyFmt, summable: true },
        { key: "days1to30", label: "1-30 Days", align: "right", format: moneyFmt, summable: true },
        { key: "days31to60", label: "31-60 Days", align: "right", format: moneyFmt, summable: true },
        { key: "days61to90", label: "61-90 Days", align: "right", format: moneyFmt, summable: true },
        { key: "days90plus", label: "90+ Days", align: "right", format: moneyFmt, summable: true },
        { key: "total", label: "Total", align: "right", format: moneyFmt, summable: true },
      ];
    case "pnl":
      return [
        { key: "month", label: "Period", align: "left" },
        { key: "revenue", label: "Revenue", align: "right", format: moneyFmt, summable: true },
        { key: "expenses", label: "Expenses", align: "right", format: moneyFmt, summable: true },
        { key: "net", label: "Net Profit", align: "right", format: moneyFmt, summable: true },
        { key: "margin", label: "Margin (%)", align: "right", defaultVisible: false },
      ];
    case "custom":
    default:
      return [
        { key: "month", label: "Period", align: "left" },
        { key: "clientName", label: "Client", align: "left" },
        { key: "category", label: "Category", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "revenue", label: "Revenue", align: "right", format: moneyFmt, summable: true },
        { key: "expenses", label: "Expenses", align: "right", format: moneyFmt, summable: true },
        { key: "tax", label: "Tax", align: "right", format: moneyFmt, summable: true },
        { key: "net", label: "Net", align: "right", format: moneyFmt, summable: true },
        { key: "count", label: "Count", align: "right", summable: true },
      ];
  }
}

// ---------------------------------------------------------------------------
// API endpoint per report type
// ---------------------------------------------------------------------------

function getReportEndpoint(reportType: ReportType): string {
  switch (reportType) {
    case "revenue":
      return "/reports/revenue";
    case "receivables":
      return "/reports/receivables";
    case "tax":
      return "/reports/tax";
    case "expenses":
      return "/reports/expenses";
    case "aging":
      return "/reports/aging";
    case "pnl":
      return "/reports/profit-loss";
    case "custom":
      return "/reports/custom";
  }
}

// ---------------------------------------------------------------------------
// Helpers to normalize API response into flat row arrays
// ---------------------------------------------------------------------------

function normalizeReportData(
  reportType: ReportType,
  rawData: unknown,
): Record<string, unknown>[] {
  if (!rawData) return [];

  // The API responses have varied shapes; normalize to flat row arrays.
  if (Array.isArray(rawData)) return rawData as Record<string, unknown>[];

  const obj = rawData as Record<string, unknown>;

  // Revenue report returns { months: [...] }
  if ("months" in obj && Array.isArray(obj.months)) {
    return obj.months as Record<string, unknown>[];
  }

  // P&L returns { months: [...], totals: {...} }
  if ("months" in obj) {
    return (obj.months as Record<string, unknown>[]) ?? [];
  }

  return [];
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Saved reports local storage helpers
// ---------------------------------------------------------------------------

const SAVED_REPORTS_KEY = "emp_billing_saved_reports";

function loadSavedReports(): SavedReportConfig[] {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedReports(reports: SavedReportConfig[]) {
  localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportBuilder() {
  const queryClient = useQueryClient();

  // Report type
  const [reportType, setReportType] = useState<ReportType>("revenue");

  // Filters
  const [filters, setFilters] = useState<ReportFilterValues>({
    dateFrom: dayjs().startOf("year").format("YYYY-MM-DD"),
    dateTo: dayjs().format("YYYY-MM-DD"),
    clientId: "",
    statuses: [],
    currency: "",
    category: "",
    groupBy: "",
  });

  // Column visibility (tracked separately for the save feature)
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() =>
    getColumnsForType("revenue")
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.key),
  );

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [reportName, setReportName] = useState("");

  // Has the user clicked "Run Report"?
  const [executed, setExecuted] = useState(false);

  // Load saved report from session storage (when navigating from SavedReports)
  useEffect(() => {
    const stored = sessionStorage.getItem("emp_billing_run_report");
    if (stored) {
      try {
        const config = JSON.parse(stored) as SavedReportConfig;
        setReportType(config.reportType);
        setFilters(config.filters);
        setVisibleColumnKeys(config.visibleColumns);
        setExecuted(true);
      } catch {
        // ignore parse errors
      }
      sessionStorage.removeItem("emp_billing_run_report");
    }
  }, []);

  // Columns for current report type
  const columns = useMemo(() => getColumnsForType(reportType), [reportType]);

  // When report type changes, reset column visibility
  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    setExecuted(false);
    const cols = getColumnsForType(type);
    setVisibleColumnKeys(
      cols.filter((c) => c.defaultVisible !== false).map((c) => c.key),
    );
  };

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.dateFrom) params.from = filters.dateFrom;
    if (filters.dateTo) params.to = filters.dateTo;
    if (filters.clientId) params.clientId = filters.clientId;
    if (filters.statuses.length > 0) params.statuses = filters.statuses.join(",");
    if (filters.currency) params.currency = filters.currency;
    if (filters.category) params.category = filters.category;
    if (filters.groupBy) params.groupBy = filters.groupBy;
    return params;
  }, [filters]);

  // Fetch report data
  const endpoint = getReportEndpoint(reportType);
  const {
    data: reportResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["report-builder", reportType, queryParams],
    queryFn: () => apiGet<unknown>(endpoint, queryParams),
    enabled: executed,
  });

  // Normalize data
  const tableData = useMemo(
    () => normalizeReportData(reportType, reportResponse?.data),
    [reportType, reportResponse],
  );

  // Client list for filter dropdown
  const { data: clientsResponse } = useClients();
  const clientList = useMemo(() => {
    const raw = clientsResponse?.data;
    if (!Array.isArray(raw)) return [];
    return raw.map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? c.displayName ?? ""),
    }));
  }, [clientsResponse]);

  // Expense categories (fetch when needed)
  const { data: categoriesResponse } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () =>
      apiGet<{ id: string; name: string }[]>("/expense-categories"),
    enabled: reportType === "expenses" || reportType === "custom",
  });
  const categoryList = useMemo(() => {
    const raw = categoriesResponse?.data;
    if (!Array.isArray(raw)) return [];
    return raw.map((c) => ({ id: String(c.id), name: String(c.name) }));
  }, [categoriesResponse]);

  // Run report
  const handleRunReport = useCallback(() => {
    setExecuted(true);
    // Invalidate so it re-fetches with current params
    queryClient.invalidateQueries({
      queryKey: ["report-builder", reportType],
    });
  }, [reportType, queryClient]);

  // Export CSV
  const handleExportCsv = useCallback(async () => {
    try {
      const exportUrl = `${endpoint}/export`;
      const res = await api.get(exportUrl, {
        params: queryParams,
        responseType: "blob",
      });
      triggerDownload(
        res.data,
        `${reportType}-report-${dayjs().format("YYYY-MM-DD")}.csv`,
      );
      toast.success("Report exported as CSV");
    } catch {
      // Fallback: generate CSV from table data
      if (tableData.length === 0) {
        toast.error("No data to export");
        return;
      }
      const visibleCols = columns.filter((c) => visibleColumnKeys.includes(c.key));
      const header = visibleCols.map((c) => c.label).join(",");
      const rows = tableData.map((row) =>
        visibleCols
          .map((col) => {
            const val = row[col.key];
            if (val == null) return "";
            const str = String(val);
            return str.includes(",") ? `"${str}"` : str;
          })
          .join(","),
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      triggerDownload(
        blob,
        `${reportType}-report-${dayjs().format("YYYY-MM-DD")}.csv`,
      );
      toast.success("Report exported as CSV");
    }
  }, [endpoint, queryParams, reportType, tableData, columns, visibleColumnKeys]);

  // Export PDF
  const handleExportPdf = useCallback(async () => {
    try {
      const exportUrl = `${endpoint}/export/pdf`;
      const res = await api.get(exportUrl, {
        params: queryParams,
        responseType: "blob",
      });
      triggerDownload(
        res.data,
        `${reportType}-report-${dayjs().format("YYYY-MM-DD")}.pdf`,
      );
      toast.success("Report exported as PDF");
    } catch {
      toast.error("PDF export is not available for this report type");
    }
  }, [endpoint, queryParams, reportType]);

  // Save report config
  const handleSave = () => {
    if (!reportName.trim()) {
      toast.error("Please enter a report name");
      return;
    }
    const config: SavedReportConfig = {
      name: reportName.trim(),
      reportType,
      filters,
      visibleColumns: visibleColumnKeys,
    };
    const existing = loadSavedReports();
    const idx = existing.findIndex((r) => r.name === config.name);
    if (idx >= 0) {
      existing[idx] = config;
    } else {
      existing.push(config);
    }
    persistSavedReports(existing);
    toast.success(`Report "${config.name}" saved`);
    setSaveModalOpen(false);
    setReportName("");
  };

  // Load a saved report config
  const loadReport = (config: SavedReportConfig) => {
    setReportType(config.reportType);
    setFilters(config.filters);
    setVisibleColumnKeys(config.visibleColumns);
    setExecuted(false);
    toast.success(`Loaded report "${config.name}"`);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Report Builder"
        subtitle="Create custom reports with filters, grouping, and column selection"
        breadcrumb={[
          { label: "Reports", href: "/reports" },
          { label: "Report Builder" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Save className="h-4 w-4" />}
              onClick={() => setSaveModalOpen(true)}
            >
              Save Report
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="h-4 w-4" />}
              onClick={handleRunReport}
              loading={isFetching}
            >
              Run Report
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        {/* Report Type Selector */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
            Report Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.key}
                onClick={() => handleReportTypeChange(rt.key)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center ${
                  reportType === rt.key
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span
                  className={
                    reportType === rt.key ? "text-brand-600" : "text-gray-400"
                  }
                >
                  {rt.icon}
                </span>
                <span className="text-xs font-semibold">{rt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <ReportFilters
          values={filters}
          onChange={setFilters}
          reportType={reportType}
          clients={clientList}
          categories={categoryList}
        />

        {/* Column Selector */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
            Columns
          </label>
          <div className="flex flex-wrap gap-2">
            {columns.map((col) => {
              const visible = visibleColumnKeys.includes(col.key);
              return (
                <label
                  key={col.key}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    visible
                      ? "bg-brand-50 text-brand-700 border border-brand-200"
                      : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => {
                      setVisibleColumnKeys((prev) => {
                        if (prev.includes(col.key)) {
                          if (prev.length <= 1) return prev;
                          return prev.filter((k) => k !== col.key);
                        }
                        return [...prev, col.key];
                      });
                    }}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                  />
                  {col.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Export actions */}
        {executed && tableData.length > 0 && (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<FileText className="h-4 w-4" />}
              onClick={handleExportPdf}
            >
              Export PDF
            </Button>
          </div>
        )}

        {/* Results Table */}
        {executed && (
          <ReportTable
            columns={columns.filter((c) => visibleColumnKeys.includes(c.key))}
            data={tableData}
            rowKey={reportType === "aging" ? "clientId" : "id"}
            loading={isLoading}
            showSummary
            emptyMessage="No data found. Try adjusting your filters or date range."
          />
        )}

        {/* Pre-run placeholder */}
        {!executed && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-base font-semibold text-gray-700">
              Configure and Run Your Report
            </h3>
            <p className="mt-1 text-sm text-gray-500 max-w-md">
              Select a report type, set your filters and date range, choose
              which columns to display, then click "Run Report" to generate
              results.
            </p>
          </div>
        )}
      </div>

      {/* Save Report Modal */}
      <Modal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Report Configuration"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Report Name"
            placeholder="e.g., Monthly Revenue by Client"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            required
          />
          <div className="text-xs text-gray-500">
            <p>This will save the current configuration:</p>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li>
                Report type:{" "}
                <span className="font-medium text-gray-700">
                  {REPORT_TYPES.find((r) => r.key === reportType)?.label}
                </span>
              </li>
              <li>
                Date range:{" "}
                <span className="font-medium text-gray-700">
                  {filters.dateFrom} to {filters.dateTo}
                </span>
              </li>
              <li>
                Visible columns:{" "}
                <span className="font-medium text-gray-700">
                  {visibleColumnKeys.length} of {columns.length}
                </span>
              </li>
              {filters.clientId && <li>Client filter applied</li>}
              {filters.statuses.length > 0 && (
                <li>{filters.statuses.length} status filter(s)</li>
              )}
              {filters.groupBy && (
                <li>
                  Grouped by:{" "}
                  <span className="font-medium text-gray-700">
                    {filters.groupBy}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
