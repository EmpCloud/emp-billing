import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import {
  useMRR,
  useARR,
  useChurnMetrics,
  useLTV,
  useRevenueBreakdown,
  useSubscriptionStats,
  useCohortAnalysis,
} from "@/api/hooks/metrics.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { StatsCard } from "@/components/common/StatsCard";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney } from "@emp-billing/shared";
import dayjs from "dayjs";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCompact(value: number): string {
  return formatMoney(value, "INR");
}

function GrowthIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-500 text-xs">0%</span>;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(value)}%
    </span>
  );
}

function getRetentionColor(pct: number): string {
  if (pct >= 90) return "bg-green-500 text-white";
  if (pct >= 70) return "bg-green-300 text-green-900";
  if (pct >= 50) return "bg-yellow-200 text-yellow-900";
  if (pct >= 30) return "bg-orange-300 text-orange-900";
  return "bg-red-400 text-white";
}

// ── Section Components ──────────────────────────────────────────────────────

function KeyMetricsCards() {
  const { data: mrrRes, isLoading: mrrLoading } = useMRR();
  const { data: arrRes, isLoading: arrLoading } = useARR();
  const { data: churnRes, isLoading: churnLoading } = useChurnMetrics();
  const { data: ltvRes, isLoading: ltvLoading } = useLTV();

  const mrr = mrrRes?.data;
  const arr = arrRes?.data;
  const churn = churnRes?.data;
  const ltv = ltvRes?.data;

  const isLoading = mrrLoading || arrLoading || churnLoading || ltvLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">MRR</span>
          <TrendingUp className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{formatCompact(mrr?.mrr ?? 0)}</p>
        <div className="mt-1">
          <GrowthIndicator value={mrr?.mrrGrowth ?? 0} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">ARR</span>
          <DollarSign className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{formatCompact(arr?.arr ?? 0)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Customer Churn</span>
          <TrendingDown className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{churn?.customerChurn ?? 0}%</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Net Revenue Retention</span>
          <BarChart3 className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{churn?.netRevenueRetention ?? 0}%</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Average LTV</span>
          <Users className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{formatCompact(ltv?.ltv ?? 0)}</p>
        <p className="text-xs text-gray-400 mt-1">
          ~{ltv?.averageSubscriptionDurationMonths ?? 0} months avg
        </p>
      </div>
    </div>
  );
}

function RevenueBreakdownChart() {
  const { data: breakdownRes, isLoading } = useRevenueBreakdown(12);
  const breakdown = breakdownRes?.data ?? [];

  const chartData = useMemo(
    () =>
      breakdown.map((m) => ({
        month: dayjs(m.month).format("MMM YY"),
        New: m.newMRR / 100,
        Expansion: m.expansionMRR / 100,
        Contraction: -(m.contractionMRR / 100),
        Churn: -(m.churnMRR / 100),
        Net: m.netNewMRR / 100,
      })),
    [breakdown],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-400">
        No revenue breakdown data available
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        />
        <Legend
          verticalAlign="top"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingBottom: "12px" }}
        />
        <Bar dataKey="New" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Expansion" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Contraction" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Churn" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
        <Line
          type="monotone"
          dataKey="Net"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function SubscriptionFunnel() {
  const { data: statsRes, isLoading } = useSubscriptionStats();
  const stats = statsRes?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        label="Trialing"
        value={String(stats?.totalTrialing ?? 0)}
        icon={<Users className="h-5 w-5" />}
        color="blue"
      />
      <StatsCard
        label="Active"
        value={String(stats?.totalActive ?? 0)}
        icon={<Users className="h-5 w-5" />}
        color="green"
      />
      <StatsCard
        label="Past Due"
        value={String(stats?.totalPastDue ?? 0)}
        icon={<Users className="h-5 w-5" />}
        color="red"
      />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Trial to Active</span>
          <TrendingUp className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">{stats?.conversionRate ?? 0}%</p>
        <p className="text-xs text-gray-400 mt-1">
          Avg {formatCompact(stats?.averageRevenuePerSubscription ?? 0)}/sub
        </p>
      </div>
    </div>
  );
}

function CohortRetentionTable() {
  const { data: cohortRes, isLoading } = useCohortAnalysis(12);
  const cohorts = cohortRes?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  // Find the maximum number of retention columns
  const maxCols = cohorts.reduce(
    (max, c) => Math.max(max, c.retentionByMonth.length),
    0,
  );

  if (cohorts.length === 0 || maxCols === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-400">
        No cohort data available yet
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50">
              Cohort
            </th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Users</th>
            {Array.from({ length: maxCols }, (_, i) => (
              <th key={i} className="px-3 py-2 text-center font-medium text-gray-500">
                M{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortMonth}>
              <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap sticky left-0 bg-white">
                {dayjs(cohort.cohortMonth).format("MMM YY")}
              </td>
              <td className="px-3 py-2 text-right text-gray-600">
                {cohort.totalSubscriptions}
              </td>
              {Array.from({ length: maxCols }, (_, i) => {
                const pct = cohort.retentionByMonth[i];
                if (pct === undefined) {
                  return <td key={i} className="px-3 py-2" />;
                }
                return (
                  <td key={i} className="px-1 py-1 text-center">
                    <span
                      className={`inline-block w-full rounded px-2 py-1 text-xs font-medium ${getRetentionColor(
                        pct,
                      )}`}
                    >
                      {pct}%
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function SaaSMetricsPage() {
  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="SaaS Metrics"
        subtitle="Key subscription metrics and analytics"
      />

      {/* Section 1: Key Metrics Cards */}
      <KeyMetricsCards />

      {/* Section 2: Revenue Breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          MRR Revenue Breakdown
        </h2>
        <RevenueBreakdownChart />
      </div>

      {/* Section 3: Subscription Funnel */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Subscription Funnel
        </h2>
        <SubscriptionFunnel />
      </div>

      {/* Section 4: Cohort Retention */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Cohort Retention Analysis
        </h2>
        <CohortRetentionTable />
      </div>
    </div>
  );
}
