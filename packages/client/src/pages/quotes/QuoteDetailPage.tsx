import { useNavigate, useParams } from "react-router-dom";
import { Send, Trash2, FileText, ArrowRightLeft, Pencil, Download } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, QuoteStatus } from "@emp-billing/shared";
import {
  useQuote, useSendQuote, useConvertQuoteToInvoice, useDeleteQuote, useDownloadQuotePdf,
} from "@/api/hooks/quote.hooks";
import { Button } from "@/components/common/Button";
import { QuoteStatusBadge } from "@/components/common/Badge";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

export function QuoteDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quoteData, isLoading } = useQuote(id);
  const sendQuote = useSendQuote();
  const convertQuote = useConvertQuoteToInvoice();
  const deleteQuote = useDeleteQuote();
  const downloadPdf = useDownloadQuotePdf(id);

  const quote = quoteData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-6">
        <EmptyState title="Quote not found" description="This quote may have been deleted." />
      </div>
    );
  }

  const canEdit = quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.SENT;
  const canSend = quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.SENT;
  const canConvert = quote.status === QuoteStatus.ACCEPTED;
  const canDelete = quote.status === QuoteStatus.DRAFT;

  function handleDelete() {
    if (window.confirm("Delete this quote? This cannot be undone.")) {
      deleteQuote.mutate(id);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title={quote.quoteNumber}
        breadcrumb={[{ label: "Quotes", href: "/quotes" }, { label: quote.quoteNumber }]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button
                size="sm"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => navigate(`/quotes/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canSend && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                loading={sendQuote.isPending}
                onClick={() => sendQuote.mutate(id)}
              >
                Send
              </Button>
            )}
            {canConvert && (
              <Button
                size="sm"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                loading={convertQuote.isPending}
                onClick={() => convertQuote.mutate(id)}
              >
                Convert to Invoice
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
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-4 w-4 text-red-500" />}
                loading={deleteQuote.isPending}
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
          <QuoteStatusBadge status={quote.status} />
          {quote.version > 1 && (
            <span className="text-sm text-gray-500">Version {quote.version}</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Issue Date</p>
            <p className="font-medium text-gray-800">{dayjs(quote.issueDate).format("DD MMM YYYY")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Expiry Date</p>
            <p className="font-medium text-gray-800">{dayjs(quote.expiryDate).format("DD MMM YYYY")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Currency</p>
            <p className="font-medium text-gray-800">{quote.currency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Client</p>
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline text-left"
              onClick={() => navigate(`/clients/${quote.clientId}`)}
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
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatMoney(item.rate, quote.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {item.taxRate > 0 ? `${item.taxRate}%` : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatMoney(item.amount, quote.currency)}
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
              <span>{formatMoney(quote.subtotal, quote.currency)}</span>
            </div>
            {quote.discountAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span>-{formatMoney(quote.discountAmount, quote.currency)}</span>
              </div>
            )}
            {quote.taxAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatMoney(quote.taxAmount, quote.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatMoney(quote.total, quote.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes / Terms */}
      {(quote.notes || quote.terms) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quote.notes && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Converted Invoice Link */}
      {quote.convertedInvoiceId && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5 flex items-center gap-3">
          <FileText className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              This quote has been converted to an invoice.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/invoices/${quote.convertedInvoiceId}`)}
          >
            View Invoice
          </Button>
        </div>
      )}
    </div>
  );
}
