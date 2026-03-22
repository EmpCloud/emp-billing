import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { Save, ArrowLeft } from "lucide-react";
import { CouponType, CouponAppliesTo } from "@emp-billing/shared";
import { useCoupon, useUpdateCoupon } from "@/api/hooks/coupon.hooks";
import { useProducts } from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { Input, Select } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

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

export function CouponEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: couponData, isLoading } = useCoupon(id!);
  const updateCoupon = useUpdateCoupon(id!);
  const { data: productsData } = useProducts();

  const coupon = couponData?.data;
  const products = productsData?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: CouponType.PERCENTAGE,
      value: 0,
      appliesTo: CouponAppliesTo.INVOICE,
      minAmount: 0,
      validFrom: "",
      validUntil: "",
    },
  });

  const couponType = watch("type");
  const appliesTo = watch("appliesTo");

  useEffect(() => {
    if (!coupon) return;
    reset({
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.type === CouponType.FIXED_AMOUNT ? coupon.value / 100 : coupon.value,
      currency: coupon.currency ?? "INR",
      appliesTo: coupon.appliesTo,
      productId: coupon.productId ?? "",
      maxRedemptions: coupon.maxRedemptions ?? ("" as any),
      maxRedemptionsPerClient: coupon.maxRedemptionsPerClient ?? ("" as any),
      minAmount: (coupon.minAmount ?? 0) / 100,
      validFrom: dayjs(coupon.validFrom).format("YYYY-MM-DD"),
      validUntil: coupon.validUntil ? dayjs(coupon.validUntil).format("YYYY-MM-DD") : "",
    });
  }, [coupon, reset]);

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      code: values.code.toUpperCase(),
      minAmount: Math.round((values.minAmount || 0) * 100),
      value: values.type === CouponType.FIXED_AMOUNT
        ? Math.round(values.value * 100)
        : Math.round(values.value),
      maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : null,
      maxRedemptionsPerClient: values.maxRedemptionsPerClient ? Number(values.maxRedemptionsPerClient) : null,
      validUntil: values.validUntil || undefined,
      productId: values.productId || undefined,
    };

    updateCoupon.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/coupons"),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="p-6 max-w-3xl">
        <PageHeader
          title="Coupon Not Found"
          breadcrumb={[{ label: "Coupons", href: "/coupons" }, { label: "Not Found" }]}
        />
        <p className="text-sm text-gray-500">
          The coupon you are looking for does not exist.
        </p>
        <Button
          variant="outline"
          icon={<ArrowLeft className="h-4 w-4" />}
          className="mt-4"
          onClick={() => navigate("/coupons")}
        >
          Back to Coupons
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Edit Coupon"
        breadcrumb={[
          { label: "Coupons", href: "/coupons" },
          { label: "Edit Coupon" },
        ]}
        actions={
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/coupons")}
          >
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Coupon Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Code"
              required
              placeholder="SUMMER20"
              className="uppercase font-mono"
              error={errors.code?.message}
              {...register("code")}
            />
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
              prefix={couponType === CouponType.FIXED_AMOUNT ? "₹" : undefined}
              error={errors.value?.message}
              {...register("value", { valueAsNumber: true })}
            />
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
                {...register("maxRedemptionsPerClient")}
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
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateCoupon.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/coupons")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
