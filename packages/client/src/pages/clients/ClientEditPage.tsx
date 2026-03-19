import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateClientSchema } from "@emp-billing/shared";
import { useClient, useUpdateClient } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { TagInput } from "@/components/common/TagInput";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { CustomFieldsEditor } from "@/components/common/CustomFieldsEditor";

type FormValues = z.infer<typeof CreateClientSchema>;

const CURRENCIES = [
  { code: "INR", label: "INR \u2013 Indian Rupee" },
  { code: "USD", label: "USD \u2013 US Dollar" },
  { code: "GBP", label: "GBP \u2013 British Pound" },
  { code: "EUR", label: "EUR \u2013 Euro" },
];

const PAYMENT_TERMS = [
  { days: 0, label: "Due on receipt" },
  { days: 7, label: "Net 7" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
];

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: clientData, isLoading } = useClient(id!);
  const updateClient = useUpdateClient(id!);

  const client = clientData?.data;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateClientSchema),
    defaultValues: {
      currency: "INR",
      paymentTerms: 30,
      contacts: [],
      tags: [],
      portalEnabled: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contacts",
  });

  useEffect(() => {
    if (!client) return;
    reset({
      name: client.name ?? "",
      displayName: client.displayName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      website: client.website ?? "",
      taxId: client.taxId ?? "",
      billingAddress: {
        line1: client.billingAddress?.line1 ?? "",
        line2: client.billingAddress?.line2 ?? "",
        city: client.billingAddress?.city ?? "",
        state: client.billingAddress?.state ?? "",
        postalCode: client.billingAddress?.postalCode ?? "",
        country: client.billingAddress?.country ?? "",
      },
      shippingAddress: client.shippingAddress
        ? {
            line1: client.shippingAddress.line1 ?? "",
            line2: client.shippingAddress.line2 ?? "",
            city: client.shippingAddress.city ?? "",
            state: client.shippingAddress.state ?? "",
            postalCode: client.shippingAddress.postalCode ?? "",
            country: client.shippingAddress.country ?? "",
          }
        : undefined,
      contacts: client.contacts ?? [],
      currency: client.currency ?? "INR",
      paymentTerms: client.paymentTerms ?? 30,
      notes: client.notes ?? "",
      tags: client.tags ?? [],
      portalEnabled: client.portalEnabled ?? false,
      portalEmail: client.portalEmail ?? "",
      customFields: client.customFields ?? {},
    });
  }, [client, reset]);

  function onSubmit(values: FormValues) {
    updateClient.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => navigate(`/clients/${id}`),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 max-w-3xl">
        <PageHeader
          title="Client Not Found"
          breadcrumb={[{ label: "Clients", href: "/clients" }, { label: "Not Found" }]}
        />
        <p className="text-sm text-gray-500">
          The client you are looking for does not exist or has been deleted.
        </p>
        <Button
          variant="outline"
          icon={<ArrowLeft className="h-4 w-4" />}
          className="mt-4"
          onClick={() => navigate("/clients")}
        >
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Edit Client"
        breadcrumb={[{ label: "Clients", href: "/clients" }, { label: client.name, href: `/clients/${id}` }, { label: "Edit" }]}
        actions={
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/clients/${id}`)}
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
              label="Client Name"
              required
              placeholder="Acme Corp"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="Display Name"
              placeholder="Acme"
              error={errors.displayName?.message}
              {...register("displayName")}
            />
            <Input
              label="Email"
              type="email"
              required
              placeholder="billing@acme.com"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Currency"
              error={errors.currency?.message}
              {...register("currency")}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </Select>
            <Select
              label="Payment Terms"
              error={errors.paymentTerms?.message}
              {...register("paymentTerms", { valueAsNumber: true })}
            >
              {PAYMENT_TERMS.map((t) => (
                <option key={t.days} value={t.days}>{t.label}</option>
              ))}
            </Select>
          </div>

          <Input
            label="GSTIN / Tax ID"
            placeholder="22AAAAA0000A1Z5"
            error={errors.taxId?.message}
            {...register("taxId")}
          />
        </section>

        {/* Billing Address */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Billing Address</h2>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Address Line 1"
              placeholder="123 Main Street"
              error={errors.billingAddress?.line1?.message}
              {...register("billingAddress.line1")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="City"
                placeholder="Mumbai"
                error={errors.billingAddress?.city?.message}
                {...register("billingAddress.city")}
              />
              <Input
                label="State"
                placeholder="Maharashtra"
                error={errors.billingAddress?.state?.message}
                {...register("billingAddress.state")}
              />
              <Input
                label="Postal Code"
                placeholder="400001"
                error={errors.billingAddress?.postalCode?.message}
                {...register("billingAddress.postalCode")}
              />
              <Input
                label="Country"
                placeholder="India"
                error={errors.billingAddress?.country?.message}
                {...register("billingAddress.country")}
              />
            </div>
          </div>
        </section>

        {/* Contact Persons */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Contact Persons</h2>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-gray-500">No contacts added yet. Add at least one contact person.</p>
          )}

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Contact {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  required
                  placeholder="John Doe"
                  error={errors.contacts?.[index]?.name?.message}
                  {...register(`contacts.${index}.name`)}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="john@example.com"
                  error={errors.contacts?.[index]?.email?.message}
                  {...register(`contacts.${index}.email`)}
                />
                <Input
                  label="Phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  error={errors.contacts?.[index]?.phone?.message}
                  {...register(`contacts.${index}.phone`)}
                />
                <Input
                  label="Designation"
                  placeholder="Finance Manager"
                  error={errors.contacts?.[index]?.designation?.message}
                  {...register(`contacts.${index}.designation`)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  {...register(`contacts.${index}.isPrimary`)}
                />
                Primary contact
              </label>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() =>
              append({
                name: "",
                email: "",
                phone: "",
                designation: "",
                isPrimary: false,
              })
            }
          >
            Add Contact
          </Button>
        </section>

        {/* Tags */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Tags</h2>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <TagInput
                label="Tags"
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Type a tag and press Enter…"
              />
            )}
          />
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Additional Notes</h2>
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Internal notes about this client..."
            error={errors.notes?.message}
            {...register("notes")}
          />
        </section>

        {/* Custom Fields */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Custom Fields</h2>
          <Controller
            name="customFields"
            control={control}
            render={({ field }) => (
              <CustomFieldsEditor
                value={field.value ?? {}}
                onChange={field.onChange}
              />
            )}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateClient.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/clients/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
