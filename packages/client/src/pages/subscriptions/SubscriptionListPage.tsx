import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pause, Play, XCircle, ArrowRightLeft, CreditCard } from "lucide-react";
import dayjs from "dayjs";
import { SubscriptionStatus } from "@emp-billing/shared";
import {
  useSubscriptions,
  usePauseSubscription,
  useResumeSubscription,
} from "@/api/hooks/subscription.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Select } from "@/components/common/Input";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: SubscriptionStatus.TRIALING, label: "Trialing" },
  { value: SubscriptionStatus.ACTIVE, label: "Active" },
  { value: SubscriptionStatus.PAUSED, label: "Paused" },
  { value: SubscriptionStatus.PAST_DUE, label: "Past Due" },
  { value: SubscriptionStatus.CANCELLED, label: "Cancelled" },
  { value: SubscriptionStatus.EXPIRED, label: "Expired" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [SubscriptionStatus.TRIALING]:  { label: "Trialing",  variant: "purple" },
  [SubscriptionStatus.ACTIVE]:    { label: "Active",    variant: "success" },
  [SubscriptionStatus.PAUSED]:    { label: "Paused",    variant: "warning" },
  [SubscriptionStatus.PAST_DUE]:  { label: "Past Due",  variant: "danger" },
  [SubscriptionStatus.CANCELLED]: { label: "Cancelled", variant: "gray" },
  [SubscriptionStatus.EXPIRED]:   { label: "Expired",   variant: "gray" },
};

function SubscriptionStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function SubscriptionListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");

  const params: Record<string, string> = {};
  if (status) params.status = status;

  const { data, isLoading } = useSubscriptions(Object.keys(params).length ? params : undefined);
  const pauseSubscription = usePauseSubscription();
  const resumeSubscription = useResumeSubscription();

  const subscriptions = data?.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Manage client subscriptions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/subscriptions/plans")}>
              Manage Plans
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate("/subscriptions/new")}>
              New Subscription
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && subscriptions.length === 0 && (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title={status ? "No subscriptions match your filters" : "No subscriptions yet"}
          description={status ? "Try adjusting the filters." : "Create a subscription to start billing clients."}
          action={
            status
              ? undefined
              : { label: "New Subscription", onClick: () => navigate("/subscriptions/new") }
          }
        />
      )}

      {!isLoading && subscriptions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Next Billing</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/subscriptions/${sub.id}`)}
                >
                  <td className="px-4 py-3 text-gray-700">{sub.clientId}</td>
                  <td className="px-4 py-3 text-gray-700">{sub.planId}</td>
                  <td className="px-4 py-3">
                    <SubscriptionStatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {sub.currentPeriodStart && sub.currentPeriodEnd ? (
                      <>
                        {dayjs(sub.currentPeriodStart).format("DD MMM")} - {dayjs(sub.currentPeriodEnd).format("DD MMM YYYY")}
                      </>
                    ) : sub.trialEnd ? (
                      <>Trial ends {dayjs(sub.trialEnd).format("DD MMM YYYY")}</>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{sub.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {dayjs(sub.nextBillingDate).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {sub.status === SubscriptionStatus.ACTIVE && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                            onClick={() => navigate(`/subscriptions/${sub.id}`)}
                          >
                            Change
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pause className="h-3.5 w-3.5" />}
                            loading={pauseSubscription.isPending}
                            onClick={() => pauseSubscription.mutate(sub.id)}
                          >
                            Pause
                          </Button>
                        </>
                      )}
                      {sub.status === SubscriptionStatus.PAUSED && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Play className="h-3.5 w-3.5" />}
                          loading={resumeSubscription.isPending}
                          onClick={() => resumeSubscription.mutate(sub.id)}
                        >
                          Resume
                        </Button>
                      )}
                      {[SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAUSED].includes(sub.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
                          onClick={() => navigate(`/subscriptions/${sub.id}`)}
                        >
                          <span className="text-red-600">Cancel</span>
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
