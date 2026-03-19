import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Receipt,
  DollarSign,
  Users,
  Percent,
  Download,
} from "lucide-react";
import dayjs from "dayjs";
import { formatMoney } from "@emp-billing/shared";
import {
  useRevenueReport,
  useReceivablesReport,
  useAgingReport,
  useExpenseReport,
  useProfitLossReport,
  useTaxReport,
  useTopClients,
  exportRevenueReportCsv,
  exportReceivablesReportCsv,
  exportExpenseReportCsv,
  exportTaxReportCsv,
} from "@/api/hooks/report.hooks";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { StatsCard } from "@/components/common/StatsCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/common/Input";

type Tab = "revenue" | "receivables" | "aging" | "expenses" | "pnl" | "tax";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "revenue", label: "Revenue", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "receivables", label: "Receivables", icon: <DollarSign className="h-4 w-4" /> },
  { key: "aging", label: "Aging", icon: <Clock className="h-4 w-4" /> },
  { key: "expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" /> },
  { key: "pnl", label: "P&L", icon: <BarChart3 className="h-4 w-4" /> },
  { key: "tax", label: "Tax", icon: <Percent className="h-4 w-4" /> },
];

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-44">
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="lg" />
    </div>
  );
}

function RevenueTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useRevenueReport(
    from || undefined,
    to || undefined,
  );
  const months = data?.data?.months ?? [];

  const handleExport = async () => {
    try {
      await exportRevenueReportCsv(from || undefined, to || undefined);
    } catch {
      toast.error("Failed to export revenue report");
    }
  };

  if (isLoading) return <LoadingBlock />;
  if (months.length === 0)
    return (
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title="No revenue data"
        description="Revenue data will appear once invoices are paid."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Month
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {months.map((row) => (
            <tr key={row.month} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-700">
                {dayjs(row.month).format("MMM YYYY")}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMoney(row.revenue, "INR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function ReceivablesTab() {
  const { data, isLoading } = useReceivablesReport();
  const rows = data?.data ?? [];

  const handleExport = async () => {
    try {
      await exportReceivablesReportCsv();
    } catch {
      toast.error("Failed to export receivables report");
    }
  };

  if (isLoading) return <LoadingBlock />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<DollarSign className="h-12 w-12" />}
        title="No outstanding receivables"
        description="All invoices are paid. Nice work!"
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Client
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Outstanding
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr
              key={row.clientId}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-gray-700">{row.clientName}</td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMoney(row.outstanding, row.currency || "INR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function AgingTab() {
  const { data, isLoading } = useAgingReport();
  const rows = data?.data ?? [];

  if (isLoading) return <LoadingBlock />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<Clock className="h-12 w-12" />}
        title="No aging data"
        description="Aging details will appear when invoices are outstanding."
      />
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Client
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Current
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              1-30 Days
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              31-60 Days
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              61-90 Days
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              90+ Days
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const cur = row.currency || "INR";
            return (
              <tr
                key={row.clientId}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-700">{row.clientName}</td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.current, cur)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.days1to30, cur)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.days31to60, cur)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.days61to90, cur)}
                </td>
                <td className="px-4 py-3 text-right text-red-600 font-medium">
                  {formatMoney(row.days90plus, cur)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatMoney(row.total, cur)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpensesTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useExpenseReport(
    from || undefined,
    to || undefined,
  );
  const rows = data?.data ?? [];

  const handleExport = async () => {
    try {
      await exportExpenseReportCsv(from || undefined, to || undefined);
    } catch {
      toast.error("Failed to export expense report");
    }
  };

  if (isLoading) return <LoadingBlock />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<Receipt className="h-12 w-12" />}
        title="No expense data"
        description="Expense reports will appear once expenses are recorded."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Category
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Count
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr
              key={row.category}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-gray-700">{row.category}</td>
              <td className="px-4 py-3 text-right text-gray-600">
                {row.count}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMoney(row.total, row.currency || "INR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function ProfitLossTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useProfitLossReport(
    from || undefined,
    to || undefined,
  );
  const report = data?.data;
  const months = report?.months ?? [];
  const totals = report?.totals;

  if (isLoading) return <LoadingBlock />;
  if (months.length === 0)
    return (
      <EmptyState
        icon={<BarChart3 className="h-12 w-12" />}
        title="No P&L data"
        description="Profit & loss data will appear once you have revenue or expenses."
      />
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Month
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Revenue
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Expenses
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {months.map((row) => (
            <tr key={row.month} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-700">
                {dayjs(row.month).format("MMM YYYY")}
              </td>
              <td className="px-4 py-3 text-right font-medium text-green-600">
                {formatMoney(row.revenue, "INR")}
              </td>
              <td className="px-4 py-3 text-right font-medium text-red-600">
                {formatMoney(row.expenses, "INR")}
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatMoney(row.net, "INR")}
              </td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-4 py-3 text-gray-800">Total</td>
              <td className="px-4 py-3 text-right text-green-700">
                {formatMoney(totals.revenue, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-red-700">
                {formatMoney(totals.expenses, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-gray-900">
                {formatMoney(totals.net, "INR")}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function TaxTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useTaxReport(
    from || undefined,
    to || undefined,
  );
  const rows = data?.data ?? [];

  const handleExport = async () => {
    try {
      await exportTaxReportCsv(from || undefined, to || undefined);
    } catch {
      toast.error("Failed to export tax report");
    }
  };

  if (isLoading) return <LoadingBlock />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<Percent className="h-12 w-12" />}
        title="No tax data"
        description="Tax data will appear once invoices with tax are created."
      />
    );

  const totalTaxable = rows.reduce((s, r) => s + r.taxableAmount, 0);
  const totalCGST = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSGST = rows.reduce((s, r) => s + r.sgst, 0);
  const totalIGST = rows.reduce((s, r) => s + r.igst, 0);
  const totalTax = rows.reduce((s, r) => s + r.totalTax, 0);

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatsCard
          label="Taxable Amount"
          value={formatMoney(totalTaxable, "INR")}
          icon={<DollarSign className="h-5 w-5" />}
          color="default"
        />
        <StatsCard
          label="Total CGST"
          value={formatMoney(totalCGST, "INR")}
          icon={<Percent className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Total SGST"
          value={formatMoney(totalSGST, "INR")}
          icon={<Percent className="h-5 w-5" />}
          color="purple"
        />
        <StatsCard
          label="Total IGST"
          value={formatMoney(totalIGST, "INR")}
          icon={<Percent className="h-5 w-5" />}
          color="yellow"
        />
        <StatsCard
          label="Total Tax"
          value={formatMoney(totalTax, "INR")}
          icon={<Percent className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Detailed table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                Tax Rate
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Rate
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Taxable Amount
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                CGST
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                SGST
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                IGST
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Total Tax
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Invoices
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr
                key={row.taxRateId ?? `rate-${row.rate}`}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-700">{row.taxRateName}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {row.rate}%
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(row.taxableAmount, "INR")}
                </td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {formatMoney(row.cgst, "INR")}
                </td>
                <td className="px-4 py-3 text-right text-brand-600">
                  {formatMoney(row.sgst, "INR")}
                </td>
                <td className="px-4 py-3 text-right text-amber-600">
                  {formatMoney(row.igst, "INR")}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatMoney(row.totalTax, "INR")}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {row.invoiceCount}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-4 py-3 text-gray-800">Total</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right">
                {formatMoney(totalTaxable, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-blue-700">
                {formatMoney(totalCGST, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-brand-700">
                {formatMoney(totalSGST, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-amber-700">
                {formatMoney(totalIGST, "INR")}
              </td>
              <td className="px-4 py-3 text-right text-gray-900">
                {formatMoney(totalTax, "INR")}
              </td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TopClientsCard({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useTopClients(
    from || undefined,
    to || undefined,
  );
  const clients = data?.data ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">Top Clients</h3>
      </div>
      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      )}
      {!isLoading && clients.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">
          No client data yet.
        </p>
      )}
      {!isLoading && clients.length > 0 && (
        <ul className="space-y-3">
          {clients.slice(0, 5).map((c, i) => (
            <li key={c.clientId} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 truncate">
                  {c.clientName}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-3">
                {formatMoney(c.revenue, c.currency || "INR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("revenue");
  const defaultFrom = dayjs().startOf("year").format("YYYY-MM-DD");
  const defaultTo = dayjs().format("YYYY-MM-DD");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const needsDateRange = tab === "revenue" || tab === "expenses" || tab === "pnl" || tab === "tax";

  return (
    <div className="p-6">
      <PageHeader
        title="Reports"
        subtitle="Financial reports and analytics"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab navigation */}
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Date range filter for applicable tabs */}
          {needsDateRange && (
            <DateRangeFilter
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
            />
          )}

          {/* Tab content */}
          {tab === "revenue" && <RevenueTab from={from} to={to} />}
          {tab === "receivables" && <ReceivablesTab />}
          {tab === "aging" && <AgingTab />}
          {tab === "expenses" && <ExpensesTab from={from} to={to} />}
          {tab === "pnl" && <ProfitLossTab from={from} to={to} />}
          {tab === "tax" && <TaxTab from={from} to={to} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <TopClientsCard from={from} to={to} />
        </div>
      </div>
    </div>
  );
}
