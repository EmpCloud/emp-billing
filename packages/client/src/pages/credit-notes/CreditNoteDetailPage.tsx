import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, Trash2, FileText, CreditCard, Download } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, CreditNoteStatus } from "@emp-billing/shared";
import {
  useCreditNote, useVoidCreditNote, useDeleteCreditNote, useApplyCreditNote, useDownloadCreditNotePdf,
} from "@/api/hooks/credit-note.hooks";
import { useInvoices } from "@/api/hooks/invoice.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

// ---- Status Badge ----

const CN_STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [CreditNoteStatus.DRAFT]:    { label: "Draft",    variant: "gray" },
  [CreditNoteStatus.OPEN]:     { label: "Open",     variant: "info" },
  [CreditNoteStatus.APPLIED]:  { label: "Applied",  variant: "success" },
  [CreditNoteStatus.REFUNDED]: { label: "Refunded", variant: "warning" },
  [CreditNoteStatus.VOID]:     { label: "Void",     variant: "danger" },
};

function CreditNoteStatusBadge({ status }: { status: string }) {
  const cfg = CN_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ---- Apply Form ----

const ApplyFormSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
});
type ApplyFormValues = z.infer<typeof ApplyFormSchema>;

interface ApplyFormProps {
  creditNoteId: string;
  balance: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function ApplyForm({ creditNoteId, balance, onSuccess, onCancel }: ApplyFormProps) {
  const applyCreditNote = useApplyCreditNote();
  const { data: invoicesData } = useInvoices();
  const invoices = invoicesData?.data ?? [];
  const balanceDisplay = balance / 100;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(ApplyFormSchema),
    defaultValues: {
      invoiceId: "",
      amount: balanceDisplay,
    },
  });

  function onSubmit(values: ApplyFormValues) {
    applyCreditNote.mutate(
      {
        id: creditNoteId,
        invoiceId: values.invoiceId,
        amount: Math.round(values.amount * 100),
      },
      { onSuccess },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Invoice"
        required
        error={errors.invoiceId?.message}
        {...register("invoiceId")}
      >
        <option value="">Select an invoice...</option>
        {invoices.map((inv) => (
          <option key={inv.id} value={inv.id}>
            {inv.invoiceNumber} — {formatMoney(inv.amountDue, inv.currency)} due
          </option>
        ))}
      </Select>
      <Input
        label="Amount"
        type="number"
        step="0.01"
        required
        hint={`Available balance: ${formatMoney(balance, "INR")}`}
        error={errors.amount?.message}
        {...register("amount")}
      />
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting || applyCreditNote.isPending}>
          Apply
        </Button>
      </div>
    </form>
  );
}

// ---- Main Page ----

export function CreditNoteDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const { data: creditNoteData, isLoading } = useCreditNote(id);
  const voidCreditNote = useVoidCreditNote();
  const deleteCreditNote = useDeleteCreditNote();
  const downloadPdf = useDownloadCreditNotePdf(id);

  const creditNote = creditNoteData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="p-6">
        <EmptyState title="Credit note not found" description="This credit note may have been deleted." />
      </div>
    );
  }

  const canApply =
    (creditNote.status === CreditNoteStatus.OPEN || creditNote.status === CreditNoteStatus.APPLIED) &&
    creditNote.balance > 0;
  const canVoid =
    creditNote.status !== CreditNoteStatus.VOID &&
    creditNote.status !== CreditNoteStatus.REFUNDED;
  const canDelete = creditNote.status === CreditNoteStatus.DRAFT;

  function handleVoid() {
    if (window.confirm("Void this credit note? This cannot be undone.")) {
      voidCreditNote.mutate(id);
    }
  }

  function handleDelete() {
    if (window.confirm("Delete this credit note? This cannot be undone.")) {
      deleteCreditNote.mutate(id);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title={creditNote.creditNoteNumber}
        breadcrumb={[{ label: "Credit Notes", href: "/credit-notes" }, { label: creditNote.creditNoteNumber }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canApply && (
              <Button
                size="sm"
                icon={<CreditCard className="h-4 w-4" />}
                onClick={() => setApplyModalOpen(true)}
              >
                Apply to Invoice
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void downloadPdf()}
            >
              PDF
            </Button>
            {canVoid && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Ban className="h-4 w-4 text-amber-500" />}
                loading={voidCreditNote.isPending}
                onClick={handleVoid}
              >
                Void
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-4 w-4 text-red-500" />}
                loading={deleteCreditNote.isPending}
                onClick={handleDelete}
              >
                <span className="text-red-600">Delete</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Status + Meta */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditNoteStatusBadge status={creditNote.status} />
          {creditNote.reason && (
            <span className="text-sm text-gray-500">Reason: {creditNote.reason}</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
            <p className="font-medium text-gray-800">{dayjs(creditNote.date).format("DD MMM YYYY")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="font-medium text-gray-800">{formatMoney(creditNote.total, "INR")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Balance Remaining</p>
            <p className="font-medium text-gray-800">{formatMoney(creditNote.balance, "INR")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Client</p>
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline text-left"
              onClick={() => navigate(`/clients/${creditNote.clientId}`)}
            >
              View Client
            </button>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Item</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Rate</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {creditNote.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatMoney(item.rate, "INR")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatMoney(item.amount, "INR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatMoney(creditNote.subtotal, "INR")}</span>
            </div>
            {creditNote.taxAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatMoney(creditNote.taxAmount, "INR")}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatMoney(creditNote.total, "INR")}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 bg-gray-50 rounded-lg px-2 py-1.5">
              <span>Balance Remaining</span>
              <span>{formatMoney(creditNote.balance, "INR")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Applied to Invoices */}
      {creditNote.appliedToInvoices && creditNote.appliedToInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Applied to Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice ID</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {creditNote.appliedToInvoices.map((app) => (
                  <tr key={app.invoiceId}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-brand-600 hover:underline"
                        onClick={() => navigate(`/invoices/${app.invoiceId}`)}
                      >
                        {app.invoiceId}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {formatMoney(app.amount, "INR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply to Invoice Modal */}
      <Modal
        open={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Apply to Invoice"
        size="md"
      >
        <ApplyForm
          creditNoteId={id}
          balance={creditNote.balance}
          onSuccess={() => setApplyModalOpen(false)}
          onCancel={() => setApplyModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
