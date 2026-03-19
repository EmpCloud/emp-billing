import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Eye } from "lucide-react";
import { useDisputes } from "@/api/hooks/dispute.hooks";
import { DisputeStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { DisputeStatus } from "@emp-billing/shared";
import type { Dispute } from "@emp-billing/shared";
import dayjs from "dayjs";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: DisputeStatus.OPEN },
  { label: "Under Review", value: DisputeStatus.UNDER_REVIEW },
  { label: "Resolved", value: DisputeStatus.RESOLVED },
  { label: "Closed", value: DisputeStatus.CLOSED },
];

export function DisputeListPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string | number> = { page, limit: 20 };
  if (statusFilter) params.status = statusFilter;

  const { data: res, isLoading } = useDisputes(params);

  const disputes = (res?.data ?? []) as Dispute[];
  const meta = res?.meta;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">Disputes</h1>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {disputes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No disputes found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Reason</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-900 max-w-xs truncate">
                      {d.reason.length > 80 ? d.reason.slice(0, 80) + "..." : d.reason}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {d.invoiceId ? d.invoiceId.slice(0, 8) + "..." : "-"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <DisputeStatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(d.createdAt).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/disputes/${d.id}`}>
                        <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />}>
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
