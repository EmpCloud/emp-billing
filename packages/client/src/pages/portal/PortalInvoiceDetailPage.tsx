import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, CreditCard, FileText } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, InvoiceStatus } from "@emp-billing/shared";
import {
  usePortalInvoice,
  useDownloadPortalInvoicePdf,
  usePortalPaymentGateways,
  usePortalCreatePayment,
  usePortalPay,
} from "@/api/hooks/portal.hooks";
import { Button } from "@/components/common/Button";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import type { Invoice, InvoiceItem } from "@emp-billing/shared";
import toast from "react-hot-toast";

const PAYABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

export function PortalInvoiceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoiceData, isLoading } = usePortalInvoice(id);
  const downloadPdf = useDownloadPortalInvoicePdf(id);
  const [downloading, setDownloading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const invoice = invoiceData?.data as (Invoice & { items: InvoiceItem[] }) | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/portal/invoices")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Invoice not found</p>
        </div>
      </div>
    );
  }

  const canPay = PAYABLE_STATUSES.includes(invoice.status) && invoice.amountDue > 0;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPdf();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/portal/invoices")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-2">
          {canPay && (
            <Button
              size="sm"
              icon={<CreditCard className="h-4 w-4" />}
              onClick={() => setPayModalOpen(true)}
            >
              Pay Now
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            loading={downloading}
            onClick={() => void handleDownload()}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
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
          {invoice.referenceNumber && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Reference</p>
              <p className="font-medium text-gray-800">{invoice.referenceNumber}</p>
            </div>
          )}
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
                    {item.taxRate > 0 ? `${item.taxRate}%` : "\u2014"}
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

      {/* Pay Modal */}
      {payModalOpen && (
        <PayNowModal
          invoice={invoice}
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Pay Now Modal ─────────────────────────────────────────────────────────────

function PayNowModal({
  invoice,
  open,
  onClose,
}: {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
}) {
  const { data: gatewaysRes, isLoading: gatewaysLoading } = usePortalPaymentGateways();
  const createPayment = usePortalCreatePayment();
  const { pay, isPending } = usePortalPay();

  const gateways = (gatewaysRes?.data ?? []) as Array<{ name: string; displayName: string }>;

  const handlePay = async (gatewayName: string) => {
    try {
      const res = await createPayment.mutateAsync({
        invoiceId: invoice.id,
        gateway: gatewayName,
      });

      const order = res.data as {
        gatewayOrderId: string;
        checkoutUrl?: string;
        metadata?: Record<string, unknown>;
      };

      if (order.checkoutUrl) {
        window.location.href = order.checkoutUrl;
        return;
      }

      if (gatewayName === "razorpay" && typeof (window as unknown as Record<string, unknown>).Razorpay === "function") {
        const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as new (opts: Record<string, unknown>) => { open: () => void };
        const rzp = new RazorpayConstructor({
          key: order.metadata?.keyId as string | undefined,
          order_id: order.gatewayOrderId,
          amount: order.metadata?.amount as number | undefined,
          currency: order.metadata?.currency as string | undefined,
          name: invoice.invoiceNumber,
          description: `Payment for ${invoice.invoiceNumber}`,
          handler: () => {
            toast.success("Payment successful!");
            onClose();
          },
        });
        rzp.open();
        return;
      }

      toast.success(`Payment order created (ID: ${order.gatewayOrderId}). Please complete payment on the gateway.`);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  if (gateways.length === 1 && (isPending || createPayment.isPending)) {
    return (
      <Modal open={open} onClose={onClose} title="Pay Invoice" size="sm">
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Redirecting to payment...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Pay Invoice" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Invoice</span>
            <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="text-gray-700">{formatMoney(invoice.total, invoice.currency)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="text-green-600">{formatMoney(invoice.amountPaid, invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span className="text-gray-700">Amount Due</span>
            <span className="text-gray-900">{formatMoney(invoice.amountDue, invoice.currency)}</span>
          </div>
        </div>

        {gatewaysLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : gateways.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No payment gateways are currently available. Please contact us to arrange payment.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Select a payment method:</p>
            {gateways.map((gw) => (
              <Button
                key={gw.name}
                variant="outline"
                size="lg"
                className="w-full justify-start"
                loading={createPayment.isPending}
                disabled={createPayment.isPending}
                onClick={() => void handlePay(gw.name)}
                icon={<CreditCard className="h-4 w-4" />}
              >
                Pay with {gw.displayName}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
