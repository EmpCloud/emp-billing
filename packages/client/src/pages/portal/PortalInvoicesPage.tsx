import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Download, CreditCard, CheckCircle, XCircle } from "lucide-react";
import {
  usePortalInvoices,
  useDownloadPortalInvoicePdf,
  usePortalPaymentGateways,
  usePortalPay,
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

// ── Razorpay checkout SDK loader ───────────────────────────────────────────
// The Razorpay client SDK is loaded on demand (rather than eagerly in
// index.html) so portal pages without payments avoid the extra request.
const RAZORPAY_SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.Razorpay === "function") {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SDK_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      // If the script already finished loading before we attached listeners.
      if (typeof w.Razorpay === "function") resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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

// ── Payment Result Banner ──────────────────────────────────────────────────
// Shown when the user returns from a hosted gateway (Stripe Checkout, etc.)

function PaymentSuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
      <div className="flex justify-center">
        <div className="rounded-full bg-green-100 p-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-green-900">Payment Successful</h2>
      <p className="text-sm text-green-700 max-w-md mx-auto">
        Your payment has been received. The invoice status will be updated shortly once the
        payment is confirmed by our payment processor.
      </p>
      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function PaymentCancelledBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
      <div className="flex justify-center">
        <div className="rounded-full bg-amber-100 p-3">
          <XCircle className="h-8 w-8 text-amber-600" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-amber-900">Payment Cancelled</h2>
      <p className="text-sm text-amber-700 max-w-md mx-auto">
        Your payment was not completed. No charge has been made. You can try again anytime by
        clicking the "Pay Now" button on your invoice.
      </p>
      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Gateway Selector Modal ─────────────────────────────────────────────────

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
  const { isPending } = usePortalPay();

  const gateways = (gatewaysRes?.data ?? []) as Array<{ name: string; displayName: string }>;

  // Auto-select if only one gateway is configured
  const [autoTriggered, setAutoTriggered] = useState(false);
  useEffect(() => {
    if (!gatewaysLoading && gateways.length === 1 && open && !autoTriggered && !isPending) {
      setAutoTriggered(true);
      handlePay(gateways[0].name);
    }
    // Reset auto-trigger flag when modal closes
    if (!open) setAutoTriggered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewaysLoading, gateways.length, open]);

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

      // Razorpay: client-side SDK flow
      if (gatewayName === "razorpay") {
        const keyId = order.metadata?.keyId as string | undefined;
        const amount = order.metadata?.amount as number | undefined;
        const currency = order.metadata?.currency as string | undefined;

        if (!order.gatewayOrderId || !keyId) {
          toast.error(
            "Payment session data is incomplete. Please try again or contact support."
          );
          return;
        }

        // Lazy-load the Razorpay checkout SDK if it hasn't been loaded yet
        const sdkLoaded = await loadRazorpayScript();
        if (!sdkLoaded) {
          toast.error(
            "Could not load the Razorpay checkout SDK. Check your network and try again."
          );
          return;
        }

        const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as
          | (new (opts: Record<string, unknown>) => { open: () => void; on?: (event: string, cb: (resp: unknown) => void) => void })
          | undefined;
        if (typeof RazorpayConstructor !== "function") {
          toast.error("Razorpay checkout is unavailable right now. Please try again.");
          return;
        }

        const rzp = new RazorpayConstructor({
          key: keyId,
          order_id: order.gatewayOrderId,
          amount,
          currency,
          name: invoice.invoiceNumber,
          description: `Payment for ${invoice.invoiceNumber}`,
          handler: () => {
            toast.success("Payment successful! It will reflect on your invoice shortly.");
            onClose();
          },
          modal: {
            ondismiss: () => {
              toast("Payment cancelled.", { icon: "ℹ️" });
            },
          },
        });
        if (typeof rzp.on === "function") {
          rzp.on("payment.failed", () => {
            toast.error("Payment failed. Please try again or use another method.");
          });
        }
        rzp.open();
        return;
      }

      // Fallback: the order was created but there's no redirect URL or client SDK.
      toast.success(
        `Payment order created (ID: ${order.gatewayOrderId}). Please complete payment on the gateway.`
      );
      onClose();
    } catch {
      // Error toast is already handled by the mutation's onError
    }
  };

  // If auto-selecting single gateway, show a loading state instead of the full modal
  if (gateways.length === 1 && (isPending || createPayment.isPending)) {
    return (
      <Modal open={open} onClose={onClose} title="Pay Invoice" size="sm">
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Spinner size="lg" className="text-brand-600" />
          <p className="text-sm text-gray-500">Redirecting to payment...</p>
        </div>
      </Modal>
    );
  }

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

// ── Pay Now Button (inline, for single-gateway shortcut) ───────────────────

function PayNowButton({
  onOpenModal,
}: {
  invoice: Invoice;
  onOpenModal: () => void;
}) {
  // Always open the Pay modal — it handles both the single-gateway shortcut
  // (auto-triggers payment) and multi-gateway selection. Bypassing the modal
  // here previously meant Razorpay never opened its checkout popup because
  // the SDK loader and order-data validation live inside the modal handler.
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onOpenModal}
      icon={<CreditCard className="h-3.5 w-3.5" />}
    >
      Pay Now
    </Button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function PortalInvoicesPage() {
  const [page, setPage] = useState(1);
  const { data: res, isLoading } = usePortalInvoices({ page, limit: 20 });
  const [searchParams, setSearchParams] = useSearchParams();

  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  // Payment result from gateway redirect
  const paymentStatus = searchParams.get("payment");
  const [showBanner, setShowBanner] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    if (paymentStatus === "success") {
      setShowBanner("success");
      // Clean up query params (keep the banner visible until dismissed)
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === "cancelled") {
      setShowBanner("cancelled");
      setSearchParams({}, { replace: true });
    }
  }, [paymentStatus, setSearchParams]);

  const dismissBanner = () => setShowBanner(null);

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

      {/* Payment result banners */}
      {showBanner === "success" && <PaymentSuccessBanner onDismiss={dismissBanner} />}
      {showBanner === "cancelled" && <PaymentCancelledBanner onDismiss={dismissBanner} />}

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
                          <PayNowButton
                            invoice={inv}
                            onOpenModal={() => setPayInvoice(inv)}
                          />
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

      {/* Pay Now Modal (shown when multiple gateways or gateway list still loading) */}
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
