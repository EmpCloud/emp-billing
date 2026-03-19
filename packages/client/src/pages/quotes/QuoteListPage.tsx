import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Trash2, FileText } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, QuoteStatus } from "@emp-billing/shared";
import { useQuotes, useDeleteQuote } from "@/api/hooks/quote.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { QuoteStatusBadge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: QuoteStatus.DRAFT, label: "Draft" },
  { value: QuoteStatus.SENT, label: "Sent" },
  { value: QuoteStatus.ACCEPTED, label: "Accepted" },
  { value: QuoteStatus.DECLINED, label: "Declined" },
  { value: QuoteStatus.EXPIRED, label: "Expired" },
  { value: QuoteStatus.CONVERTED, label: "Converted" },
];

export function QuoteListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (status) params.status = status;

  const { data, isLoading } = useQuotes(Object.keys(params).length ? params : undefined);
  const deleteQuote = useDeleteQuote();

  const quotes = data?.data ?? [];

  function handleDelete(id: string, num: string) {
    if (window.confirm(`Delete quote ${num}? This cannot be undone.`)) {
      deleteQuote.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Quotes"
        subtitle="Create and manage estimates for your clients"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/quotes/new")}>
            New Quote
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search quotes..."
            prefix={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && quotes.length === 0 && (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={search || status ? "No quotes match your filters" : "No quotes yet"}
          description={search || status ? "Try adjusting the filters." : "Create your first quote to get started."}
          action={
            search || status
              ? undefined
              : { label: "New Quote", onClick: () => navigate("/quotes/new") }
          }
        />
      )}

      {/* Table */}
      {!isLoading && quotes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Quote #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expiry Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((quote) => (
                <tr
                  key={quote.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-brand-600">{quote.quoteNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{quote.clientId}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(quote.issueDate).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(quote.expiryDate).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(quote.total, quote.currency)}</td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                      >
                        View
                      </Button>
                      {quote.status === QuoteStatus.DRAFT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => handleDelete(quote.id, quote.quoteNumber)}
                          loading={deleteQuote.isPending}
                        >
                          <span className="text-red-600">Delete</span>
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
