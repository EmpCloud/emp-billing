import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Repeat,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Clock,
  Zap,
  Pause,
  Play,
  Ban,
  AlertTriangle,
} from "lucide-react";
import {
  usePortalSubscription,
  usePortalPlans,
  usePortalChangePlan,
  usePortalCancelSubscription,
} from "@/api/hooks/portal.hooks";
import { SubscriptionStatusBadge } from "@/components/common/Badge";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import {
  formatMoney,
  BillingInterval,
  SubscriptionStatus,
  SubscriptionEventType,
} from "@emp-billing/shared";
import dayjs from "dayjs";
import type { Plan, Subscription, SubscriptionEvent } from "@emp-billing/shared";

const INTERVAL_LABELS: Record<string, string> = {
  [BillingInterval.MONTHLY]: "/mo",
  [BillingInterval.QUARTERLY]: "/qtr",
  [BillingInterval.SEMI_ANNUAL]: "/6mo",
  [BillingInterval.ANNUAL]: "/yr",
  [BillingInterval.CUSTOM]: "",
};

const INTERVAL_FULL_LABELS: Record<string, string> = {
  [BillingInterval.MONTHLY]: "Monthly",
  [BillingInterval.QUARTERLY]: "Quarterly",
  [BillingInterval.SEMI_ANNUAL]: "Semi-Annual",
  [BillingInterval.ANNUAL]: "Annual",
  [BillingInterval.CUSTOM]: "Custom",
};

const EVENT_ICONS: Record<string, typeof Repeat> = {
  [SubscriptionEventType.CREATED]: Zap,
  [SubscriptionEventType.ACTIVATED]: Play,
  [SubscriptionEventType.TRIAL_STARTED]: Clock,
  [SubscriptionEventType.TRIAL_ENDED]: Clock,
  [SubscriptionEventType.RENEWED]: Repeat,
  [SubscriptionEventType.UPGRADED]: ArrowUpRight,
  [SubscriptionEventType.DOWNGRADED]: ArrowDownRight,
  [SubscriptionEventType.PAUSED]: Pause,
  [SubscriptionEventType.RESUMED]: Play,
  [SubscriptionEventType.CANCELLED]: Ban,
  [SubscriptionEventType.EXPIRED]: X,
  [SubscriptionEventType.PAYMENT_FAILED]: AlertTriangle,
};

const EVENT_LABELS: Record<string, string> = {
  [SubscriptionEventType.CREATED]: "Subscription created",
  [SubscriptionEventType.ACTIVATED]: "Subscription activated",
  [SubscriptionEventType.TRIAL_STARTED]: "Trial started",
  [SubscriptionEventType.TRIAL_ENDED]: "Trial ended",
  [SubscriptionEventType.RENEWED]: "Subscription renewed",
  [SubscriptionEventType.UPGRADED]: "Plan upgraded",
  [SubscriptionEventType.DOWNGRADED]: "Plan downgraded",
  [SubscriptionEventType.PAUSED]: "Subscription paused",
  [SubscriptionEventType.RESUMED]: "Subscription resumed",
  [SubscriptionEventType.CANCELLED]: "Subscription cancelled",
  [SubscriptionEventType.EXPIRED]: "Subscription expired",
  [SubscriptionEventType.PAYMENT_FAILED]: "Payment failed",
};

// ── Change Plan Modal ────────────────────────────────────────────────────

