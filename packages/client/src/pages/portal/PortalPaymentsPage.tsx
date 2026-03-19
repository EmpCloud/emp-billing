import { CreditCard } from "lucide-react";
import { usePortalPayments } from "@/api/hooks/portal.hooks";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney } from "@emp-billing/shared";
import dayjs from "dayjs";
import type { Payment } from "@emp-billing/shared";

export function PortalPaymentsPage() {
  const { data: res, isLoading } = usePortalPayments();

  const payments = (res?.data ?? []) as Payment[];

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
        <CreditCard className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">My Payments</h1>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No payments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Payment #</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{pay.paymentNumber}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(pay.date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-600">
                      {formatMoney(pay.amount, "INR")}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize">
                      {String(pay.method).replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
