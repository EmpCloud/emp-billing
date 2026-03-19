import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Ticket, Edit, Eye, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, CouponType } from "@emp-billing/shared";
import { useCoupons, useDeleteCoupon } from "@/api/hooks/coupon.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

export function CouponListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCoupons({ page, limit: 20, search: search || "" });
  const deleteCoupon = useDeleteCoupon();

  const coupons = data?.data ?? [];
  const meta = data?.meta;

  function handleDelete(id: string, code: string) {
    if (window.confirm(`Deactivate coupon "${code}"?`)) {
      deleteCoupon.mutate(id);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Coupons"
        breadcrumb={[{ label: "Coupons" }]}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate("/coupons/new")}
          >
            New Coupon
          </Button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search coupons..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          title="No coupons yet"
          description="Create your first coupon to offer discounts."
          action={{ label: "New Coupon", onClick: () => navigate("/coupons/new") }}
        />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Code</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Value</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Redemptions</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Valid</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
                    const isMaxed = coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined && coupon.timesRedeemed >= coupon.maxRedemptions;
                    return (
                      <tr
                        key={coupon.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => navigate(`/coupons/${coupon.id}`)}
                      >
                        <td className="px-6 py-3">
                          <span className="font-mono font-semibold text-brand-600">
                            {coupon.code}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-900">{coupon.name}</td>
                        <td className="px-6 py-3">
                          <Badge variant={coupon.type === CouponType.PERCENTAGE ? "info" : "purple"} size="sm">
                            {coupon.type === CouponType.PERCENTAGE ? "Percentage" : "Fixed Amount"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-gray-900 font-medium">
                          {coupon.type === CouponType.PERCENTAGE
                            ? `${coupon.value}%`
                            : formatMoney(coupon.value, coupon.currency ?? "INR")}
                        </td>
                        <td className="px-6 py-3 text-gray-600">
                          {coupon.timesRedeemed}
                          {coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined
                            ? ` / ${coupon.maxRedemptions}`
                            : " / unlimited"}
                        </td>
                        <td className="px-6 py-3 text-gray-600 text-xs">
                          <div>{dayjs(coupon.validFrom).format("MMM D, YYYY")}</div>
                          {coupon.validUntil && (
                            <div className="text-gray-400">
                              to {dayjs(coupon.validUntil).format("MMM D, YYYY")}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {!coupon.isActive ? (
                            <Badge variant="gray" size="sm">Inactive</Badge>
                          ) : isExpired ? (
                            <Badge variant="warning" size="sm">Expired</Badge>
                          ) : isMaxed ? (
                            <Badge variant="gray" size="sm">Maxed Out</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                              onClick={() => navigate(`/coupons/${coupon.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                              onClick={() => navigate(`/coupons/${coupon.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100"
                              onClick={() => handleDelete(coupon.id, coupon.code)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing {(meta.page - 1) * meta.limit + 1} to{" "}
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
