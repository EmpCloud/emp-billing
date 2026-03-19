import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, ArrowLeft } from "lucide-react";
import dayjs from "dayjs";
import { RecurringFrequency } from "@emp-billing/shared";
import { useRecurringProfile, useUpdateRecurringProfile } from "@/api/hooks/recurring.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

const FREQUENCY_OPTIONS = [
  { value: RecurringFrequency.DAILY, label: "Daily" },
  { value: RecurringFrequency.WEEKLY, label: "Weekly" },
  { value: RecurringFrequency.MONTHLY, label: "Monthly" },
  { value: RecurringFrequency.QUARTERLY, label: "Quarterly" },
  { value: RecurringFrequency.HALF_YEARLY, label: "Half Yearly" },
  { value: RecurringFrequency.YEARLY, label: "Yearly" },
  { value: RecurringFrequency.CUSTOM, label: "Custom" },
];

const FormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  type: z.enum(["invoice", "expense"], { required_error: "Type is required" }),
  frequency: z.nativeEnum(RecurringFrequency),
  customDays: z.coerce.number().positive().optional(),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().optional(),
  maxOccurrences: z.coerce.number().int().positive().optional(),
  autoSend: z.boolean().default(false),
  autoCharge: z.boolean().default(false),
  templateData: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export function RecurringEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: profileData, isLoading, isError } = useRecurringProfile(id!);
  const updateProfile = useUpdateRecurringProfile(id!);
  const { data: clientsData } = useClients();

  const clients = clientsData?.data ?? [];

  const profile = profileData?.data as Record<string, unknown> | undefined;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      clientId: "",
      type: "invoice",
      frequency: RecurringFrequency.MONTHLY,
      startDate: "",
      autoSend: false,
      autoCharge: false,
      templateData: "{}",
    },
  });

  // When profile data arrives, reset form with fetched values
  useEffect(() => {
    if (!profile) return;

    let templateDataStr = "{}";
    if (profile.templateData) {
      try {
        templateDataStr =
          typeof profile.templateData === "string"
            ? profile.templateData
            : JSON.stringify(profile.templateData, null, 2);
      } catch {
        templateDataStr = "{}";
      }
    }

    reset({
      clientId: (profile.clientId as string) || "",
      type: (profile.type as "invoice" | "expense") || "invoice",
      frequency: (profile.frequency as RecurringFrequency) || RecurringFrequency.MONTHLY,
      customDays: profile.customDays ? Number(profile.customDays) : undefined,
      startDate: profile.startDate
        ? dayjs(profile.startDate as string).format("YYYY-MM-DD")
        : "",
      endDate: profile.endDate
        ? dayjs(profile.endDate as string).format("YYYY-MM-DD")
        : "",
      maxOccurrences: profile.maxOccurrences ? Number(profile.maxOccurrences) : undefined,
      autoSend: Boolean(profile.autoSend),
      autoCharge: Boolean(profile.autoCharge),
      templateData: templateDataStr,
    });
  }, [profile, reset]);

  const frequency = watch("frequency");

  function onSubmit(values: FormValues) {
    let templateData = {};
    try {
      templateData = values.templateData ? JSON.parse(values.templateData) : {};
    } catch {
      // keep empty object if JSON is invalid
    }

    const payload = {
      ...values,
      endDate: values.endDate || undefined,
      maxOccurrences: values.maxOccurrences || undefined,
      customDays: values.customDays || undefined,
      templateData,
    };
    updateProfile.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate(`/recurring/${id}`),
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not found state
  if (isError || !profile) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-gray-800">Recurring profile not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            The recurring profile you are looking for does not exist or has been deleted.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/recurring")}
          >
            Back to Recurring Profiles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Edit Recurring Profile"
        subtitle={`Profile ${(profile.profileNumber as string) || (profile.id as string) || ""}`}
        breadcrumb={[
          { label: "Recurring Profiles", href: "/recurring" },
          { label: (profile.profileNumber as string) || "Profile", href: `/recurring/${id}` },
          { label: "Edit" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/recurring/${id}`)}
          >
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Details */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Profile Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Client"
              required
              error={errors.clientId?.message}
              {...register("clientId")}
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
              ))}
            </Select>
            <Select
              label="Type"
              required
              error={errors.type?.message}
              {...register("type")}
            >
              <option value="invoice">Invoice</option>
              <option value="expense">Expense</option>
            </Select>
            <Select
              label="Frequency"
              required
              error={errors.frequency?.message}
              {...register("frequency")}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            {frequency === RecurringFrequency.CUSTOM && (
              <Input
                label="Custom Days"
                type="number"
                placeholder="e.g. 45"
                error={errors.customDays?.message}
                {...register("customDays")}
              />
            )}
          </div>
        </section>

        {/* Schedule */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <Input
              label="End Date (optional)"
              type="date"
              error={errors.endDate?.message}
              {...register("endDate")}
            />
            <Input
              label="Max Occurrences (optional)"
              type="number"
              placeholder="Unlimited"
              error={errors.maxOccurrences?.message}
              {...register("maxOccurrences")}
            />
          </div>
        </section>

        {/* Options */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Options</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                {...register("autoSend")}
              />
              Auto-send to client when generated
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                {...register("autoCharge")}
              />
              Auto-charge client (requires payment method on file)
            </label>
          </div>
        </section>

        {/* Template Data */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Template Data</h2>
          <p className="text-sm text-gray-500">
            JSON template used when generating each invoice or expense. Include items, notes, terms, etc.
          </p>
          <Textarea
            label="Template JSON"
            rows={6}
            placeholder='{"items": [{"name": "Monthly Service", "quantity": 1, "rate": 5000}], "notes": "Thank you!"}'
            error={errors.templateData?.message}
            {...register("templateData")}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateProfile.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/recurring/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
