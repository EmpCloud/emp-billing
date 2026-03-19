import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Eye, Pencil, Trash2, Receipt } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, ExpenseStatus } from "@emp-billing/shared";
import { useExpenses, useDeleteExpense, useExpenseCategories } from "@/api/hooks/expense.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: ExpenseStatus.PENDING, label: "Pending" },
  { value: ExpenseStatus.APPROVED, label: "Approved" },
  { value: ExpenseStatus.REJECTED, label: "Rejected" },
  { value: ExpenseStatus.BILLED, label: "Billed" },
  { value: ExpenseStatus.PAID, label: "Paid" },
];

const EXPENSE_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray"> = {
  [ExpenseStatus.PENDING]: "warning",
  [ExpenseStatus.APPROVED]: "info",
  [ExpenseStatus.REJECTED]: "danger",
  [ExpenseStatus.BILLED]: "purple",
  [ExpenseStatus.PAID]: "success",
};

export function ExpenseListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: categoriesData } = useExpenseCategories();
  const categories = (categoriesData?.data ?? []) as { id: string; name: string }[];

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (status) params.status = status;
  if (categoryId) params.categoryId = categoryId;
  if (dateFrom) params.from = dateFrom;
  if (dateTo) params.to = dateTo;

  const { data, isLoading } = useExpenses(Object.keys(params).length ? params : undefined);
  const deleteExpense = useDeleteExpense();

  const expenses = data?.data ?? [];

  function handleDelete(id: string, desc: string) {
    if (window.confirm(`Delete expense "${desc}"? This cannot be undone.`)) {
      deleteExpense.mutate(id);
    }
  }

  const hasFilters = !!(search || status || categoryId || dateFrom || dateTo);

  return (
    <div className="p-6">
      <PageHeader
        title="Expenses"
        subtitle="Track and manage business expenses"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/expenses/new")}>
            New Expense
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <Input
            placeholder="Search expenses..."
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
        <div className="w-44">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Input
            type="date"
            placeholder="From"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Input
            type="date"
            placeholder="To"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && expenses.length === 0 && (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title={hasFilters ? "No expenses match your filters" : "No expenses yet"}
          description={hasFilters ? "Try adjusting the filters." : "Record your first expense to get started."}
          action={
            hasFilters
              ? undefined
              : { label: "New Expense", onClick: () => navigate("/expenses/new") }
          }
        />
      )}

      {/* Table */}
      {!isLoading && expenses.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Billable?</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((expense) => {
                const cat = categories.find((c) => c.id === expense.categoryId);
                return (
                  <tr
                    key={expense.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/expenses/${expense.id}`)}
                  >
                    <td className="px-4 py-3 text-gray-600">{dayjs(expense.date).format("DD MMM YYYY")}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cat?.name ?? expense.categoryId}</td>
                    <td className="px-4 py-3 text-gray-600">{expense.vendorName || "\u2014"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(expense.amount, expense.currency)}</td>
                    <td className="px-4 py-3 text-center">
                      {expense.isBillable ? (
                        <Badge variant="info" size="sm">Yes</Badge>
                      ) : (
                        <Badge variant="gray" size="sm">No</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={EXPENSE_STATUS_VARIANT[expense.status] ?? "default"}>
                        {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => navigate(`/expenses/${expense.id}/edit`)}
                        >
                          Edit
                        </Button>
                        {expense.status === ExpenseStatus.PENDING && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="h-4 w-4 text-red-500" />}
                            onClick={() => handleDelete(expense.id, expense.description)}
                            loading={deleteExpense.isPending}
                          >
                            <span className="text-red-600">Delete</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
