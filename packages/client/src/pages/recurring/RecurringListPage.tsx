import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Pause, Play, RefreshCw } from "lucide-react";
import dayjs from "dayjs";
import { RecurringFrequency, RecurringStatus } from "@emp-billing/shared";
import {
  useRecurringProfiles,
  useDeleteRecurringProfile,
  usePauseRecurringProfile,
  useResumeRecurringProfile,
} from "@/api/hooks/recurring.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: RecurringStatus.ACTIVE, label: "Active" },
  { value: RecurringStatus.PAUSED, label: "Paused" },
  { value: RecurringStatus.COMPLETED, label: "Completed" },
  { value: RecurringStatus.CANCELLED, label: "Cancelled" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [RecurringStatus.ACTIVE]:    { label: "Active",    variant: "success" },
  [RecurringStatus.PAUSED]:    { label: "Paused",    variant: "warning" },
  [RecurringStatus.COMPLETED]: { label: "Completed", variant: "gray" },
  [RecurringStatus.CANCELLED]: { label: "Cancelled", variant: "danger" },
};

function RecurringStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const FREQUENCY_LABELS: Record<string, string> = {
  [RecurringFrequency.DAILY]: "Daily",
  [RecurringFrequency.WEEKLY]: "Weekly",
  [RecurringFrequency.MONTHLY]: "Monthly",
  [RecurringFrequency.QUARTERLY]: "Quarterly",
  [RecurringFrequency.HALF_YEARLY]: "Half Yearly",
  [RecurringFrequency.YEARLY]: "Yearly",
  [RecurringFrequency.CUSTOM]: "Custom",
};

export function RecurringListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  const params: Record<string, string> = {};
  if (status) params.status = status;

  const { data, isLoading } = useRecurringProfiles(Object.keys(params).length ? params : undefined);
  const deleteProfile = useDeleteRecurringProfile();
  const pauseProfile = usePauseRecurringProfile();
  const resumeProfile = useResumeRecurringProfile();

  const profiles = data?.data ?? [];

  function handleDelete(id: string) {
    if (window.confirm("Delete this recurring profile? This cannot be undone.")) {
      deleteProfile.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Recurring Profiles"
        subtitle="Automate recurring invoices and expenses"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/recurring/new")}>
            New Profile
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && profiles.length === 0 && (
        <EmptyState
          icon={<RefreshCw className="h-12 w-12" />}
          title={status ? "No profiles match your filters" : "No recurring profiles yet"}
          description={status ? "Try adjusting the filters." : "Create a recurring profile to automate billing."}
          action={
            status
              ? undefined
              : { label: "New Profile", onClick: () => navigate("/recurring/new") }
          }
        />
      )}

      {/* Table */}
      {!isLoading && profiles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Frequency</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Next Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Occurrences</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">{p.clientId}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{p.type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {dayjs(p.nextExecutionDate).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3">
                    <RecurringStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {p.occurrenceCount}
                    {p.maxOccurrences ? ` / ${p.maxOccurrences}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === RecurringStatus.ACTIVE && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pause className="h-4 w-4" />}
                          loading={pauseProfile.isPending}
                          onClick={() => pauseProfile.mutate(p.id)}
                        >
                          Pause
                        </Button>
                      )}
                      {p.status === RecurringStatus.PAUSED && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Play className="h-4 w-4" />}
                          loading={resumeProfile.isPending}
                          onClick={() => resumeProfile.mutate(p.id)}
                        >
                          Resume
                        </Button>
                      )}
                      {(p.status === RecurringStatus.ACTIVE || p.status === RecurringStatus.PAUSED) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => handleDelete(p.id)}
                          loading={deleteProfile.isPending}
                        >
                          <span className="text-red-600">Delete</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
