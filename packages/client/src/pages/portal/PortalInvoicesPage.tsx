import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Download, CreditCard } from "lucide-react";
import {
  usePortalInvoices,
  useDownloadPortalInvoicePdf,
  usePortalPaymentGateways,
  usePortalCreatePayment,
} from "@/api/hooks/portal.hooks";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import { formatMoney } from "@emp-billing/shared";
import { InvoiceStatus } from "@emp-billing/shared";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import type { Invoice } from "@emp-billing/shared";

function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  const downloadPdf = useDownloadPortalInvoicePdf(invoiceId);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadPdf();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      loading={loading}
      icon={<Download className="h-3.5 w-3.5" />}
    >
      PDF
    </Button>
  );
}

// Statuses that have an outstanding balance and can be paid online
const PAYABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

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
        // Stripe and other hosted-checkout gateways: redirect to the gateway page
        window.location.href = order.checkoutUrl;
        return;
      }

      // Razorpay: open checkout popup if the SDK is loaded, otherwise show order info
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

      // Fallback: the order was created but there's no redirect URL or client SDK.
      // This can happen if Razorpay SDK is not loaded on the page.
      toast.success(
        `Payment order created (ID: ${order.gatewayOrderId}). Please complete payment on the gateway.`
      );
      onClose();
    } catch {
      // Error toast is already handled by the mutation's onError
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pay Invoice" size="sm">
      <div className="space-y-4">
        {/* Invoice summary */}
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
              <span className="text-green-600">
                {formatMoney(invoice.amountPaid, invoice.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span className="text-gray-700">Amount Due</span>
            <span className="text-gray-900">
              {formatMoney(invoice.amountDue, invoice.currency)}
            </span>
          </div>
        </div>

        {/* Gateway selection */}
        {gatewaysLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="md" className="text-brand-600" />
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
                onClick={() => handlePay(gw.name)}
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

export function PortalInvoicesPage() {
  const [page, setPage] = useState(1);
  const { data: res, isLoading } = usePortalInvoices({ page, limit: 20 });
  const [searchParams, setSearchParams] = useSearchParams();

  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  // Show toast when returning from Stripe Checkout (or any hosted gateway)
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") {
      toast.success("Payment completed successfully! Your invoice will be updated shortly.");
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === "cancelled") {
      toast("Payment was cancelled.", { icon: "\u26A0\uFE0F" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const invoices = (res?.data ?? []) as Invoice[];
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
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">My Invoices</h1>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No invoices found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice #</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Due Date</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(inv.issueDate).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(inv.dueDate).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatMoney(inv.total, inv.currency)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {PAYABLE_STATUSES.includes(inv.status) && inv.amountDue > 0 && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setPayInvoice(inv)}
                            icon={<CreditCard className="h-3.5 w-3.5" />}
                          >
                            Pay Now
                          </Button>
                        )}
                        <DownloadPdfButton invoiceId={inv.id} />
                      </div>
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

      {/* Pay Now Modal */}
      {payInvoice && (
        <PayNowModal
          invoice={payInvoice}
          open={!!payInvoice}
          onClose={() => setPayInvoice(null)}
        />
      )}
    </div>
  );
}
