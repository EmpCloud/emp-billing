import { useNavigate } from "react-router-dom";
import { Repeat, ArrowRight } from "lucide-react";
import { usePortalSubscriptions } from "@/api/hooks/portal.hooks";
import { SubscriptionStatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney, BillingInterval } from "@emp-billing/shared";
import dayjs from "dayjs";
import type { Subscription, Plan } from "@emp-billing/shared";

const INTERVAL_LABELS: Record<string, string> = {
  [BillingInterval.MONTHLY]: "/mo",
  [BillingInterval.QUARTERLY]: "/qtr",
  [BillingInterval.SEMI_ANNUAL]: "/6mo",
  [BillingInterval.ANNUAL]: "/yr",
  [BillingInterval.CUSTOM]: "",
};

export function PortalSubscriptionsPage() {
  const navigate = useNavigate();
  const { data: res, isLoading } = usePortalSubscriptions();

  const subscriptions = (res?.data ?? []) as (Subscription & { plan?: Plan })[];

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
        <Repeat className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">My Subscriptions</h1>
      </div>

      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <Repeat className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No subscriptions found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {sub.plan?.name ?? "Unknown Plan"}
                  </h3>
                  <div className="mt-1">
                    <SubscriptionStatusBadge status={sub.status} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {sub.plan
                      ? formatMoney(sub.plan.price, sub.plan.currency)
                      : "--"}
                  </p>
                  {sub.plan && (
                    <p className="text-xs text-gray-500">
                      {INTERVAL_LABELS[sub.plan.billingInterval] || ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Period info */}
              <div className="space-y-1.5 text-sm text-gray-600">
                {sub.currentPeriodStart && sub.currentPeriodEnd && (
                  <div className="flex justify-between">
                    <span>Current period</span>
                    <span className="text-gray-900">
                      {dayjs(sub.currentPeriodStart).format("DD MMM")} &ndash;{" "}
                      {dayjs(sub.currentPeriodEnd).format("DD MMM YYYY")}
                    </span>
                  </div>
                )}
                {sub.nextBillingDate && (
                  <div className="flex justify-between">
                    <span>Next billing</span>
                    <span className="text-gray-900">
                      {dayjs(sub.nextBillingDate).format("DD MMM YYYY")}
                    </span>
                  </div>
                )}
              </div>

              {/* Action */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/portal/subscriptions/${sub.id}`)}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Manage
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
