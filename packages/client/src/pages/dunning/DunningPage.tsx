import { useState } from "react";
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  useDunningSummary,
  useDunningAttempts,
  useRetryDunning,
} from "@/api/hooks/dunning.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { StatsCard } from "@/components/common/StatsCard";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { formatMoney } from "@emp-billing/shared";
import type { DunningAttemptStatus } from "@emp-billing/shared";
import dayjs from "dayjs";

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700",
    icon: <Clock className="h-3 w-3" />,
  },
  success: {
    label: "Success",
    className: "bg-green-100 text-green-700",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
    icon: <XCircle className="h-3 w-3" />,
  },
  skipped: {
    label: "Skipped",
    className: "bg-gray-100 text-gray-600",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

export function DunningPage() {
  const [statusFilter, setStatusFilter] = useState<DunningAttemptStatus | "">("");
  const [page, setPage] = useState(1);

  const { data: summaryRes, isLoading: summaryLoading } = useDunningSummary();
  const { data: attemptsRes, isLoading: attemptsLoading } = useDunningAttempts({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const retryMutation = useRetryDunning();

  const summary = summaryRes?.data;
  const attempts = attemptsRes?.data ?? [];
  const meta = attemptsRes?.meta;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dunning Management"
        subtitle="Monitor and manage failed payment retries"
      />

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            label="Pending Retries"
            value={String(summary?.totalPending ?? 0)}
            icon={<Clock className="h-5 w-5" />}
            color="yellow"
          />
          <StatsCard
            label="Failed This Month"
            value={String(summary?.failedThisMonth ?? 0)}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
          <StatsCard
            label="Recovered Amount"
            value={formatMoney(summary?.recoveredAmount ?? 0, "INR")}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as DunningAttemptStatus | "");
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      {/* Attempts Table */}
      {attemptsLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : attempts.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="No dunning attempts"
          description="Dunning attempts will appear when invoices fail payment."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Attempt #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Next Retry</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attempts.map((attempt) => {
                const badge = STATUS_BADGE[attempt.status] ?? STATUS_BADGE.pending;
                return (
                  <tr key={attempt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {attempt.invoiceId?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-gray-600">{attempt.attemptNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {attempt.nextRetryAt
                        ? dayjs(attempt.nextRetryAt).format("DD MMM YYYY HH:mm")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                      {attempt.paymentError ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {dayjs(attempt.createdAt).format("DD MMM YYYY")}
                    </td>
                    <td className="px-4 py-3">
                      {(attempt.status === "pending" || attempt.status === "failed") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                          onClick={() => retryMutation.mutate(attempt.id)}
                          disabled={retryMutation.isPending}
                        >
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
