import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, ArrowRightLeft, FileText, ExternalLink } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, ExpenseStatus } from "@emp-billing/shared";
import { useExpense, useDeleteExpense, useBillExpense, useExpenseCategories } from "@/api/hooks/expense.hooks";
import { useClient } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

// ─── Status badge mapping ────────────────────────────────────────────────────

const EXPENSE_STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [ExpenseStatus.PENDING]:  { label: "Pending",  variant: "warning" },
  [ExpenseStatus.APPROVED]: { label: "Approved", variant: "info" },
  [ExpenseStatus.REJECTED]: { label: "Rejected", variant: "danger" },
  [ExpenseStatus.BILLED]:   { label: "Billed",   variant: "purple" },
  [ExpenseStatus.PAID]:     { label: "Paid",      variant: "success" },
};

function ExpenseStatusBadge({ status }: { status: string }) {
  const cfg = EXPENSE_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ExpenseDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: expenseData, isLoading } = useExpense(id);
  const deleteExpense = useDeleteExpense();
  const billExpense = useBillExpense();
  const { data: categoriesData } = useExpenseCategories();

  const expense = expenseData?.data;

  // Resolve category name
  const categories = (categoriesData?.data ?? []) as { id: string; name: string }[];
  const categoryName = categories.find((c) => c.id === expense?.categoryId)?.name ?? expense?.categoryId ?? "—";

  // Resolve client name (only fetched when expense is billable)
  const { data: clientData } = useClient(expense?.clientId ?? "");
  const clientName = clientData?.data
    ? (clientData.data as { displayName?: string; name: string }).displayName ||
      (clientData.data as { name: string }).name
    : undefined;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────────────────────

  if (!expense) {
    return (
      <div className="p-6">
        <EmptyState title="Expense not found" description="This expense may have been deleted." />
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleDelete() {
    if (window.confirm("Delete this expense? This cannot be undone.")) {
      deleteExpense.mutate(id);
    }
  }

  function handleBillToClient() {
    if (window.confirm("Convert this expense to an invoice? A new draft invoice will be created for the client.")) {
      billExpense.mutate(id);
    }
  }

  const canBillToClient =
    expense.isBillable &&
    !!expense.clientId &&
    expense.status !== ExpenseStatus.BILLED &&
    expense.status !== ExpenseStatus.PAID;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title="Expense Details"
        breadcrumb={[
          { label: "Expenses", href: "/expenses" },
          { label: expense.description || "Detail" },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canBillToClient && (
              <Button
                size="sm"
                variant="primary"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                loading={billExpense.isPending}
                onClick={handleBillToClient}
              >
                Convert to Invoice
              </Button>
            )}
            <Button
              size="sm"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => navigate(`/expenses/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              loading={deleteExpense.isPending}
              onClick={handleDelete}
            >
              <span className="text-red-600">Delete</span>
            </Button>
          </div>
        }
      />

      {/* Details Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <ExpenseStatusBadge status={expense.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
          {/* Description */}
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Description</p>
            <p className="font-medium text-gray-800 mt-1 whitespace-pre-wrap">{expense.description}</p>
          </div>

          {/* Date */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
            <p className="font-medium text-gray-800 mt-1">{dayjs(expense.date).format("DD MMM YYYY")}</p>
          </div>

          {/* Amount */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Amount</p>
            <p className="font-medium text-gray-800 mt-1">{formatMoney(expense.amount, expense.currency)}</p>
          </div>

          {/* Category */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Category</p>
            <p className="font-medium text-gray-800 mt-1">{categoryName}</p>
          </div>

          {/* Vendor */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Vendor</p>
            <p className="font-medium text-gray-800 mt-1">{expense.vendorName || "—"}</p>
          </div>

          {/* Billable */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Billable</p>
            <p className="font-medium text-gray-800 mt-1">
              {expense.isBillable ? (
                <Badge variant="info" size="sm">Yes</Badge>
              ) : (
                <Badge variant="gray" size="sm">No</Badge>
              )}
            </p>
          </div>

          {/* Client (only when billable) */}
          {expense.isBillable && expense.clientId && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Client</p>
              <button
                type="button"
                className="font-medium text-brand-600 hover:underline text-left mt-1"
                onClick={() => navigate(`/clients/${expense.clientId}`)}
              >
                {clientName ?? "View Client"}
              </button>
            </div>
          )}

          {/* Tags */}
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {expense.tags && expense.tags.length > 0 ? (
                expense.tags.map((tag) => (
                  <Badge key={tag} variant="default" size="sm">{tag}</Badge>
                ))
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          </div>

          {/* Currency */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Currency</p>
            <p className="font-medium text-gray-800 mt-1">{expense.currency}</p>
          </div>

          {/* Tax Amount */}
          {expense.taxAmount > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Tax Amount</p>
              <p className="font-medium text-gray-800 mt-1">{formatMoney(expense.taxAmount, expense.currency)}</p>
            </div>
          )}

          {/* Mileage — Distance */}
          {expense.distance != null && expense.distance > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Distance</p>
              <p className="font-medium text-gray-800 mt-1">{expense.distance}</p>
            </div>
          )}

          {/* Mileage — Rate */}
          {expense.mileageRate != null && expense.mileageRate > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Mileage Rate</p>
              <p className="font-medium text-gray-800 mt-1">{formatMoney(expense.mileageRate, expense.currency)} / unit</p>
            </div>
          )}
        </div>
      </div>

      {/* Receipt */}
      {expense.receiptUrl && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Receipt</h2>
          {/\.(jpg|jpeg|png|gif|webp)$/i.test(expense.receiptUrl) || expense.receiptUrl.startsWith("data:image") ? (
            <div className="space-y-3">
              <img
                src={expense.receiptUrl}
                alt="Expense receipt"
                className="max-w-sm max-h-64 rounded-lg border border-gray-200 object-contain"
              />
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Size
              </a>
            </div>
          ) : (
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
              <FileText className="h-5 w-5" />
              View Receipt (PDF)
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
