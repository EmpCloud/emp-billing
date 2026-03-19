import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, CreditCard } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, PaymentMethod } from "@emp-billing/shared";
import toast from "react-hot-toast";
import { usePayment } from "@/api/hooks/payment.hooks";
import { useClient } from "@/api/hooks/client.hooks";
import { useInvoice } from "@/api/hooks/invoice.hooks";
import { api } from "@/api/client";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

// ── Payment method labels ────────────────────────────────────────────────────

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

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const label = PAYMENT_METHOD_LABELS[method] ?? method;
  const variant =
    method === PaymentMethod.CASH
      ? "success"
      : method === PaymentMethod.BANK_TRANSFER
        ? "info"
        : method === PaymentMethod.UPI
          ? "purple"
          : method === PaymentMethod.CARD ||
              method === PaymentMethod.GATEWAY_STRIPE ||
              method === PaymentMethod.GATEWAY_RAZORPAY ||
              method === PaymentMethod.GATEWAY_PAYPAL
            ? "info"
            : "default";
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function PaymentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: paymentData, isLoading } = usePayment(id);
  const payment = paymentData?.data;

  // Fetch related client info
  const { data: clientData } = useClient(payment?.clientId ?? "");
  const client = clientData?.data;
  const clientName = client?.displayName || client?.name;

  // Fetch related invoice info
  const { data: invoiceData } = useInvoice(payment?.invoiceId ?? "");
  const invoice = invoiceData?.data;

  // ── Receipt download handler ─────────────────────────────────────────────

  const handleDownloadReceipt = async () => {
    try {
      const res = await api.get(`/payments/${id}/receipt`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${payment?.paymentNumber ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download receipt");
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Not found state ──────────────────────────────────────────────────────

  if (!payment) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="Payment not found"
          description="This payment may have been deleted."
        />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title={`Payment ${payment.paymentNumber}`}
        breadcrumb={[
          { label: "Payments", href: "/payments" },
          { label: payment.paymentNumber },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadReceipt}
            >
              Download Receipt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/payments")}
            >
              Back to Payments
            </Button>
          </div>
        }
      />

      {/* Payment Details Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Payment Details</h3>

        <div className="flex items-center gap-3 mb-6">
          <PaymentMethodBadge method={payment.method} />
          {payment.isRefund && <Badge variant="danger">Refund</Badge>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
          {/* Payment Number */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Payment Number</p>
            <p className="font-medium text-gray-800 mt-1">{payment.paymentNumber}</p>
          </div>

          {/* Date */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
            <p className="font-medium text-gray-800 mt-1">
              {dayjs(payment.date).format("DD MMM YYYY")}
            </p>
          </div>

          {/* Amount */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Amount</p>
            <p className="font-medium text-green-700 mt-1 text-lg">
              {formatMoney(payment.amount, "INR")}
            </p>
          </div>

          {/* Method */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Method</p>
            <p className="font-medium text-gray-800 mt-1">
              {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
            </p>
          </div>

          {/* Reference */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Reference</p>
            <p className="font-medium text-gray-800 mt-1">{payment.reference || "\u2014"}</p>
          </div>

          {/* Gateway Transaction ID */}
          {payment.gatewayTransactionId && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Gateway Transaction ID</p>
              <p className="font-medium text-gray-800 mt-1">{payment.gatewayTransactionId}</p>
            </div>
          )}

          {/* Refunded Amount */}
          {payment.refundedAmount > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Refunded Amount</p>
              <p className="font-medium text-red-600 mt-1">
                {formatMoney(payment.refundedAmount, "INR")}
              </p>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Notes</p>
              <p className="font-medium text-gray-800 mt-1 whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}

          {/* Created At */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Created</p>
            <p className="font-medium text-gray-800 mt-1">
              {dayjs(payment.createdAt).format("DD MMM YYYY, h:mm A")}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Info Card */}
      {payment.invoiceId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Linked Invoice</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice Number</p>
              <button
                type="button"
                className="font-medium text-brand-600 hover:underline text-left mt-1"
                onClick={() => navigate(`/invoices/${payment.invoiceId}`)}
              >
                {invoice?.invoiceNumber ?? payment.invoiceId}
              </button>
            </div>

            {invoice && (
              <>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice Status</p>
                  <p className="mt-1">
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "success"
                          : invoice.status === "overdue"
                            ? "danger"
                            : invoice.status === "partially_paid"
                              ? "warning"
                              : "default"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice Total</p>
                  <p className="font-medium text-gray-800 mt-1">
                    {formatMoney(invoice.total, invoice.currency || "INR")}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Amount Due</p>
                  <p className="font-medium text-gray-800 mt-1">
                    {formatMoney(invoice.amountDue, invoice.currency || "INR")}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Client Info Card */}
      {payment.clientId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Client</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Client Name</p>
              <button
                type="button"
                className="font-medium text-brand-600 hover:underline text-left mt-1"
                onClick={() => navigate(`/clients/${payment.clientId}`)}
              >
                {clientName ?? "View Client"}
              </button>
            </div>

            {client?.email && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                <p className="font-medium text-gray-800 mt-1">{client.email}</p>
              </div>
            )}

            {client?.phone && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Phone</p>
                <p className="font-medium text-gray-800 mt-1">{client.phone}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
