import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, Users, AlertTriangle, TrendingUp, Plus, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useDashboardStats, useRevenueReport, useExpenseReport } from "@/api/hooks/report.hooks";
import { StatsCard } from "@/components/common/StatsCard";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney } from "@emp-billing/shared";
import dayjs from "dayjs";

const AGING_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];
const AGING_LABELS = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"];

const EXPENSE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function formatCompact(value: number): string {
  return formatMoney(value, "INR");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function revenueTooltipFormatter(value: any) {
  return [formatMoney(Number(value) * 100, "INR"), "Revenue"];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function agingTooltipFormatter(value: any) {
  return [formatMoney(Number(value), "INR")];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expenseTooltipFormatter(value: any) {
  return [formatMoney(Number(value), "INR")];
}

export function DashboardPage() {
  const sixMonthsAgo = useMemo(() => dayjs().subtract(6, "month").format("YYYY-MM-DD"), []);
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const { data: dashboardRes, isLoading } = useDashboardStats();
  const { data: revenueRes } = useRevenueReport(sixMonthsAgo, today);
  const { data: expenseRes } = useExpenseReport(sixMonthsAgo, today);

  const stats = dashboardRes?.data;
  const revenueMonths = revenueRes?.data?.months ?? [];
  const expenses = expenseRes?.data ?? [];

  // Transform revenue data: convert paise to rupees for chart display and format month labels
  const revenueChartData = useMemo(
    () =>
      revenueMonths.map((m) => ({
        month: dayjs(m.month).format("MMM"),
        revenue: m.revenue / 100,
      })),
    [revenueMonths],
  );

  // Transform aging data from dashboard stats into pie chart segments
  const agingChartData = useMemo(() => {
    if (!stats?.receivablesAging) return [];
    const aging = stats.receivablesAging;
    return [
      { name: "Current", value: aging.current },
      { name: "1-30 days", value: aging.days1to30 },
      { name: "31-60 days", value: aging.days31to60 },
      { name: "61-90 days", value: aging.days61to90 },
      { name: "90+ days", value: aging.days90plus },
    ].filter((d) => d.value > 0);
  }, [stats?.receivablesAging]);

  // Transform expense data for pie chart
  const expenseChartData = useMemo(
    () =>
      expenses.map((e) => ({
        name: e.category,
        value: e.total,
      })),
    [expenses],
  );

  const recentInvoices = stats?.recentInvoices ?? [];
  const recentPayments = stats?.recentPayments ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dayjs().format("dddd, D MMMM YYYY")}</p>
        </div>
        <Link to="/invoices/new">
          <Button icon={<Plus className="h-4 w-4" />}>New Invoice</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Revenue"
          value={formatCompact(stats?.totalRevenue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          label="Outstanding"
          value={formatCompact(stats?.totalOutstanding ?? 0)}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Overdue"
          value={formatCompact(stats?.totalOverdue ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
        />
        <StatsCard
          label="Expenses"
          value={formatCompact(stats?.totalExpenses ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          color="yellow"
        />
      </div>

      {/* Charts Row 1: Revenue (2/3) + Aging Donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Month Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Month</h2>
          {revenueChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No revenue data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={revenueTooltipFormatter} contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Receivables Aging Donut */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Receivables Aging</h2>
          {agingChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No aging data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agingChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {agingChartData.map((_, index) => {
                    const colorIdx = AGING_LABELS.indexOf(agingChartData[index].name);
                    return <Cell key={`aging-${index}`} fill={AGING_COLORS[colorIdx >= 0 ? colorIdx : index]} />;
                  })}
                </Pie>
                <Tooltip formatter={agingTooltipFormatter} contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Expense Pie (1/3) + empty space */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expenses by Category Pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Expenses by Category</h2>
          {expenseChartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No expense data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseChartData.map((_, index) => (
                    <Cell key={`expense-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={expenseTooltipFormatter} contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Invoices + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Recent Invoices</h2>
            <Link to="/invoices" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentInvoices.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No invoices yet</p>
            ) : recentInvoices.slice(0, 5).map((inv) => (
              <Link key={inv.id} to={`/invoices/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Due {dayjs(inv.dueDate).format("DD MMM YYYY")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatMoney(inv.total, inv.currency)}</p>
                  <div className="mt-1 flex justify-end"><InvoiceStatusBadge status={inv.status} /></div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Recent Payments</h2>
            <Link to="/payments" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentPayments.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No payments yet</p>
            ) : recentPayments.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pay.paymentNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{String(pay.method).replace(/_/g, " ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">+{formatMoney(pay.amount, "INR")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{dayjs(pay.date).format("DD MMM")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
