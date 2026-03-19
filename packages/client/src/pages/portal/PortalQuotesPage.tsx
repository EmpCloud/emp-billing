import { Receipt } from "lucide-react";
import { usePortalQuotes, useAcceptPortalQuote, useDeclinePortalQuote } from "@/api/hooks/portal.hooks";
import { QuoteStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney, QuoteStatus } from "@emp-billing/shared";
import dayjs from "dayjs";
import type { Quote } from "@emp-billing/shared";

export function PortalQuotesPage() {
  const { data: res, isLoading } = usePortalQuotes();
  const acceptQuote = useAcceptPortalQuote();
  const declineQuote = useDeclinePortalQuote();

  const quotes = (res?.data ?? []) as Quote[];

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
        <Receipt className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">My Quotes</h1>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No quotes found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Quote #</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Expiry</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map((q) => {
                  const canAct = q.status === QuoteStatus.SENT || q.status === QuoteStatus.VIEWED;
                  return (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{q.quoteNumber}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {dayjs(q.issueDate).format("DD MMM YYYY")}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {dayjs(q.expiryDate).format("DD MMM YYYY")}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatMoney(q.total, q.currency)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <QuoteStatusBadge status={q.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canAct ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={acceptQuote.isPending}
                              onClick={() => acceptQuote.mutate(q.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              loading={declineQuote.isPending}
                              onClick={() => declineQuote.mutate(q.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
