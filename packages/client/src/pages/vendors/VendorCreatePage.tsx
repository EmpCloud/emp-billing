import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateVendorSchema } from "@emp-billing/shared";
import { useCreateVendor } from "@/api/hooks/vendor.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";

type FormValues = z.infer<typeof CreateVendorSchema>;

export function VendorCreatePage() {
  const navigate = useNavigate();
  const createVendor = useCreateVendor();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateVendorSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      taxId: "",
      notes: "",
    },
  });

  function onSubmit(values: FormValues) {
    createVendor.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/vendors"),
    });
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="New Vendor"
        breadcrumb={[{ label: "Vendors", href: "/vendors" }, { label: "New Vendor" }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Vendor Name"
              required
              placeholder="Acme Supplies"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="Company"
              placeholder="Acme Supplies Pvt Ltd"
              error={errors.company?.message}
              {...register("company")}
            />
            <Input
              label="Email"
              type="email"
              placeholder="accounts@vendor.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+91 98765 43210"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>

          <Input
            label="GSTIN / Tax ID"
            placeholder="22AAAAA0000A1Z5"
            error={errors.taxId?.message}
            {...register("taxId")}
          />
        </section>

        {/* Address */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Address</h2>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Address Line 1"
              placeholder="123 Main Street"
              error={errors.addressLine1?.message}
              {...register("addressLine1")}
            />
            <Input
              label="Address Line 2"
              placeholder="Suite 100"
              error={errors.addressLine2?.message}
              {...register("addressLine2")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="City"
                placeholder="Mumbai"
                error={errors.city?.message}
                {...register("city")}
              />
              <Input
                label="State"
                placeholder="Maharashtra"
                error={errors.state?.message}
                {...register("state")}
              />
              <Input
                label="Postal Code"
                placeholder="400001"
                error={errors.postalCode?.message}
                {...register("postalCode")}
              />
              <Input
                label="Country"
                placeholder="India"
                error={errors.country?.message}
                {...register("country")}
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Additional Notes</h2>
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Internal notes about this vendor..."
            error={errors.notes?.message}
            {...register("notes")}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || createVendor.isPending}>
            Create Vendor
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
