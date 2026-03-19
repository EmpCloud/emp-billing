import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Save } from "lucide-react";
import { useDispute, useUpdateDispute } from "@/api/hooks/dispute.hooks";
import { DisputeStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { DisputeStatus } from "@emp-billing/shared";
import type { Dispute } from "@emp-billing/shared";
import dayjs from "dayjs";

const STATUS_OPTIONS = [
  { label: "Open", value: DisputeStatus.OPEN },
  { label: "Under Review", value: DisputeStatus.UNDER_REVIEW },
  { label: "Resolved", value: DisputeStatus.RESOLVED },
  { label: "Closed", value: DisputeStatus.CLOSED },
];

export function DisputeDetailPage() {
  const { id } = useParams();
  const { data: res, isLoading } = useDispute(id!);
  const updateDispute = useUpdateDispute(id!);

  const dispute = res?.data as Dispute | undefined;

  const [status, setStatus] = useState<string>("");
  const [resolution, setResolution] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form values when dispute loads
  if (dispute && !initialized) {
    setStatus(dispute.status);
    setResolution(dispute.resolution ?? "");
    setAdminNotes(dispute.adminNotes ?? "");
    setInitialized(true);
  }

  const handleSave = () => {
    updateDispute.mutate({ status, resolution, adminNotes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Dispute not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/disputes">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Dispute Detail</h1>
        <DisputeStatusBadge status={dispute.status} />
      </div>

      {/* Dispute Info Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Client ID</p>
            <p className="text-sm text-gray-900 mt-1">{dispute.clientId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Invoice ID</p>
            <p className="text-sm text-gray-900 mt-1">
              {dispute.invoiceId ? (
                <Link to={`/invoices/${dispute.invoiceId}`} className="text-brand-600 hover:underline">
                  {dispute.invoiceId.slice(0, 8)}...
                </Link>
              ) : (
                "-"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
            <p className="text-sm text-gray-900 mt-1">{dayjs(dispute.createdAt).format("DD MMM YYYY, HH:mm")}</p>
          </div>
          {dispute.resolvedAt && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Resolved At</p>
              <p className="text-sm text-gray-900 mt-1">{dayjs(dispute.resolvedAt).format("DD MMM YYYY, HH:mm")}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase">Reason</p>
          <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{dispute.reason}</p>
        </div>
      </div>

      {/* Admin Actions Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Admin Actions</h2>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            placeholder="Describe the resolution for this dispute..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Admin Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (internal)</label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes (not visible to client)..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={updateDispute.isPending}
            icon={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