function ChangePlanModal({
  open,
  onClose,
  currentPlanId,
  currentCurrency,
  currentPrice,
  subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  currentPlanId: string;
  currentCurrency: string;
  currentPrice: number;
  subscriptionId: string;
}) {
  const { data: plansRes, isLoading } = usePortalPlans();
  const changePlan = usePortalChangePlan();

  const plans = (plansRes?.data ?? []) as Plan[];

  const handleChangePlan = async (newPlanId: string) => {
    await changePlan.mutateAsync({ subscriptionId, newPlanId });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Plan" size="2xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" className="text-brand-600" />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          No plans available at this time.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const priceDiff = plan.price - currentPrice;
            const diffLabel =
              priceDiff > 0
                ? `+${formatMoney(priceDiff, plan.currency)}`
                : priceDiff < 0
                ? `-${formatMoney(Math.abs(priceDiff), plan.currency)}`
                : null;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${
                  isCurrent
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {/* Plan header */}
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                  {isCurrent && (
                    <Badge variant="purple" size="sm">
                      Current
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatMoney(plan.price, plan.currency)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {INTERVAL_LABELS[plan.billingInterval] || ""}
                  </span>
                  {!isCurrent && diffLabel && (
                    <p
                      className={`text-xs font-medium mt-1 ${
                        priceDiff > 0 ? "text-amber-600" : "text-green-600"
                      }`}
                    >
                      {diffLabel}
                      {INTERVAL_LABELS[plan.billingInterval] || ""}
                    </p>
                  )}
                </div>

                {/* Features */}
                {plan.features && plan.features.length > 0 && (
                  <ul className="space-y-1.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Action */}
                {isCurrent ? (
                  <p className="text-xs text-center text-brand-600 font-medium py-2">
                    Your current plan
                  </p>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    loading={changePlan.isPending}
                    disabled={changePlan.isPending}
                    onClick={() => handleChangePlan(plan.id)}
                  >
                    Switch to this plan
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Cancel Modal ─────────────────────────────────────────────────────────

function CancelModal({
  open,
  onClose,
  subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
}) {
  const [reason, setReason] = useState("");
  const cancelSubscription = usePortalCancelSubscription();

  const handleCancel = async () => {
    await cancelSubscription.mutateAsync({
      subscriptionId,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Cancel Subscription" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-100 p-3">
          <p className="text-sm text-red-700">
            Your subscription will remain active until the end of the current billing period.
            After that, it will not renew.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for cancellation (optional)
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            rows={3}
            placeholder="Tell us why you're cancelling..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Keep Subscription
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={cancelSubscription.isPending}
            disabled={cancelSubscription.isPending}
            onClick={handleCancel}
          >
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Event Timeline ───────────────────────────────────────────────────────

function EventTimeline({ events }: { events: SubscriptionEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Subscription History</h3>
      <div className="space-y-0">
        {events.map((event, idx) => {
          const Icon = EVENT_ICONS[event.eventType] ?? Clock;
          const label = EVENT_LABELS[event.eventType] ?? event.eventType;
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="flex gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-gray-500" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
              </div>

              {/* Content */}
              <div className={`pb-4 ${isLast ? "" : ""}`}>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">
                  {dayjs(event.createdAt).format("DD MMM YYYY, h:mm A")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export function PortalSubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: res, isLoading } = usePortalSubscription(id ?? "");

  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    );
  }

  const sub = res?.data as
    | (Subscription & { plan?: Plan; events?: SubscriptionEvent[] })
    | undefined;

  if (!sub) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">Subscription not found</p>
      </div>
    );
  }

  const plan = sub.plan;
  const events = (sub.events ?? []) as SubscriptionEvent[];
  const canManage = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(
    sub.status as SubscriptionStatus
  );

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/portal/subscriptions")}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Repeat className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">
          {plan?.name ?? "Subscription"} Details
        </h1>
        <SubscriptionStatusBadge status={sub.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current plan card */}
          {plan && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Current Plan
              </h3>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">{plan.name}</p>
                  {plan.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatMoney(plan.price, plan.currency)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {INTERVAL_FULL_LABELS[plan.billingInterval] || plan.billingInterval}
                  </p>
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Period info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Billing Details
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {sub.currentPeriodStart && (
                <div>
                  <p className="text-gray-500">Period start</p>
                  <p className="font-medium text-gray-900">
                    {dayjs(sub.currentPeriodStart).format("DD MMM YYYY")}
                  </p>
                </div>
              )}
              {sub.currentPeriodEnd && (
                <div>
                  <p className="text-gray-500">Period end</p>
                  <p className="font-medium text-gray-900">
                    {dayjs(sub.currentPeriodEnd).format("DD MMM YYYY")}
                  </p>
                </div>
              )}
              {sub.nextBillingDate && (
                <div>
                  <p className="text-gray-500">Next billing</p>
                  <p className="font-medium text-gray-900">
                    {dayjs(sub.nextBillingDate).format("DD MMM YYYY")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Auto-renew</p>
                <p className="font-medium text-gray-900">{sub.autoRenew ? "Yes" : "No"}</p>
              </div>
              {sub.quantity > 1 && (
                <div>
                  <p className="text-gray-500">Quantity</p>
                  <p className="font-medium text-gray-900">{sub.quantity}</p>
                </div>
              )}
              {sub.trialEnd && (
                <div>
                  <p className="text-gray-500">Trial ends</p>
                  <p className="font-medium text-gray-900">
                    {dayjs(sub.trialEnd).format("DD MMM YYYY")}
                  </p>
                </div>
              )}
              {sub.cancelReason && (
                <div className="sm:col-span-2">
                  <p className="text-gray-500">Cancel reason</p>
                  <p className="font-medium text-gray-900">{sub.cancelReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Event timeline */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <EventTimeline events={events} />
          </div>
        </div>

        {/* Right column: actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Actions
            </h3>

            {canManage ? (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowChangePlan(true)}
                  icon={<Repeat className="h-3.5 w-3.5" />}
                >
                  Change Plan
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowCancel(true)}
                  icon={<Ban className="h-3.5 w-3.5" />}
                >
                  Cancel Subscription
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No actions available for this subscription status.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showChangePlan && plan && (
        <ChangePlanModal
          open={showChangePlan}
          onClose={() => setShowChangePlan(false)}
          currentPlanId={sub.planId}
          currentCurrency={plan.currency}
          currentPrice={plan.price}
          subscriptionId={sub.id}
        />
      )}

      {showCancel && (
        <CancelModal
          open={showCancel}
          onClose={() => setShowCancel(false)}
          subscriptionId={sub.id}
        />
      )}
    </div>
  );
}
