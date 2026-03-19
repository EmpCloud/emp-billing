import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Check } from "lucide-react";
import { BillingInterval } from "@emp-billing/shared";
import { usePlans, useDeletePlan } from "@/api/hooks/subscription.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const INTERVAL_LABELS: Record<string, string> = {
  [BillingInterval.MONTHLY]: "Monthly",
  [BillingInterval.QUARTERLY]: "Quarterly",
  [BillingInterval.SEMI_ANNUAL]: "Semi-Annual",
  [BillingInterval.ANNUAL]: "Annual",
  [BillingInterval.CUSTOM]: "Custom",
};

function formatMoney(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function PlanListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = usePlans();
  const deletePlan = useDeletePlan();

  const plans = data?.data ?? [];

  function handleDelete(id: string) {
    if (window.confirm("Deactivate this plan? Existing subscriptions will not be affected.")) {
      deletePlan.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Plans"
        subtitle="Manage your subscription plans"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/subscriptions/plans/new")}>
            New Plan
          </Button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && plans.length === 0 && (
        <EmptyState
          icon={<Plus className="h-12 w-12" />}
          title="No plans yet"
          description="Create your first subscription plan to get started."
          action={{ label: "New Plan", onClick: () => navigate("/subscriptions/plans/new") }}
        />
      )}

      {!isLoading && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  )}
                </div>
                <Badge variant={plan.isActive ? "success" : "gray"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {formatMoney(plan.price, plan.currency)}
                </span>
                <span className="text-sm text-gray-500 ml-1">
                  / {INTERVAL_LABELS[plan.billingInterval] ?? plan.billingInterval}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                {plan.setupFee > 0 && (
                  <div>Setup Fee: {formatMoney(plan.setupFee, plan.currency)}</div>
                )}
                {plan.trialPeriodDays > 0 && (
                  <div>Trial: {plan.trialPeriodDays} days</div>
                )}
                {plan.billingInterval === BillingInterval.CUSTOM && plan.billingIntervalDays && (
                  <div>Interval: Every {plan.billingIntervalDays} days</div>
                )}
              </div>

              {/* Features */}
              {plan.features && plan.features.length > 0 && (
                <div className="flex-1 mb-4">
                  <ul className="space-y-1.5">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Edit2 className="h-4 w-4" />}
                  onClick={() => navigate(`/subscriptions/plans/${plan.id}/edit`)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4 text-red-500" />}
                  onClick={() => handleDelete(plan.id)}
                  loading={deletePlan.isPending}
                >
                  <span className="text-red-600">Delete</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
