import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CreditCard, Download } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, PaymentMethod } from "@emp-billing/shared";
import { usePayments, useDownloadPaymentReceipt } from "@/api/hooks/payment.hooks";
import { Button } from "@/components/common/Button";
import { SearchableSelect } from "@/components/common/Input";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

function ReceiptDownloadButton({ paymentId }: { paymentId: string }) {
  const downloadReceipt = useDownloadPaymentReceipt(paymentId);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Download className="h-4 w-4" />}
      onClick={() => void downloadReceipt()}
    >
      Receipt
    </Button>
  );
}

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

export function PaymentListPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState("");

  const params: Record<string, string> = {};
  if (method) params.method = method;

  const { data, isLoading } = usePayments(Object.keys(params).length ? params : undefined);

  const payments = data?.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Payments"
        subtitle="All recorded payments"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/payments/record")}>
            Record Payment
          </Button>
        }
      />

      {/* Filter */}
      <div className="mb-4 w-48">
        <SearchableSelect
          value={method}
          onChange={(val) => setMethod(val)}
          placeholder="All Methods"
          options={[
            { value: "", label: "All Methods" },
            ...Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => ({
              value: val,
              label,
            })),
          ]}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && payments.length === 0 && (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title={method ? "No payments match this filter" : "No payments recorded"}
          description={method ? "Try a different method filter." : "Record a payment from an invoice or use the button above."}
        />
      )}

      {/* Table */}
      {!isLoading && payments.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Payment #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Method</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-brand-600">{payment.paymentNumber}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <button
                      type="button"
                      className="hover:underline text-left"
                      onClick={() => navigate(`/clients/${payment.clientId}`)}
                    >
                      {payment.clientId}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {dayjs(payment.date).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">
                    {formatMoney(payment.amount, "INR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ReceiptDownloadButton paymentId={payment.id} />
                      {payment.invoiceId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/invoices/${payment.invoiceId}`)}
                        >
                          View Invoice
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
