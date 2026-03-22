import { useNavigate } from "react-router-dom";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateClientSchema } from "@emp-billing/shared";
import { useCreateClient } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { TagInput } from "@/components/common/TagInput";
import { CustomFieldsEditor } from "@/components/common/CustomFieldsEditor";
import { AddressFields } from "@/components/common/AddressFields";

type FormValues = z.infer<typeof CreateClientSchema>;

const CURRENCIES = [
  { code: "INR", label: "INR – Indian Rupee" },
  { code: "USD", label: "USD – US Dollar" },
  { code: "GBP", label: "GBP – British Pound" },
  { code: "EUR", label: "EUR – Euro" },
];

const PAYMENT_TERMS = [
  { days: 0, label: "Due on receipt" },
  { days: 7, label: "Net 7" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
];

export function ClientCreatePage() {
  const navigate = useNavigate();
  const createClient = useCreateClient();

  const methods = useForm<FormValues>({
    resolver: zodResolver(CreateClientSchema),
    defaultValues: {
      currency: "INR",
      paymentTerms: 30,
      contacts: [],
      tags: [],
      portalEnabled: false,
      customFields: {},
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = methods;

  function onSubmit(values: FormValues) {
    createClient.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/clients"),
    });
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="New Client"
        breadcrumb={[{ label: "Clients", href: "/clients" }, { label: "New Client" }]}
      />

      <FormProvider {...methods}>
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
                onKeyDown={(e) => {
                  // Allow control keys, digits, +, -, (, ), space, and period
                  const allowed = /[\d\s+\-().]/;
                  if (
                    e.key.length === 1 &&
                    !allowed.test(e.key) &&
                    !e.ctrlKey &&
                    !e.metaKey
                  ) {
                    e.preventDefault();
                  }
                }}
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
            <AddressFields prefix="billingAddress" />
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
              placeholder="Internal notes about this client…"
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
            <Button type="submit" loading={isSubmitting || createClient.isPending}>
              Create Client
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
