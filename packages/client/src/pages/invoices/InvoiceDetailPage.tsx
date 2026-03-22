import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Send, Ban, Copy, Download, Trash2, CreditCard, FileText, Pencil, Paperclip,
} from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, InvoiceStatus, PaymentMethod } from "@emp-billing/shared";
import {
  useInvoice, useSendInvoice, useVoidInvoice, useWriteOffInvoice,
  useDuplicateInvoice, useDownloadInvoicePdf, useDeleteInvoice, useInvoicePayments,
  formatFileSize,
} from "@/api/hooks/invoice.hooks";
import { useRecordPayment, useRefundPayment } from "@/api/hooks/payment.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.BANK_TRANSFER]: "Bank Transfer",
  [PaymentMethod.CHEQUE]: "Cheque",
  [PaymentMethod.UPI]: "UPI",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.GATEWAY_STRIPE]: "Stripe",
  [PaymentMethod.GATEWAY_RAZORPAY]: "Razorpay",
  [PaymentMethod.GATEWAY_PAYPAL]: "PayPal",
  [PaymentMethod.OTHER]: "Other",
};

// ─── Record Payment Form ────────────────────────────────────────────────────

interface RecordPaymentFormProps {
  invoiceId: string;
  clientId: string;
  amountDue: number;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Form schema for RecordPaymentForm uses display units (rupees) for amount input,
// then multiplies × 100 before passing to the mutation.
const RecordPaymentFormSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
type RecordPaymentFormValues = z.infer<typeof RecordPaymentFormSchema>;

function RecordPaymentForm({ invoiceId, clientId, amountDue, currency, onSuccess, onCancel }: RecordPaymentFormProps) {
  const recordPayment = useRecordPayment();
  const amountDueDisplay = amountDue / 100;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(RecordPaymentFormSchema),
    defaultValues: {
      amount: amountDueDisplay,
      date: dayjs().format("YYYY-MM-DD"),
      method: PaymentMethod.BANK_TRANSFER,
    },
  });

  function onSubmit(values: RecordPaymentFormValues) {
    const payload = {
      ...values,
      amount: Math.round(values.amount * 100),
      invoiceId,
      clientId,
    };
    recordPayment.mutate(
      payload as unknown as Record<string, unknown>,
      { onSuccess },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Amount"
        type="number"
        step="0.01"
        required
        hint={`Due: ${formatMoney(amountDue, currency)}`}
        error={errors.amount?.message}
        {...register("amount")}
      />
      <Input
        label="Date"
        type="date"
        required
        error={errors.date?.message}
        defaultValue={dayjs().format("YYYY-MM-DD")}
        {...register("date")}
      />
      <Select
        label="Payment Method"
        required
        error={errors.method?.message}
        {...register("method")}
      >
        {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </Select>
      <Input
        label="Reference"
        placeholder="UTR / Cheque number…"
        error={errors.reference?.message}
        {...register("reference")}
      />
      <Textarea
        label="Notes"
        rows={2}
        placeholder="Optional notes…"
        error={errors.notes?.message}
        {...register("notes")}
      />
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting || recordPayment.isPending}>
          Record Payment
        </Button>
      </div>
    </form>
  );
}

// ─── Refund Form ─────────────────────────────────────────────────────────────

interface RefundFormProps {
  paymentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const RefundFormSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  reason: z.string().optional(),
});
type RefundFormValues = z.infer<typeof RefundFormSchema>;

