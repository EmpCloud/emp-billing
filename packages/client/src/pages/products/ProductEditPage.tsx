import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { PricingModel } from "@emp-billing/shared";
import type { PricingTier } from "@emp-billing/shared";
import { useProduct, useUpdateProduct, useTaxRates } from "@/api/hooks/product.hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { Input, Select, Textarea } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";

const FormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  sku: z.string().optional(),
  hsnCode: z.string().optional(),
  type: z.enum(["goods", "service"]).default("service"),
  unit: z.string().optional(),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
  pricingModel: z.nativeEnum(PricingModel).default(PricingModel.FLAT),
  taxRateId: z.string().optional(),
  trackInventory: z.boolean().default(false),
  stockOnHand: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface TierRow {
  upTo: string;
  unitPrice: string;
  flatFee: string;
}

const PRODUCT_TYPES = [
  { value: "goods", label: "Goods" },
  { value: "service", label: "Service" },
];

const UNITS = [
  { value: "", label: "None" },
  { value: "hrs", label: "Hours" },
  { value: "units", label: "Units" },
  { value: "kg", label: "Kilograms" },
  { value: "pcs", label: "Pieces" },
  { value: "mi", label: "Miles" },
  { value: "km", label: "Kilometers" },
  { value: "ltr", label: "Litres" },
  { value: "box", label: "Boxes" },
];

