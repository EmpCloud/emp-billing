import { useNavigate, useParams } from "react-router-dom";
import {
  Edit, Trash2, Ticket, Calendar, Hash, DollarSign,
  Users, Target, CheckCircle, XCircle, ArrowLeft,
} from "lucide-react";
import dayjs from "dayjs";
import { formatMoney, CouponType, CouponAppliesTo } from "@emp-billing/shared";
import { useCoupon, useDeleteCoupon, useCouponRedemptions } from "@/api/hooks/coupon.hooks";
import { Button } from "@/components/common/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

const APPLIES_TO_LABELS: Record<string, string> = {
  [CouponAppliesTo.INVOICE]: "Invoice",
  [CouponAppliesTo.SUBSCRIPTION]: "Subscription",
  [CouponAppliesTo.PRODUCT]: "Specific Product",
};

export function CouponDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: couponData, isLoading } = useCoupon(id);
  const deleteCoupon = useDeleteCoupon();
  const { data: redemptionsData, isLoading: loadingRedemptions } = useCouponRedemptions(id);

  const coupon = couponData?.data;
  const redemptions = redemptionsData?.data ?? [];

  function handleDelete() {
    if (!coupon) return;
    if (window.confirm(`Deactivate coupon "${coupon.code}"?`)) {
      deleteCoupon.mutate(coupon.id, {
        onSuccess: () => navigate("/coupons"),
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="p-6">
        <EmptyState
          title="Coupon not found"
          description="This coupon may have been deleted."
        />
      </div>
    );
  }

  const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
  const isMaxed = coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined && coupon.timesRedeemed >= coupon.maxRedemptions;
  const currency = coupon.currency ?? "INR";

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={coupon.code}
        subtitle={coupon.name}
        breadcrumb={[
          { label: "Coupons", href: "/coupons" },
          { label: coupon.code },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/coupons/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={handleDelete}
              loading={deleteCoupon.isPending}
            >
              Deactivate
            </Button>
          </div>
        }
      />

      {/* Details Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Coupon Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-6">
          <div className="flex items-start gap-3">
            <Ticket className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Code</p>
              <p className="text-sm text-gray-900 font-mono font-bold">{coupon.code}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Hash className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Name</p>
              <p className="text-sm text-gray-900">{coupon.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Discount</p>
              <p className="text-sm text-gray-900 font-medium">
                {coupon.type === CouponType.PERCENTAGE
                  ? `${coupon.value}% off`
                  : `${formatMoney(coupon.value, currency)} off`}
              </p>
              <Badge
                variant={coupon.type === CouponType.PERCENTAGE ? "info" : "purple"}
                size="sm"
              >
                {coupon.type === CouponType.PERCENTAGE ? "Percentage" : "Fixed Amount"}
              </Badge>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Target className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Applies To</p>
              <p className="text-sm text-gray-900">
                {APPLIES_TO_LABELS[coupon.appliesTo] ?? coupon.appliesTo}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Redemptions</p>
              <p className="text-sm text-gray-900">
                {coupon.timesRedeemed}
                {coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined
                  ? ` / ${coupon.maxRedemptions}`
                  : " / unlimited"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Max Per Client</p>
              <p className="text-sm text-gray-900">
                {coupon.maxRedemptionsPerClient ?? "Unlimited"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Minimum Amount</p>
              <p className="text-sm text-gray-900">
                {coupon.minAmount > 0 ? formatMoney(coupon.minAmount, currency) : "None"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500">Validity</p>
              <p className="text-sm text-gray-900">
                {dayjs(coupon.validFrom).format("MMM D, YYYY")}
                {coupon.validUntil
                  ? ` to ${dayjs(coupon.validUntil).format("MMM D, YYYY")}`
                  : " — No expiry"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {coupon.isActive && !isExpired && !isMaxed ? (
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="text-xs font-medium text-gray-500">Status</p>
              <div className="mt-0.5">
                {!coupon.isActive ? (
                  <Badge variant="gray" size="sm">Inactive</Badge>
                ) : isExpired ? (
                  <Badge variant="warning" size="sm">Expired</Badge>
                ) : isMaxed ? (
                  <Badge variant="gray" size="sm">Maxed Out</Badge>
                ) : (
                  <Badge variant="success" size="sm">Active</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Redemption History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Redemption History ({redemptions.length})
          </h2>
        </div>

        {loadingRedemptions ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : redemptions.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No redemptions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Redeemed At</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Client ID</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Invoice ID</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Discount</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-gray-900">
                      {dayjs(r.redeemedAt).format("MMM D, YYYY h:mm A")}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                      {r.clientId}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                      {r.invoiceId ?? "-"}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900 font-medium">
                      {formatMoney(r.discountAmount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
