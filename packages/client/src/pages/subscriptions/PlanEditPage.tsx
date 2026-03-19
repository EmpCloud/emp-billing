import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { BillingInterval } from "@emp-billing/shared";
import { usePlan, useUpdatePlan } from "@/api/hooks/subscription.hooks";
import { Button } from "@/components/common/Button";
import { Input, Textarea, Select } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const INTERVAL_OPTIONS = [
  { value: BillingInterval.MONTHLY, label: "Monthly" },
  { value: BillingInterval.QUARTERLY, label: "Quarterly" },
  { value: BillingInterval.SEMI_ANNUAL, label: "Semi-Annual" },
  { value: BillingInterval.ANNUAL, label: "Annual" },
  { value: BillingInterval.CUSTOM, label: "Custom" },
];

export function PlanEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePlan(id!);
  const updatePlan = useUpdatePlan(id!);

  const plan = data?.data;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(BillingInterval.MONTHLY);
  const [billingIntervalDays, setBillingIntervalDays] = useState("");
  const [price, setPrice] = useState("");
  const [setupFee, setSetupFee] = useState("");
  const [trialPeriodDays, setTrialPeriodDays] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setBillingInterval(plan.billingInterval);
      setBillingIntervalDays(plan.billingIntervalDays?.toString() ?? "");
      setPrice((plan.price / 100).toFixed(2));
      setSetupFee((plan.setupFee / 100).toFixed(2));
      setTrialPeriodDays(plan.trialPeriodDays.toString());
      setCurrency(plan.currency);
      setFeatures(plan.features ?? []);
      setSortOrder(plan.sortOrder.toString());
    }
  }, [plan]);

  function addFeature() {
    const trimmed = featureInput.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed]);
      setFeatureInput("");
    }
  }

  function removeFeature(index: number) {
    setFeatures(features.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updatePlan.mutate({
      name,
      description: description || undefined,
      billingInterval,
      billingIntervalDays: billingInterval === BillingInterval.CUSTOM ? parseInt(billingIntervalDays) : undefined,
      price: Math.round(parseFloat(price) * 100),
      setupFee: setupFee ? Math.round(parseFloat(setupFee) * 100) : 0,
      trialPeriodDays: trialPeriodDays ? parseInt(trialPeriodDays) : 0,
      currency,
      features,
      sortOrder: parseInt(sortOrder) || 0,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Edit Plan"
        subtitle={plan?.name ?? ""}
        breadcrumb={[
          { label: "Plans", href: "/subscriptions/plans" },
          { label: "Edit" },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <Input
            label="Plan Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Starter, Professional, Enterprise"
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this plan"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Billing Interval"
              required
              value={billingInterval}
              onChange={(e) => setBillingInterval(e.target.value as BillingInterval)}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>

            {billingInterval === BillingInterval.CUSTOM && (
              <Input
                label="Custom Interval (days)"
                type="number"
                required
                min="1"
                value={billingIntervalDays}
                onChange={(e) => setBillingIntervalDays(e.target.value)}
                placeholder="e.g. 45"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              hint="Enter in major currency units (e.g. rupees, dollars)"
            />

            <Input
              label="Setup Fee"
              type="number"
              min="0"
              step="0.01"
              value={setupFee}
              onChange={(e) => setSetupFee(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Trial Period (days)"
              type="number"
              min="0"
              value={trialPeriodDays}
              onChange={(e) => setTrialPeriodDays(e.target.value)}
              placeholder="0"
            />

            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </Select>
          </div>

          <Input
            label="Sort Order"
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Features</h3>
          <div className="flex items-center gap-2">
            <Input
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              placeholder="Add a feature..."
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={addFeature} icon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          </div>
          {features.length > 0 && (
            <ul className="space-y-1.5">
              {features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                  <span className="flex-1">{feature}</span>
                  <button
                    type="button"
                    onClick={() => removeFeature(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={updatePlan.isPending}>
            Update Plan
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/subscriptions/plans")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
