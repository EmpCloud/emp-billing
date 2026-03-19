import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRightLeft, Pause, Play, XCircle, Clock,
  Calendar, CreditCard, Hash, RefreshCw, Tag,
} from "lucide-react";
import dayjs from "dayjs";
import { SubscriptionStatus, SubscriptionEventType, BillingInterval } from "@emp-billing/shared";
import {
  useSubscription,
  useChangePlan,
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
  usePlans,
} from "@/api/hooks/subscription.hooks";
import {
  useApplyCouponToSubscription,
  useRemoveCouponFromSubscription,
} from "@/api/hooks/coupon.hooks";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import { Input, Select, Textarea } from "@/components/common/Input";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray" }> = {
  [SubscriptionStatus.TRIALING]:  { label: "Trialing",  variant: "purple" },
  [SubscriptionStatus.ACTIVE]:    { label: "Active",    variant: "success" },
  [SubscriptionStatus.PAUSED]:    { label: "Paused",    variant: "warning" },
  [SubscriptionStatus.PAST_DUE]:  { label: "Past Due",  variant: "danger" },
  [SubscriptionStatus.CANCELLED]: { label: "Cancelled", variant: "gray" },
  [SubscriptionStatus.EXPIRED]:   { label: "Expired",   variant: "gray" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  [SubscriptionEventType.CREATED]: "Created",
  [SubscriptionEventType.ACTIVATED]: "Activated",
  [SubscriptionEventType.TRIAL_STARTED]: "Trial Started",
  [SubscriptionEventType.TRIAL_ENDED]: "Trial Ended",
  [SubscriptionEventType.RENEWED]: "Renewed",
  [SubscriptionEventType.UPGRADED]: "Upgraded",
  [SubscriptionEventType.DOWNGRADED]: "Downgraded",
  [SubscriptionEventType.PAUSED]: "Paused",
  [SubscriptionEventType.RESUMED]: "Resumed",
  [SubscriptionEventType.CANCELLED]: "Cancelled",
  [SubscriptionEventType.EXPIRED]: "Expired",
  [SubscriptionEventType.PAYMENT_FAILED]: "Payment Failed",
};

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

function SubscriptionStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant} size="md">{cfg.label}</Badge>;
}

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useSubscription(id!);
  const { data: plansData } = usePlans();
  const changePlan = useChangePlan(id!);
  const cancelSubscription = useCancelSubscription(id!);
  const pauseSubscription = usePauseSubscription();
  const resumeSubscription = useResumeSubscription();
  const applyCouponToSub = useApplyCouponToSubscription();
  const removeCouponFromSub = useRemoveCouponFromSubscription();

  const subscription = data?.data;
  const plan = (subscription as any)?.plan;
  const events = (subscription as any)?.events ?? [];
  const allPlans = plansData?.data ?? [];

  // Modal states
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Change plan form
  const [newPlanId, setNewPlanId] = useState("");
  const [prorate, setProrate] = useState(false);

  // Cancel form
  const [cancelReason, setCancelReason] = useState("");
  const [cancelImmediately, setCancelImmediately] = useState(false);

  // Coupon form
  const [couponCode, setCouponCode] = useState("");

  function handleChangePlan() {
    if (!newPlanId) return;
    changePlan.mutate(
      { newPlanId, prorate },
      { onSuccess: () => setChangePlanOpen(false) }
    );
  }

  function handleCancel() {
    cancelSubscription.mutate(
      { reason: cancelReason || undefined, cancelImmediately },
      { onSuccess: () => setCancelOpen(false) }
    );
  }

  function handleApplyCoupon() {
    if (!couponCode.trim() || !subscription) return;
    applyCouponToSub.mutate(
      { code: couponCode.trim(), subscriptionId: subscription.id, clientId: subscription.clientId },
      { onSuccess: () => setCouponCode("") }
    );
  }

  function handleRemoveCoupon() {
    if (!subscription) return;
    removeCouponFromSub.mutate(subscription.id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6">
        <div className="text-center py-16 text-gray-500">Subscription not found</div>
      </div>
    );
  }

  const isActionable = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAUSED].includes(subscription.status);

  return (
    <div className="p-6">
      <PageHeader
        title="Subscription Detail"
        breadcrumb={[
          { label: "Subscriptions", href: "/subscriptions" },
          { label: subscription.id.slice(0, 8) },
        ]}
        actions={
          isActionable ? (
            <div className="flex items-center gap-2">
              {(subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING) && (
                <Button
                  variant="outline"
                  icon={<ArrowRightLeft className="h-4 w-4" />}
                  onClick={() => { setNewPlanId(""); setProrate(false); setChangePlanOpen(true); }}
                >
                  Change Plan
                </Button>
              )}
              {subscription.status === SubscriptionStatus.ACTIVE && (
                <Button
                  variant="outline"
                  icon={<Pause className="h-4 w-4" />}
                  loading={pauseSubscription.isPending}
                  onClick={() => pauseSubscription.mutate(subscription.id)}
                >
                  Pause
                </Button>
              )}
              {subscription.status === SubscriptionStatus.PAUSED && (
                <Button
                  variant="outline"
                  icon={<Play className="h-4 w-4" />}
                  loading={resumeSubscription.isPending}
                  onClick={() => resumeSubscription.mutate(subscription.id)}
                >
                  Resume
                </Button>
              )}
              <Button
                variant="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => { setCancelReason(""); setCancelImmediately(false); setCancelOpen(true); }}
              >
                Cancel
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription info card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <SubscriptionStatusBadge status={subscription.status} />
              {!subscription.autoRenew && subscription.status !== SubscriptionStatus.CANCELLED && (
                <Badge variant="warning">Auto-renew off</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoItem icon={<Hash className="h-4 w-4" />} label="Subscription ID" value={subscription.id.slice(0, 8)} />
              <InfoItem icon={<CreditCard className="h-4 w-4" />} label="Client" value={subscription.clientId.slice(0, 8)} />
              <InfoItem icon={<RefreshCw className="h-4 w-4" />} label="Quantity" value={subscription.quantity.toString()} />
              <InfoItem
                icon={<Calendar className="h-4 w-4" />}
                label="Next Billing"
                value={dayjs(subscription.nextBillingDate).format("DD MMM YYYY")}
              />
              {subscription.currentPeriodStart && (
                <InfoItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Current Period"
                  value={`${dayjs(subscription.currentPeriodStart).format("DD MMM")} - ${dayjs(subscription.currentPeriodEnd).format("DD MMM YYYY")}`}
                />
              )}
              {subscription.trialEnd && (
                <InfoItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Trial End"
                  value={dayjs(subscription.trialEnd).format("DD MMM YYYY")}
                />
              )}
              {subscription.cancelledAt && (
                <InfoItem
                  icon={<XCircle className="h-4 w-4" />}
                  label="Cancelled At"
                  value={dayjs(subscription.cancelledAt).format("DD MMM YYYY")}
                />
              )}
              {subscription.cancelReason && (
                <div className="col-span-full">
                  <InfoItem icon={<XCircle className="h-4 w-4" />} label="Cancel Reason" value={subscription.cancelReason} />
                </div>
              )}
            </div>
          </div>

          {/* Plan info card */}
          {plan && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Plan Details</h3>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{plan.name}</div>
                  {plan.description && <div className="text-sm text-gray-500 mt-1">{plan.description}</div>}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatMoney(plan.price, plan.currency)}
                  </div>
                  <div className="text-sm text-gray-500">
                    / {INTERVAL_LABELS[plan.billingInterval] ?? plan.billingInterval}
                  </div>
                </div>
              </div>
              {plan.features && plan.features.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <ul className="grid grid-cols-2 gap-2">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — event timeline + coupon */}
        <div className="space-y-6">
          {/* Coupon card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Coupon
            </h3>
            {subscription.couponId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Coupon ID</div>
                    <div className="text-sm font-medium text-gray-700">{subscription.couponId.slice(0, 8)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Discount per cycle</div>
                    <div className="text-sm font-semibold text-green-600">
                      -{formatMoney(subscription.couponDiscountAmount ?? 0, plan?.currency)}
                    </div>
                  </div>
                </div>
                {isActionable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    loading={removeCouponFromSub.isPending}
                    onClick={handleRemoveCoupon}
                  >
                    Remove Coupon
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-400 text-center py-2">No coupon applied</div>
                {isActionable && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                    />
                    <Button
                      size="sm"
                      loading={applyCouponToSub.isPending}
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Event timeline */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Event Timeline</h3>
            {events.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">No events yet</div>
            ) : (
              <div className="space-y-4">
                {events.map((event: any) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 w-2 h-2 bg-brand-500 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700">
                        {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                      </div>
                      <div className="text-xs text-gray-400">
                        {dayjs(event.createdAt).format("DD MMM YYYY, HH:mm")}
                      </div>
                      {event.oldPlanId && event.newPlanId && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Plan changed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Plan Modal */}
      <Modal
        open={changePlanOpen}
        onClose={() => setChangePlanOpen(false)}
        title="Change Plan"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangePlanOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePlan} loading={changePlan.isPending} disabled={!newPlanId}>
              Change Plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="New Plan"
            value={newPlanId}
            onChange={(e) => setNewPlanId(e.target.value)}
          >
            <option value="">Select a plan...</option>
            {allPlans
              .filter((p) => p.id !== subscription.planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - {formatMoney(p.price, p.currency)} / {INTERVAL_LABELS[p.billingInterval] ?? p.billingInterval}
                </option>
              ))}
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prorate}
              onChange={(e) => setProrate(e.target.checked)}
              className="h-4 w-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">
              Prorate — calculate credit/charge for remaining period
            </span>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Subscription"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep Subscription</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelSubscription.isPending}>
              {cancelImmediately ? "Cancel Immediately" : "Cancel at Period End"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this subscription being cancelled?"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cancelImmediately}
              onChange={(e) => setCancelImmediately(e.target.checked)}
              className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <span className="text-sm text-gray-600">
              Cancel immediately (instead of at end of current period)
            </span>
          </div>
          {!cancelImmediately && (
            <p className="text-xs text-gray-500 bg-amber-50 p-3 rounded-lg">
              The subscription will remain active until the end of the current billing period.
              Auto-renew will be turned off and the subscription will expire naturally.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-700">{value}</div>
      </div>
    </div>
  );
}
