import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Trash2, FileText } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, CreditNoteStatus } from "@emp-billing/shared";
import { useCreditNotes, useDeleteCreditNote } from "@/api/hooks/credit-note.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Spinner } from "@/components/common/Spinner";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: CreditNoteStatus.DRAFT, label: "Draft" },
  { value: CreditNoteStatus.OPEN, label: "Open" },
  { value: CreditNoteStatus.APPLIED, label: "Applied" },
  { value: CreditNoteStatus.REFUNDED, label: "Refunded" },
  { value: CreditNoteStatus.VOID, label: "Void" },
];

const CN_STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [CreditNoteStatus.DRAFT]:    { label: "Draft",    variant: "gray" },
  [CreditNoteStatus.OPEN]:     { label: "Open",     variant: "info" },
  [CreditNoteStatus.APPLIED]:  { label: "Applied",  variant: "success" },
  [CreditNoteStatus.REFUNDED]: { label: "Refunded", variant: "warning" },
  [CreditNoteStatus.VOID]:     { label: "Void",     variant: "danger" },
};

function CreditNoteStatusBadge({ status }: { status: string }) {
  const cfg = CN_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function CreditNoteListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (status) params.status = status;

  const { data, isLoading } = useCreditNotes(Object.keys(params).length ? params : undefined);
  const deleteCreditNote = useDeleteCreditNote();

  const creditNotes = data?.data ?? [];

  function handleDelete(id: string, num: string) {
    if (window.confirm(`Delete credit note ${num}? This cannot be undone.`)) {
      deleteCreditNote.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Credit Notes"
        subtitle="Track and manage credit notes"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/credit-notes/new")}>
            New Credit Note
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search credit notes..."
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
      {!isLoading && creditNotes.length === 0 && (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={search || status ? "No credit notes match your filters" : "No credit notes yet"}
          description={search || status ? "Try adjusting the filters." : "Create your first credit note to get started."}
          action={
            search || status
              ? undefined
              : { label: "New Credit Note", onClick: () => navigate("/credit-notes/new") }
          }
        />
      )}

      {/* Table */}
      {!isLoading && creditNotes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Credit Note #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {creditNotes.map((cn) => (
                <tr
                  key={cn.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/credit-notes/${cn.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-brand-600">{cn.creditNoteNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{cn.clientId}</td>
                  <td className="px-4 py-3 text-gray-600">{dayjs(cn.date).format("DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(cn.total, "INR")}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(cn.balance, "INR")}</td>
                  <td className="px-4 py-3">
                    <CreditNoteStatusBadge status={cn.status} />
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
                        onClick={() => navigate(`/credit-notes/${cn.id}`)}
                      >
                        View
                      </Button>
                      {cn.status === CreditNoteStatus.DRAFT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => handleDelete(cn.id, cn.creditNoteNumber)}
                          loading={deleteCreditNote.isPending}
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
