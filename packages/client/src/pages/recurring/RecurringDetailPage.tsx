import { useNavigate, useParams } from "react-router-dom";
import { Pause, Play, Trash2, ArrowLeft, Calendar, Clock, RefreshCw, Hash, Zap } from "lucide-react";
import dayjs from "dayjs";
import { RecurringFrequency, RecurringStatus } from "@emp-billing/shared";
import {
  useRecurringProfile,
  useDeleteRecurringProfile,
  usePauseRecurringProfile,
  useResumeRecurringProfile,
  useRecurringExecutions,
} from "@/api/hooks/recurring.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [RecurringStatus.ACTIVE]:    { label: "Active",    variant: "success" },
  [RecurringStatus.PAUSED]:    { label: "Paused",    variant: "warning" },
  [RecurringStatus.COMPLETED]: { label: "Completed", variant: "gray" },
  [RecurringStatus.CANCELLED]: { label: "Cancelled", variant: "danger" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  [RecurringFrequency.DAILY]: "Daily",
  [RecurringFrequency.WEEKLY]: "Weekly",
  [RecurringFrequency.MONTHLY]: "Monthly",
  [RecurringFrequency.QUARTERLY]: "Quarterly",
  [RecurringFrequency.HALF_YEARLY]: "Half Yearly",
  [RecurringFrequency.YEARLY]: "Yearly",
  [RecurringFrequency.CUSTOM]: "Custom",
};

const EXEC_STATUS_MAP: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" }> = {
  success: { label: "Success", variant: "success" },
  failed:  { label: "Failed",  variant: "danger" },
  skipped: { label: "Skipped", variant: "warning" },
};

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children ?? <span className="text-gray-400">--</span>}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RecurringDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: profileData, isLoading } = useRecurringProfile(id);
  const { data: execData, isLoading: execLoading } = useRecurringExecutions(id);

  const deleteProfile = useDeleteRecurringProfile();
  const pauseProfile = usePauseRecurringProfile();
  const resumeProfile = useResumeRecurringProfile();

  const profile = profileData?.data;
  const executions = execData?.data ?? [];

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!profile) return;
    if (window.confirm("Delete this recurring profile? This cannot be undone.")) {
      deleteProfile.mutate(profile.id, {
        onSuccess: () => navigate("/recurring"),
      });
    }
  }

  function handleTogglePause() {
    if (!profile) return;
    if (profile.status === RecurringStatus.ACTIVE) {
      pauseProfile.mutate(profile.id);
    } else if (profile.status === RecurringStatus.PAUSED) {
      resumeProfile.mutate(profile.id);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <div className="p-6">
        <EmptyState
          title="Profile not found"
          description="This recurring profile may have been deleted."
          action={{ label: "Back to Recurring Profiles", onClick: () => navigate("/recurring") }}
        />
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────

  const statusCfg = STATUS_MAP[profile.status] ?? { label: profile.status, variant: "default" as const };
  const canPauseOrResume = profile.status === RecurringStatus.ACTIVE || profile.status === RecurringStatus.PAUSED;
  const canDelete = profile.status === RecurringStatus.ACTIVE || profile.status === RecurringStatus.PAUSED;
  const isPaused = profile.status === RecurringStatus.PAUSED;

  const templateData = typeof profile.templateData === "string"
    ? (() => { try { return JSON.parse(profile.templateData as unknown as string); } catch { return profile.templateData; } })()
    : profile.templateData;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={`Recurring ${profile.type === "invoice" ? "Invoice" : "Expense"} Profile`}
        subtitle={`ID: ${profile.id}`}
        breadcrumb={[
          { label: "Recurring Profiles", href: "/recurring" },
          { label: profile.id },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/recurring")}>
              Back
            </Button>
            {canPauseOrResume && (
              <Button
                variant="outline"
                icon={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                loading={pauseProfile.isPending || resumeProfile.isPending}
                onClick={handleTogglePause}
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                icon={<Trash2 className="h-4 w-4 text-red-500" />}
                loading={deleteProfile.isPending}
                onClick={handleDelete}
              >
                <span className="text-red-600">Delete</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Profile Details Card */}
      <div className="rounded-xl border border-gray-100 shadow-sm bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-gray-400" />
          Profile Details
        </h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <DetailField label="Client ID">{profile.clientId}</DetailField>

          <DetailField label="Type">
            <span className="capitalize">{profile.type}</span>
          </DetailField>

          <DetailField label="Status">
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </DetailField>

          <DetailField label="Frequency">
            {FREQUENCY_LABELS[profile.frequency] ?? profile.frequency}
            {profile.frequency === RecurringFrequency.CUSTOM && profile.customDays && (
              <span className="text-gray-500 ml-1">(every {profile.customDays} days)</span>
            )}
          </DetailField>

          <DetailField label="Next Run Date">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {dayjs(profile.nextExecutionDate).format("DD MMM YYYY")}
            </span>
          </DetailField>

          <DetailField label="Start Date">
            {dayjs(profile.startDate).format("DD MMM YYYY")}
          </DetailField>

          <DetailField label="End Date">
            {profile.endDate ? dayjs(profile.endDate).format("DD MMM YYYY") : <span className="text-gray-400">No end date</span>}
          </DetailField>

          <DetailField label="Occurrences">
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5 text-gray-400" />
              {profile.occurrenceCount}
              {profile.maxOccurrences != null ? ` / ${profile.maxOccurrences}` : ""}
            </span>
          </DetailField>

          <DetailField label="Auto Send">
            {profile.autoSend ? (
              <Badge variant="info">Yes</Badge>
            ) : (
              <Badge variant="gray">No</Badge>
            )}
          </DetailField>

          <DetailField label="Auto Charge">
            {profile.autoCharge ? (
              <Badge variant="info">Yes</Badge>
            ) : (
              <Badge variant="gray">No</Badge>
            )}
          </DetailField>

          <DetailField label="Created">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {dayjs(profile.createdAt).format("DD MMM YYYY, HH:mm")}
            </span>
          </DetailField>

          <DetailField label="Last Updated">
            {dayjs(profile.updatedAt).format("DD MMM YYYY, HH:mm")}
          </DetailField>
        </dl>
      </div>

      {/* Template Data Preview Card */}
      <div className="rounded-xl border border-gray-100 shadow-sm bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-gray-400" />
          Template Data Preview
        </h2>

        {templateData && typeof templateData === "object" && Object.keys(templateData).length > 0 ? (
          <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(templateData, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-400">No template data configured.</p>
        )}
      </div>

      {/* Execution History */}
      <div className="rounded-xl border border-gray-100 shadow-sm bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          Execution History
        </h2>

        {execLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        )}

        {!execLoading && executions.length === 0 && (
          <p className="text-sm text-gray-400 py-4">No executions recorded yet.</p>
        )}

        {!execLoading && executions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Execution Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Generated ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {executions.map((exec) => {
                  const execCfg = EXEC_STATUS_MAP[exec.status] ?? { label: exec.status, variant: "gray" as const };
                  return (
                    <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">
                        {dayjs(exec.executionDate).format("DD MMM YYYY")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={execCfg.variant}>{execCfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {exec.generatedId ? exec.generatedId : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">
                        {exec.error ? (
                          <span className="text-red-600" title={exec.error}>{exec.error}</span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {dayjs(exec.createdAt).format("DD MMM YYYY, HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
