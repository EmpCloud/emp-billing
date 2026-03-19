import { useState } from "react";
import { useAuditLogs } from "@/api/hooks/audit.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { Select, Input } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "invoice", label: "Invoice" },
  { value: "client", label: "Client" },
  { value: "payment", label: "Payment" },
  { value: "quote", label: "Quote" },
  { value: "expense", label: "Expense" },
  { value: "credit_note", label: "Credit Note" },
  { value: "product", label: "Product" },
  { value: "settings", label: "Settings" },
];

function formatAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const filters: Record<string, unknown> = { page, limit };
  if (entityType) filters.entityType = entityType;
  if (from) filters.from = from;
  if (to) filters.to = to;

  const { data, isLoading } = useAuditLogs(filters);

  const logs = (data?.data ?? []) as Record<string, unknown>[];
  const meta = (data?.meta ?? {}) as Record<string, number>;
  const totalPages = meta.totalPages ?? 1;

  return (
    <div className="p-6">
      <PageHeader
        title="Activity Log"
        subtitle="View all actions performed in your organization"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-48">
          <Select
            label="Entity Type"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-44">
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {(entityType || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEntityType("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && logs.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12" />}
          title={
            entityType || from || to
              ? "No activity matches your filters"
              : "No activity yet"
          }
          description={
            entityType || from || to
              ? "Try adjusting the filters."
              : "Activity will appear here as actions are performed."
          }
        />
      )}

      {/* Table */}
      {!isLoading && logs.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Entity Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">
                    Entity ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {dayjs(log.createdAt).format("MMM D, YYYY h:mm A")}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.userName || log.userId || "System"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{formatAction(log.action)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="gray">
                        {log.entityType
                          ? log.entityType.charAt(0).toUpperCase() +
                            log.entityType.slice(1).replace(/_/g, " ")
                          : "-"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {log.entityId || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeft className="h-4 w-4" />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronRight className="h-4 w-4" />}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
