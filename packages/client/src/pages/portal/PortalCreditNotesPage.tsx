import { FileText } from "lucide-react";
import { usePortalCreditNotes } from "@/api/hooks/portal.hooks";
import { Badge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney, CreditNoteStatus } from "@emp-billing/shared";
import dayjs from "dayjs";
import type { CreditNote } from "@emp-billing/shared";

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

export function PortalCreditNotesPage() {
  const { data: res, isLoading } = usePortalCreditNotes();

  const creditNotes = (res?.data ?? []) as CreditNote[];

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
        <h1 className="text-xl font-bold text-gray-900">My Credit Notes</h1>
      </div>

      {creditNotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No credit notes found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Credit Note #</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{cn.creditNoteNumber}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(cn.date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <CreditNoteStatusBadge status={cn.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatMoney(cn.total, "INR")}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">
                      {formatMoney(cn.balance, "INR")}
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
