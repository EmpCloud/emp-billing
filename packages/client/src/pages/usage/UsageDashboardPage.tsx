import { useState } from "react";
import { Plus, Activity, BarChart3, Hash } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, PricingModel } from "@emp-billing/shared";
import { useUsageRecords, useUsageSummary, useRecordUsage } from "@/api/hooks/usage.hooks";
import { useProducts } from "@/api/hooks/product.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { StatsCard } from "@/components/common/StatsCard";

const INITIAL_FORM = {
  productId: "",
  clientId: "",
  quantity: "",
  description: "",
  periodStart: "",
  periodEnd: "",
};

export function UsageDashboardPage() {
  const [page, setPage] = useState(1);
  const [filterProductId, setFilterProductId] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterPeriodStart, setFilterPeriodStart] = useState("");
  const [filterPeriodEnd, setFilterPeriodEnd] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  // Build query params for the records list
  const params: Record<string, string | number> = { page, limit: 20 };
  if (filterProductId) params.productId = filterProductId;
  if (filterClientId) params.clientId = filterClientId;
  if (filterPeriodStart) params.periodStart = filterPeriodStart;
  if (filterPeriodEnd) params.periodEnd = filterPeriodEnd;

  const { data: recordsData, isLoading } = useUsageRecords(params);
  const records = recordsData?.data ?? [];
  const meta = recordsData?.meta;

  // Summary query (only when all filter fields are set)
  const summaryEnabled = !!(filterProductId && filterClientId && filterPeriodStart && filterPeriodEnd);
  const { data: summaryData } = useUsageSummary({
    productId: filterProductId,
    clientId: filterClientId,
    periodStart: filterPeriodStart,
    periodEnd: filterPeriodEnd,
  });
  const summary = summaryData?.data;

  // Products and clients for dropdowns
  const { data: productsData } = useProducts();
  const products = productsData?.data ?? [];
  const meteredProducts = products.filter((p) => p.pricingModel === PricingModel.METERED);

  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];

  const recordUsage = useRecordUsage();

  // Lookup helpers
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  function handleRecordUsage(e: React.FormEvent) {
    e.preventDefault();
    recordUsage.mutate(
      {
        productId: form.productId,
        clientId: form.clientId,
        quantity: Number(form.quantity),
        description: form.description || undefined,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      },
      {
        onSuccess: () => {
          setShowModal(false);
          setForm(INITIAL_FORM);
        },
      },
    );
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="p-6">
      <PageHeader
        title="Usage Records"
        subtitle="View and manage metered usage"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
            Record Usage
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterProductId}
            onChange={(e) => { setFilterProductId(e.target.value); setPage(1); }}
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterClientId}
            onChange={(e) => { setFilterClientId(e.target.value); setPage(1); }}
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period Start</label>
          <Input
            type="date"
            value={filterPeriodStart}
            onChange={(e) => { setFilterPeriodStart(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period End</label>
          <Input
            type="date"
            value={filterPeriodEnd}
            onChange={(e) => { setFilterPeriodEnd(e.target.value); setPage(1); }}
          />
        </div>
        {(filterProductId || filterClientId || filterPeriodStart || filterPeriodEnd) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterProductId("");
              setFilterClientId("");
              setFilterPeriodStart("");
              setFilterPeriodEnd("");
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summaryEnabled && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard
            label="Total Quantity"
            value={summary.totalQuantity.toLocaleString()}
            icon={<Hash className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            label="Total Amount"
            value={formatMoney(summary.totalAmount, "INR")}
            icon={<BarChart3 className="h-5 w-5" />}
            color="green"
          />
          <StatsCard
            label="Record Count"
            value={summary.recordCount.toLocaleString()}
            icon={<Activity className="h-5 w-5" />}
            color="purple"
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title={
            filterProductId || filterClientId || filterPeriodStart || filterPeriodEnd
              ? "No usage records match your filters"
              : "No usage records yet"
          }
          description={
            filterProductId || filterClientId || filterPeriodStart || filterPeriodEnd
              ? "Try adjusting the filters."
              : "Record usage for metered products to see data here."
          }
          action={
            filterProductId || filterClientId || filterPeriodStart || filterPeriodEnd
              ? undefined
              : { label: "Record Usage", onClick: () => setShowModal(true) }
          }
        />
      )}

      {/* Records Table */}
      {!isLoading && records.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <span>{productMap.get(record.productId) ?? record.productId}</span>
                        <Badge variant="info" size="sm">Metered</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {clientMap.get(record.clientId) ?? record.clientId}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {record.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {dayjs(record.periodStart).format("DD MMM")} &ndash;{" "}
                      {dayjs(record.periodEnd).format("DD MMM YYYY")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {dayjs(record.recordedAt).format("DD MMM YYYY, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
                {meta?.total != null && <> &middot; {meta.total} records</>}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Record Usage Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Usage">
        <form onSubmit={handleRecordUsage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product (Metered)</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              required
            >
              <option value="">Select product...</option>
              {meteredProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordUsage.isPending}>
              Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
