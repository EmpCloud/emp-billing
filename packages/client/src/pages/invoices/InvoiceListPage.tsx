import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Trash2, Download, FileText, Mail, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { formatMoney, InvoiceStatus } from "@emp-billing/shared";
import { useInvoices, useDeleteInvoice, useDownloadInvoicePdf } from "@/api/hooks/invoice.hooks";
import { apiDelete, apiPost, api } from "@/api/client";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: InvoiceStatus.DRAFT, label: "Draft" },
  { value: InvoiceStatus.SENT, label: "Sent" },
  { value: InvoiceStatus.VIEWED, label: "Viewed" },
  { value: InvoiceStatus.PARTIALLY_PAID, label: "Partial" },
  { value: InvoiceStatus.PAID, label: "Paid" },
  { value: InvoiceStatus.OVERDUE, label: "Overdue" },
  { value: InvoiceStatus.VOID, label: "Void" },
];

function DownloadButton({ invoiceId }: { invoiceId: string }) {
  const download = useDownloadInvoicePdf(invoiceId);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<Download className="h-4 w-4" />}
      onClick={(e) => { e.stopPropagation(); void download(); }}
    >
      PDF
    </Button>
  );
}

export function InvoiceListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState(() => dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(() => dayjs().endOf("month").format("YYYY-MM-DD"));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (status) params.status = status;
  if (fromDate) params.from = fromDate;
  if (toDate) params.to = toDate;

  const { data, isLoading } = useInvoices(Object.keys(params).length ? params : undefined);
  const deleteInvoice = useDeleteInvoice();

  const invoices = data?.data ?? [];

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }

  async function handleBulkSend() {
    const ids = Array.from(selectedIds);
    setBulkSending(true);
    try {
      await Promise.all(ids.map((id) => apiPost(`/invoices/${id}/send`)));
      toast.success(`${ids.length} invoice(s) sent`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || "Failed to send some invoices");
    } finally {
      setBulkSending(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} invoices? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(ids.map((id) => apiDelete(`/invoices/${id}`)));
      toast.success(`${ids.length} invoice(s) deleted`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || "Failed to delete some invoices");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkDownloadPdf() {
    const ids = Array.from(selectedIds);
    setBulkDownloading(true);
    try {
      const res = await api.post("/invoices/bulk-pdf", { ids }, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloading ${ids.length} invoice PDF(s)`);
    } catch {
      toast.error("Failed to download invoice PDFs");
    } finally {
      setBulkDownloading(false);
    }
  }

  function handleDelete(id: string, num: string) {
    if (window.confirm(`Delete invoice ${num}? This cannot be undone.`)) {
      deleteInvoice.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Invoices"
        subtitle="Track and manage all your invoices"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/invoices/new")}>
            New Invoice
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search invoices or clients…"
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
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        {(search || status || fromDate || toDate) && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatus(""); setFromDate(""); setToDate(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && invoices.length === 0 && (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={search || status ? "No invoices match your filters" : "No invoices yet"}
          description={search || status ? "Try adjusting the filters." : "Create your first invoice to get started."}
          action={
            search || status
              ? undefined
              : { label: "New Invoice", onClick: () => navigate("/invoices/new") }
          }
        />
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-brand-700">
            {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            icon={<Mail className="h-4 w-4" />}
            onClick={() => void handleBulkSend()}
            loading={bulkSending}
          >
            Send Selected
          </Button>
          <Button
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void handleBulkDownloadPdf()}
            loading={bulkDownloading}
          >
            Download PDFs
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            onClick={() => void handleBulkDelete()}
            loading={bulkDeleting}
          >
            <span className="text-red-600">Delete Selected</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<X className="h-4 w-4" />}
            onClick={() => setSelectedIds(new Set())}
          >
            Deselect All
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && invoices.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={invoices.length > 0 && selectedIds.size === invoices.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{(inv as unknown as { clientName?: string }).clientName ?? inv.clientId}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(inv.issueDate).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(inv.dueDate).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={inv.status} />
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
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                      >
                        View
                      </Button>
                      <DownloadButton invoiceId={inv.id} />
                      {inv.status === InvoiceStatus.DRAFT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                          loading={deleteInvoice.isPending}
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
