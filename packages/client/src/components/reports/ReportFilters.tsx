import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { Input, Select } from "@/components/common/Input";

dayjs.extend(quarterOfYear);
import { Button } from "@/components/common/Button";
import { InvoiceStatus, ExpenseStatus } from "@emp-billing/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportFilterValues {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  statuses: string[];
  currency: string;
  category: string;
  groupBy: string;
}

interface ReportFiltersProps {
  values: ReportFilterValues;
  onChange: (values: ReportFilterValues) => void;
  reportType: string;
  /** Minimal list of clients for the dropdown */
  clients?: { id: string; name: string }[];
  /** Expense categories */
  categories?: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

type DatePresetKey =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "last_month"
  | "last_quarter"
  | "last_year"
  | "custom";

interface DatePreset {
  key: DatePresetKey;
  label: string;
  from: () => string;
  to: () => string;
}

const DATE_PRESETS: DatePreset[] = [
  {
    key: "today",
    label: "Today",
    from: () => dayjs().format("YYYY-MM-DD"),
    to: () => dayjs().format("YYYY-MM-DD"),
  },
  {
    key: "this_week",
    label: "This Week",
    from: () => dayjs().startOf("week").format("YYYY-MM-DD"),
    to: () => dayjs().endOf("week").format("YYYY-MM-DD"),
  },
  {
    key: "this_month",
    label: "This Month",
    from: () => dayjs().startOf("month").format("YYYY-MM-DD"),
    to: () => dayjs().endOf("month").format("YYYY-MM-DD"),
  },
  {
    key: "this_quarter",
    label: "This Quarter",
    from: () => dayjs().startOf("quarter").format("YYYY-MM-DD"),
    to: () => dayjs().endOf("quarter").format("YYYY-MM-DD"),
  },
  {
    key: "this_year",
    label: "This Year",
    from: () => dayjs().startOf("year").format("YYYY-MM-DD"),
    to: () => dayjs().endOf("year").format("YYYY-MM-DD"),
  },
  {
    key: "last_month",
    label: "Last Month",
    from: () => dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
    to: () => dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
  },
  {
    key: "last_quarter",
    label: "Last Quarter",
    from: () => dayjs().subtract(1, "quarter").startOf("quarter").format("YYYY-MM-DD"),
    to: () => dayjs().subtract(1, "quarter").endOf("quarter").format("YYYY-MM-DD"),
  },
  {
    key: "last_year",
    label: "Last Year",
    from: () => dayjs().subtract(1, "year").startOf("year").format("YYYY-MM-DD"),
    to: () => dayjs().subtract(1, "year").endOf("year").format("YYYY-MM-DD"),
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVOICE_STATUS_OPTIONS = Object.values(InvoiceStatus).map((s) => ({
  value: s,
  label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const EXPENSE_STATUS_OPTIONS = Object.values(ExpenseStatus).map((s) => ({
  value: s,
  label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const CURRENCIES = [
  { value: "", label: "All Currencies" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "JPY", label: "JPY - Japanese Yen" },
];

const GROUP_BY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  revenue: [
    { value: "", label: "No Grouping" },
    { value: "client", label: "By Client" },
    { value: "month", label: "By Month" },
    { value: "quarter", label: "By Quarter" },
    { value: "status", label: "By Status" },
  ],
  receivables: [
    { value: "", label: "No Grouping" },
    { value: "client", label: "By Client" },
    { value: "status", label: "By Status" },
  ],
  tax: [
    { value: "", label: "No Grouping" },
    { value: "month", label: "By Month" },
    { value: "quarter", label: "By Quarter" },
  ],
  expenses: [
    { value: "", label: "No Grouping" },
    { value: "category", label: "By Category" },
    { value: "month", label: "By Month" },
    { value: "quarter", label: "By Quarter" },
  ],
  aging: [
    { value: "", label: "No Grouping" },
    { value: "client", label: "By Client" },
  ],
  pnl: [
    { value: "", label: "No Grouping" },
    { value: "month", label: "By Month" },
    { value: "quarter", label: "By Quarter" },
  ],
  custom: [
    { value: "", label: "No Grouping" },
    { value: "client", label: "By Client" },
    { value: "month", label: "By Month" },
    { value: "quarter", label: "By Quarter" },
    { value: "status", label: "By Status" },
    { value: "category", label: "By Category" },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportFilters({
  values,
  onChange,
  reportType,
  clients = [],
  categories = [],
}: ReportFiltersProps) {
  const [expanded, setExpanded] = useState(true);
  const [activePreset, setActivePreset] = useState<DatePresetKey>("this_year");

  const update = (partial: Partial<ReportFilterValues>) => {
    onChange({ ...values, ...partial });
  };

  const handlePresetClick = (preset: DatePreset) => {
    setActivePreset(preset.key);
    update({ dateFrom: preset.from(), dateTo: preset.to() });
  };

  const handleStatusToggle = (status: string) => {
    const current = values.statuses;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    update({ statuses: next });
  };

  const clearFilters = () => {
    onChange({
      dateFrom: dayjs().startOf("year").format("YYYY-MM-DD"),
      dateTo: dayjs().format("YYYY-MM-DD"),
      clientId: "",
      statuses: [],
      currency: "",
      category: "",
      groupBy: "",
    });
    setActivePreset("this_year");
  };

  const statusOptions =
    reportType === "expenses" ? EXPENSE_STATUS_OPTIONS : INVOICE_STATUS_OPTIONS;

  const showStatusFilter = ["revenue", "receivables", "aging", "expenses", "custom"].includes(reportType);
  const showCategoryFilter = ["expenses", "custom"].includes(reportType);
  const showCurrencyFilter = true;
  const showClientFilter = ["revenue", "receivables", "aging", "pnl", "custom"].includes(reportType);

  const groupByOpts = GROUP_BY_OPTIONS[reportType] ?? GROUP_BY_OPTIONS.custom;

  const hasActiveFilters =
    values.clientId !== "" ||
    values.statuses.length > 0 ||
    values.currency !== "" ||
    values.category !== "";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">
            Filters & Options
          </span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
              Active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
          {/* Date range presets */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Date Range
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetClick(preset)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activePreset === preset.key
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setActivePreset("custom")}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activePreset === "custom"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Custom
              </button>
            </div>
            <div className="flex items-end gap-3">
              <div className="w-44">
                <Input
                  label="From"
                  type="date"
                  value={values.dateFrom}
                  onChange={(e) => {
                    setActivePreset("custom");
                    update({ dateFrom: e.target.value });
                  }}
                />
              </div>
              <div className="w-44">
                <Input
                  label="To"
                  type="date"
                  value={values.dateTo}
                  onChange={(e) => {
                    setActivePreset("custom");
                    update({ dateTo: e.target.value });
                  }}
                />
              </div>
              <Calendar className="h-4 w-4 text-gray-400 mb-2.5" />
            </div>
          </div>

          {/* Second row: Client, Currency, Category, Group By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {showClientFilter && (
              <Select
                label="Client"
                value={values.clientId}
                onChange={(e) => update({ clientId: e.target.value })}
              >
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}

            {showCurrencyFilter && (
              <Select
                label="Currency"
                value={values.currency}
                onChange={(e) => update({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}

            {showCategoryFilter && (
              <Select
                label="Category"
                value={values.category}
                onChange={(e) => update({ category: e.target.value })}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}

            <Select
              label="Group By"
              value={values.groupBy}
              onChange={(e) => update({ groupBy: e.target.value })}
            >
              {groupByOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Status multi-select */}
          {showStatusFilter && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Status Filter
              </label>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((opt) => {
                  const active = values.statuses.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusToggle(opt.value)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        active
                          ? "bg-brand-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clear button */}
          {hasActiveFilters && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
