import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { Shuffle } from "lucide-react";
import { CouponType, CouponAppliesTo } from "@emp-billing/shared";
import { useCreateCoupon } from "@/api/hooks/coupon.hooks";
import { useProducts } from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { Input, Select } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";

const FormSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(100),
  type: z.nativeEnum(CouponType),
  value: z.coerce.number().positive("Value must be positive"),
  currency: z.string().length(3).optional(),
  appliesTo: z.nativeEnum(CouponAppliesTo).default(CouponAppliesTo.INVOICE),
  productId: z.string().optional(),
  maxRedemptions: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxRedemptionsPerClient: z.coerce.number().int().positive().optional().or(z.literal("")),
  minAmount: z.coerce.number().min(0).default(0),
  validFrom: z.string().min(1, "Valid from is required"),
  validUntil: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function CouponCreatePage() {
  const navigate = useNavigate();
  const createCoupon = useCreateCoupon();
  const { data: productsData } = useProducts();
  const products = productsData?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: CouponType.PERCENTAGE,
      value: 10,
      appliesTo: CouponAppliesTo.INVOICE,
      minAmount: 0,
      validFrom: dayjs().format("YYYY-MM-DD"),
      validUntil: "",
    },
  });

  const couponType = watch("type");
  const appliesTo = watch("appliesTo");

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      code: values.code.toUpperCase(),
      // Convert minAmount from display units to paise
      minAmount: Math.round((values.minAmount || 0) * 100),
      // For fixed_amount type, convert value from display units to paise
      value: values.type === CouponType.FIXED_AMOUNT
        ? Math.round(values.value * 100)
        : Math.round(values.value),
      maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : undefined,
      maxRedemptionsPerClient: values.maxRedemptionsPerClient ? Number(values.maxRedemptionsPerClient) : undefined,
      validUntil: values.validUntil || undefined,
      productId: values.productId || undefined,
    };

    createCoupon.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/coupons"),
    });
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="New Coupon"
        breadcrumb={[
          { label: "Coupons", href: "/coupons" },
          { label: "New Coupon" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Coupon Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SUMMER20"
                  className="flex-1 rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase font-mono"
                  {...register("code")}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  onClick={() => setValue("code", generateCode())}
                  title="Auto-generate code"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
              </div>
              {errors.code?.message && (
                <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>
              )}
            </div>

            <Input
              label="Name"
              required
              placeholder="Summer Sale 20% Off"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>
        </section>

        {/* Discount */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Discount</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Type"
              required
              error={errors.type?.message}
              {...register("type")}
            >
              <option value={CouponType.PERCENTAGE}>Percentage</option>
              <option value={CouponType.FIXED_AMOUNT}>Fixed Amount</option>
            </Select>

            <Input
              label={couponType === CouponType.PERCENTAGE ? "Percentage (%)" : "Amount"}
              required
              type="number"
              step={couponType === CouponType.PERCENTAGE ? "1" : "0.01"}
              min="0"
              max={couponType === CouponType.PERCENTAGE ? "100" : undefined}
              placeholder={couponType === CouponType.PERCENTAGE ? "20" : "500.00"}
              prefix={couponType === CouponType.FIXED_AMOUNT ? "₹" : undefined}
              error={errors.value?.message}
              {...register("value", { valueAsNumber: true })}
            />

            {couponType === CouponType.FIXED_AMOUNT && (
              <Select
                label="Currency"
                {...register("currency")}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            )}
          </div>
        </section>

        {/* Scope */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Scope</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Applies To"
              error={errors.appliesTo?.message}
              {...register("appliesTo")}
            >
              <option value={CouponAppliesTo.INVOICE}>Invoice</option>
              <option value={CouponAppliesTo.SUBSCRIPTION}>Subscription</option>
              <option value={CouponAppliesTo.PRODUCT}>Specific Product</option>
            </Select>

            {appliesTo === CouponAppliesTo.PRODUCT && (
              <Select
                label="Product"
                error={errors.productId?.message}
                {...register("productId")}
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
          </div>
        </section>

        {/* Limits */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Limits & Validity</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Max Redemptions"
              type="number"
              min="1"
              placeholder="Unlimited"
              hint="Leave empty for unlimited"
              error={errors.maxRedemptions?.message}
              {...register("maxRedemptions")}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Redemptions Per Client
              </label>
              <Input
                type="number"
                {...register("maxRedemptionsPerClient", { valueAsNumber: true })}
                placeholder="Unlimited"
                min={1}
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty for unlimited per-client usage</p>
            </div>
            <Input
              label="Minimum Amount"
              type="number"
              step="0.01"
              min="0"
              prefix="₹"
              placeholder="0.00"
              hint="Minimum invoice amount to apply"
              error={errors.minAmount?.message}
              {...register("minAmount", { valueAsNumber: true })}
            />
            <Input
              label="Valid From"
              type="date"
              required
              error={errors.validFrom?.message}
              {...register("validFrom")}
            />
            <Input
              label="Valid Until"
              type="date"
              hint="Leave empty for no expiry"
              error={errors.validUntil?.message}
              {...register("validUntil")}
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={isSubmitting || createCoupon.isPending}
          >
            Create Coupon
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/coupons")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
