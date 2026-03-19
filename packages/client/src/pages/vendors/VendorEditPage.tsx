import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateVendorSchema } from "@emp-billing/shared";
import { useVendor, useUpdateVendor } from "@/api/hooks/vendor.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { ArrowLeft, Save } from "lucide-react";

type FormValues = z.infer<typeof CreateVendorSchema>;

export function VendorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: vendorData, isLoading } = useVendor(id!);
  const updateVendor = useUpdateVendor(id!);

  const vendor = vendorData?.data;

  const {
    register,
    handleSubmit,
    reset,
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

  useEffect(() => {
    if (!vendor) return;
    reset({
      name: vendor.name ?? "",
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      company: vendor.company ?? "",
      addressLine1: vendor.addressLine1 ?? "",
      addressLine2: vendor.addressLine2 ?? "",
      city: vendor.city ?? "",
      state: vendor.state ?? "",
      postalCode: vendor.postalCode ?? "",
      country: vendor.country ?? "",
      taxId: vendor.taxId ?? "",
      notes: vendor.notes ?? "",
    });
  }, [vendor, reset]);

  function onSubmit(values: FormValues) {
    updateVendor.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => navigate(`/vendors/${id}`),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-6 max-w-3xl">
        <PageHeader
          title="Vendor Not Found"
          breadcrumb={[{ label: "Vendors", href: "/vendors" }, { label: "Not Found" }]}
        />
        <p className="text-sm text-gray-500">
          The vendor you are looking for does not exist or has been deleted.
        </p>
        <Button
          variant="outline"
          icon={<ArrowLeft className="h-4 w-4" />}
          className="mt-4"
          onClick={() => navigate("/vendors")}
        >
          Back to Vendors
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Edit Vendor"
        breadcrumb={[{ label: "Vendors", href: "/vendors" }, { label: vendor.name, href: `/vendors/${id}` }, { label: "Edit" }]}
        actions={
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/vendors/${id}`)}
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
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateVendor.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/vendors/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