const PRICING_MODELS = [
  { value: PricingModel.FLAT, label: "Flat Rate" },
  { value: PricingModel.TIERED, label: "Tiered" },
  { value: PricingModel.VOLUME, label: "Volume" },
  { value: PricingModel.PER_SEAT, label: "Per-Seat" },
  { value: PricingModel.METERED, label: "Metered" },
];

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: productData, isLoading } = useProduct(id!);
  const updateProduct = useUpdateProduct(id!);
  const { data: taxRatesData } = useTaxRates();

  const product = productData?.data;
  const taxRates = taxRatesData?.data ?? [];

  const [tiers, setTiers] = useState<TierRow[]>([
    { upTo: "100", unitPrice: "0", flatFee: "" },
    { upTo: "", unitPrice: "0", flatFee: "" },
  ]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      hsnCode: "",
      type: "service",
      unit: "",
      rate: 0,
      pricingModel: PricingModel.FLAT,
      taxRateId: "",
      trackInventory: false,
      stockOnHand: 0,
      reorderLevel: 0,
    },
  });

  const trackInventory = watch("trackInventory");
  const pricingModel = watch("pricingModel");
  const showTiers = pricingModel === PricingModel.TIERED || pricingModel === PricingModel.VOLUME || pricingModel === PricingModel.METERED;

  useEffect(() => {
    if (!product) return;
    reset({
      name: product.name ?? "",
      description: product.description ?? "",
      sku: product.sku ?? "",
      hsnCode: product.hsnCode ?? "",
      type: product.type ?? "service",
      unit: product.unit ?? "",
      rate: (product.rate ?? 0) / 100,
      pricingModel: product.pricingModel ?? PricingModel.FLAT,
      taxRateId: product.taxRateId ?? "",
      trackInventory: product.trackInventory ?? false,
      stockOnHand: product.stockOnHand ?? 0,
      reorderLevel: product.reorderLevel ?? 0,
    });

    // Populate tiers from product data
    if (product.pricingTiers && product.pricingTiers.length > 0) {
      setTiers(
        product.pricingTiers.map((t: PricingTier) => ({
          upTo: t.upTo !== null ? String(t.upTo) : "",
          unitPrice: String((t.unitPrice ?? 0) / 100),
          flatFee: t.flatFee ? String(t.flatFee / 100) : "",
        }))
      );
    }
  }, [product, reset]);

  function addTier() {
    setTiers([...tiers, { upTo: "", unitPrice: "0", flatFee: "" }]);
  }

  function removeTier(idx: number) {
    setTiers(tiers.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, field: keyof TierRow, value: string) {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setTiers(updated);
  }

  function onSubmit(values: FormValues) {
    const pricingTiers = showTiers
      ? tiers.map((t) => ({
          upTo: t.upTo === "" || t.upTo === null ? null : parseInt(t.upTo),
          unitPrice: Math.round(parseFloat(t.unitPrice || "0") * 100),
          ...(t.flatFee ? { flatFee: Math.round(parseFloat(t.flatFee) * 100) } : {}),
        }))
      : undefined;

    const payload = {
      ...values,
      rate: Math.round(values.rate * 100),
      pricingTiers,
      // Don't send empty string — server expects UUID or undefined
      taxRateId: values.taxRateId || undefined,
    };

    updateProduct.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/products"),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 max-w-3xl">
        <PageHeader
          title="Product Not Found"
          breadcrumb={[{ label: "Products", href: "/products" }, { label: "Not Found" }]}
        />
        <p className="text-sm text-gray-500">
          The product you are looking for does not exist or has been deleted.
        </p>
        <Button
          variant="outline"
          icon={<ArrowLeft className="h-4 w-4" />}
          className="mt-4"
          onClick={() => navigate("/products")}
        >
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Edit Product"
        breadcrumb={[{ label: "Products", href: "/products" }, { label: "Edit Product" }]}
        actions={
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/products")}
          >
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              required
              placeholder="Web Development"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="SKU"
              placeholder="WEB-DEV-001"
              error={errors.sku?.message}
              {...register("sku")}
            />
            <Input
              label="HSN/SAC Code"
              placeholder="998314"
              error={errors.hsnCode?.message}
              {...register("hsnCode")}
            />
            <Select
              label="Type"
              required
              error={errors.type?.message}
              {...register("type")}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select
              label="Unit"
              error={errors.unit?.message}
              {...register("unit")}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Description"
            rows={3}
            placeholder="Describe this product or service..."
            error={errors.description?.message}
            {...register("description")}
          />
        </section>

        {/* Pricing & Tax */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Pricing & Tax</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Pricing Model"
              required
              error={errors.pricingModel?.message}
              {...register("pricingModel")}
            >
              {PRICING_MODELS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </Select>
            <Input
              label="Base Rate"
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              prefix="₹"
              hint="Enter amount in rupees (will be stored in paise)"
              error={errors.rate?.message}
              {...register("rate", { valueAsNumber: true })}
            />
            <Select
              label="Tax Rate"
              error={errors.taxRateId?.message}
              {...register("taxRateId")}
            >
              <option value="">No Tax</option>
              {taxRates.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({tr.rate}%)
                </option>
              ))}
            </Select>
          </div>

          {/* Tier Editor */}
          {showTiers && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">
                Pricing Tiers
              </h3>
              <p className="text-xs text-gray-500">
                {pricingModel === PricingModel.TIERED
                  ? "Each tier is priced independently. Units in each bracket use that tier's rate."
                  : pricingModel === PricingModel.VOLUME
                    ? "Total quantity determines a single rate applied to ALL units."
                    : "Define tiers for metered usage billing."}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-3 pb-2 font-medium text-gray-500">Up To (units)</th>
                      <th className="px-3 pb-2 font-medium text-gray-500">Unit Price (₹)</th>
                      <th className="px-3 pb-2 font-medium text-gray-500">Flat Fee (₹)</th>
                      <th className="px-3 pb-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min="0"
                            placeholder={idx === tiers.length - 1 ? "Unlimited" : "100"}
                            className="w-full rounded-lg border border-gray-300 bg-white text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={tier.upTo}
                            onChange={(e) => updateTier(idx, "upTo", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full rounded-lg border border-gray-300 bg-white text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={tier.unitPrice}
                            onChange={(e) => updateTier(idx, "unitPrice", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full rounded-lg border border-gray-300 bg-white text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={tier.flatFee}
                            onChange={(e) => updateTier(idx, "flatFee", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {tiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTier(idx)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={addTier}
              >
                Add Tier
              </Button>
            </div>
          )}
        </section>

        {/* Inventory */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Inventory</h2>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="trackInventory"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...register("trackInventory")}
            />
            <label
              htmlFor="trackInventory"
              className="text-sm font-medium text-gray-700"
            >
              Track inventory for this item
            </label>
          </div>

          {trackInventory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Stock on Hand"
                type="number"
                min="0"
                placeholder="0"
                error={errors.stockOnHand?.message}
                {...register("stockOnHand", { valueAsNumber: true })}
              />
              <Input
                label="Reorder Level"
                type="number"
                min="0"
                placeholder="0"
                hint="Alert when stock falls below this level"
                error={errors.reorderLevel?.message}
                {...register("reorderLevel", { valueAsNumber: true })}
              />
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateProduct.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