function RefundForm({ paymentId, onSuccess, onCancel }: RefundFormProps) {
  const refundPayment = useRefundPayment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(RefundFormSchema),
  });

  function onSubmit(values: RefundFormValues) {
    refundPayment.mutate(
      { id: paymentId, amount: Math.round(values.amount * 100), reason: values.reason },
      { onSuccess },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Refund Amount"
        type="number"
        step="0.01"
        required
        error={errors.amount?.message}
        {...register("amount")}
      />
      <Input
        label="Reason"
        placeholder="Reason for refund…"
        error={errors.reason?.message}
        {...register("reason")}
      />
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting || refundPayment.isPending}>
          Process Refund
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function InvoiceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);

  const { data: invoiceData, isLoading } = useInvoice(id);
  const { data: paymentsData } = useInvoicePayments(id);

  const sendInvoice = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const writeOffInvoice = useWriteOffInvoice();
  const duplicateInvoice = useDuplicateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const downloadPdf = useDownloadInvoicePdf(id);

  const invoice = invoiceData?.data;
  const payments = (paymentsData?.data ?? []) as {
    id: string;
    paymentNumber: string;
    date: Date;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    isRefund: boolean;
    refundedAmount: number;
  }[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <EmptyState title="Invoice not found" description="This invoice may have been deleted." />
      </div>
    );
  }

  const canEdit = invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.SENT;
  const canSend = invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.SENT;
  const canDelete = invoice.status === InvoiceStatus.DRAFT;
  const canVoid =
    invoice.status !== InvoiceStatus.VOID &&
    invoice.status !== InvoiceStatus.WRITTEN_OFF &&
    invoice.status !== InvoiceStatus.PAID;
  const canRecord = invoice.amountDue > 0;
  const canWriteOff =
    invoice.status === InvoiceStatus.OVERDUE ||
    invoice.status === InvoiceStatus.SENT ||
    invoice.status === InvoiceStatus.PARTIALLY_PAID;

  function handleVoid() {
    if (window.confirm("Void this invoice? This cannot be undone.")) {
      voidInvoice.mutate(id);
    }
  }

  function handleWriteOff() {
    if (window.confirm("Write off this invoice as a bad debt? This cannot be undone.")) {
      writeOffInvoice.mutate(id);
    }
  }

  function handleDelete() {
    if (window.confirm("Delete this invoice? This cannot be undone.")) {
      deleteInvoice.mutate(id);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumb={[{ label: "Invoices", href: "/invoices" }, { label: invoice.invoiceNumber }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button
                size="sm"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => navigate(`/invoices/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canSend && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                loading={sendInvoice.isPending}
                onClick={() => sendInvoice.mutate(id)}
              >
                Send
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={<Copy className="h-4 w-4" />}
              loading={duplicateInvoice.isPending}
              onClick={() => duplicateInvoice.mutate(id)}
            >
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void downloadPdf()}
            >
              PDF
            </Button>
            {canWriteOff && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText className="h-4 w-4 text-orange-500" />}
                loading={writeOffInvoice.isPending}
                onClick={handleWriteOff}
              >
                Write Off
              </Button>
            )}
            {canVoid && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Ban className="h-4 w-4 text-amber-500" />}
                loading={voidInvoice.isPending}
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
                loading={deleteInvoice.isPending}
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
          <InvoiceStatusBadge status={invoice.status} />
          {invoice.referenceNumber && (
            <span className="text-sm text-gray-500">Ref: {invoice.referenceNumber}</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Issue Date</p>
            <p className="font-medium text-gray-800">{dayjs(invoice.issueDate).format("DD MMM YYYY")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Due Date</p>
            <p className="font-medium text-gray-800">{dayjs(invoice.dueDate).format("DD MMM YYYY")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Currency</p>
            <p className="font-medium text-gray-800">{invoice.currency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Client</p>
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline text-left"
              onClick={() => navigate(`/clients/${invoice.clientId}`)}
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
                <th className="px-4 py-3 text-right font-medium text-gray-500">Tax</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatMoney(item.rate, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {item.taxRate > 0 ? `${item.taxRate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatMoney(item.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span>-{formatMoney(invoice.discountAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatMoney(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatMoney(invoice.total, invoice.currency)}</span>
            </div>
            {invoice.tdsAmount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>TDS ({invoice.tdsSection ? `${invoice.tdsSection} @ ` : ""}{invoice.tdsRate}%)</span>
                <span>-{formatMoney(invoice.tdsAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.tdsAmount > 0 && (
              <div className="flex justify-between font-semibold text-gray-800">
                <span>Net Receivable</span>
                <span>{formatMoney(invoice.total - invoice.tdsAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Amount Paid</span>
                <span>-{formatMoney(invoice.amountPaid, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 bg-gray-50 rounded-lg px-2 py-1.5">
              <span>Amount Due</span>
              <span>{formatMoney(invoice.amountDue, invoice.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {invoice.notes && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {Array.isArray((invoice as unknown as Record<string, unknown>).attachments) &&
        ((invoice as unknown as Record<string, unknown>).attachments as { name: string; url: string; size: number }[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Attachments</h3>
          <ul className="divide-y divide-gray-100">
            {((invoice as unknown as Record<string, unknown>).attachments as { name: string; url: string; size: number }[]).map(
              (att, idx) => (
                <li key={`${att.url}-${idx}`} className="flex items-center gap-3 py-2">
                  <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline truncate"
                  >
                    {att.name}
                  </a>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatFileSize(att.size)}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {/* Payments Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Payments</h2>
          {canRecord && (
            <Button
              size="sm"
              icon={<CreditCard className="h-4 w-4" />}
              onClick={() => setPaymentModalOpen(true)}
            >
              Record Payment
            </Button>
          )}
        </div>

        {payments.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No payments recorded"
            description={canRecord ? "Record a payment to mark this invoice as paid." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Payment #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-brand-600">{p.paymentNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{dayjs(p.date).format("DD MMM YYYY")}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {formatMoney(p.amount, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!p.isRefund && p.refundedAmount < p.amount && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRefundPaymentId(p.id)}
                        >
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Payment"
        size="md"
      >
        <RecordPaymentForm
          invoiceId={id}
          clientId={invoice.clientId}
          amountDue={invoice.amountDue}
          currency={invoice.currency}
          onSuccess={() => setPaymentModalOpen(false)}
          onCancel={() => setPaymentModalOpen(false)}
        />
      </Modal>

      {/* Refund Payment Modal */}
      <Modal
        open={refundPaymentId !== null}
        onClose={() => setRefundPaymentId(null)}
        title="Refund Payment"
        size="sm"
      >
        <RefundForm
          paymentId={refundPaymentId!}
          onSuccess={() => setRefundPaymentId(null)}
          onCancel={() => setRefundPaymentId(null)}
        />
      </Modal>
    </div>
  );
}
