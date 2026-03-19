import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BillingInterval } from "@emp-billing/shared";
import { useCreateSubscription, usePlans } from "@/api/hooks/subscription.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input, Select } from "@/components/common/Input";
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

export function SubscriptionCreatePage() {
  const navigate = useNavigate();
  const createSubscription = useCreateSubscription();
  const { data: plansData, isLoading: plansLoading } = usePlans();
  const { data: clientsData, isLoading: clientsLoading } = useClients();

  const plans = plansData?.data ?? [];
  const clients = clientsData?.data ?? [];

  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [autoRenew, setAutoRenew] = useState(true);

  const selectedPlan = plans.find((p) => p.id === planId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createSubscription.mutate({
      clientId,
      planId,
      quantity: parseInt(quantity) || 1,
      autoRenew,
    });
  }

  if (plansLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Create Subscription"
        subtitle="Subscribe a client to a plan"
        breadcrumb={[
          { label: "Subscriptions", href: "/subscriptions" },
          { label: "New Subscription" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <Select
            label="Client"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
            ))}
          </Select>

          <Select
            label="Plan"
            required
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            <option value="">Select a plan...</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {formatMoney(p.price, p.currency)} / {INTERVAL_LABELS[p.billingInterval] ?? p.billingInterval}
              </option>
            ))}
          </Select>

          {/* Selected plan details */}
          {selectedPlan && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-600">
              <div className="font-medium text-gray-900">{selectedPlan.name}</div>
              {selectedPlan.description && <div>{selectedPlan.description}</div>}
              <div>Price: {formatMoney(selectedPlan.price, selectedPlan.currency)} / {INTERVAL_LABELS[selectedPlan.billingInterval]}</div>
              {selectedPlan.setupFee > 0 && (
                <div>Setup Fee: {formatMoney(selectedPlan.setupFee, selectedPlan.currency)} (one-time)</div>
              )}
              {selectedPlan.trialPeriodDays > 0 && (
                <div>Free Trial: {selectedPlan.trialPeriodDays} days</div>
              )}
              {selectedPlan.features && selectedPlan.features.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium text-gray-700 mb-1">Features:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {selectedPlan.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity (seats)"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hint="For per-seat billing"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Auto Renew</label>
              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="h-4 w-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-600">
                  Automatically renew at end of period
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={createSubscription.isPending} disabled={!clientId || !planId}>
            Create Subscription
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/subscriptions")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
