import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import {
  usePortalDisputes,
  useCreatePortalDispute,
  usePortalInvoices,
} from "@/api/hooks/portal.hooks";
import { DisputeStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import type { Dispute, Invoice } from "@emp-billing/shared";
import dayjs from "dayjs";

function RaiseDisputeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const createDispute = useCreatePortalDispute();

  // Fetch invoices for the dropdown
  const { data: invoicesRes, isLoading: invoicesLoading } = usePortalInvoices({ limit: 100 });
  const invoices = (invoicesRes?.data ?? []) as Invoice[];

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    await createDispute.mutateAsync({
      invoiceId: invoiceId || undefined,
      reason: reason.trim(),
    });
    setInvoiceId("");
    setReason("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Raise a Dispute" size="md">
      <div className="space-y-4">
        {/* Invoice (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice (optional)
          </label>
          {invoicesLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" /> Loading invoices...
            </div>
          ) : (
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">No specific invoice</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} - {dayjs(inv.issueDate).format("DD MMM YYYY")}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Describe the issue in detail..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={createDispute.isPending}
            disabled={!reason.trim() || createDispute.isPending}
          >
            Submit Dispute
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PortalDisputesPage() {
  const [page, setPage] = useState(1);
  const { data: res, isLoading } = usePortalDisputes({ page, limit: 20 });
  const [showModal, setShowModal] = useState(false);

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
          <h1 className="text-xl font-bold text-gray-900">My Disputes</h1>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Raise Dispute
        </Button>
      </div>

      {/* List */}
      {disputes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No disputes found</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Raise Dispute" to submit a new dispute
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <DisputeStatusBadge status={d.status} />
                    <span className="text-xs text-gray-500">
                      {dayjs(d.createdAt).format("DD MMM YYYY")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{d.reason}</p>
                  {d.invoiceId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Invoice: {d.invoiceId.slice(0, 8)}...
                    </p>
                  )}
                </div>
              </div>

              {/* Resolution */}
              {d.resolution && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Resolution</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.resolution}</p>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-1 py-3">
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

      {/* Raise Dispute Modal */}
      <RaiseDisputeModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
