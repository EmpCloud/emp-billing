import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, Trash2, ArrowLeft } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney } from "@emp-billing/shared";
import { useCreditNote, useUpdateCreditNote } from "@/api/hooks/credit-note.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";

// Form uses human-readable rates (not paise); we convert before submitting.
const FormItemSchema = z.object({
  name: z.string().min(1, "Item name required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  rate: z.coerce.number().min(0, "Must be >= 0"), // in normal units, e.g. 5000
  sortOrder: z.number().int().default(0),
});

const FormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  date: z.string().min(1, "Date required"),
  reason: z.string().optional(),
  items: z.array(FormItemSchema).min(1, "At least one item required"),
});

type FormValues = z.infer<typeof FormSchema>;

function LineItemRow({
  index,
  remove,
  register,
  errors,
  currency,
  watch,
}: {
  index: number;
  remove: (i: number) => void;
  register: ReturnType<typeof useForm<FormValues>>["register"];
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  currency: string;
  watch: ReturnType<typeof useForm<FormValues>>["watch"];
}) {
  const qty = Number(watch(`items.${index}.quantity`)) || 0;
  const rate = Number(watch(`items.${index}.rate`)) || 0;
  const lineTotal = qty * rate;

  const itemErrors = errors.items?.[index];

  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2 w-48">
        <Input
          placeholder="Item name"
          error={itemErrors?.name?.message}
          {...register(`items.${index}.name`)}
        />
      </td>
      <td className="px-3 py-2 w-20">
        <Input
          type="number"
          placeholder="1"
          error={itemErrors?.quantity?.message}
          {...register(`items.${index}.quantity`)}
        />
      </td>
      <td className="px-3 py-2 w-28">
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          error={itemErrors?.rate?.message}
          {...register(`items.${index}.rate`)}
        />
      </td>
      <td className="px-3 py-2 w-28 text-right font-medium text-gray-800">
        {formatMoney(Math.round(lineTotal * 100), currency)}
      </td>
      <td className="px-3 py-2 w-10 text-center">
        <button
          type="button"
          onClick={() => remove(index)}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

export function CreditNoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: creditNoteData, isLoading, isError } = useCreditNote(id!);
  const updateCreditNote = useUpdateCreditNote(id!);
  const { data: clientsData } = useClients();

  const clients = clientsData?.data ?? [];

  const creditNote = creditNoteData?.data as
    | (Record<string, unknown> & { items: Record<string, unknown>[] })
    | undefined;

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      clientId: "",
      date: "",
      reason: "",
      items: [{ name: "", quantity: 1, rate: 0, sortOrder: 0 }],
    },
  });

  // When credit note data arrives, reset form with fetched values (converting paise -> display units)
  useEffect(() => {
    if (!creditNote) return;

    const items =
      (creditNote.items as Record<string, unknown>[])?.map((item, i) => ({
        name: (item.name as string) || "",
        quantity: Number(item.quantity) || 1,
        rate: (Number(item.rate) || 0) / 100, // paise -> display units
        sortOrder: Number(item.sortOrder) ?? i,
      })) ?? [];

    reset({
      clientId: (creditNote.clientId as string) || "",
      date: creditNote.date
        ? dayjs(creditNote.date as string).format("YYYY-MM-DD")
        : "",
      reason: (creditNote.reason as string) || "",
      items: items.length > 0 ? items : [{ name: "", quantity: 1, rate: 0, sortOrder: 0 }],
    });
  }, [creditNote, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  const currency = "INR";

  // Totals computed in display units (not paise)
  const total = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  }, 0);

  function onSubmit(values: FormValues) {
    // Convert rates from display units to paise (x 100)
    const payload = {
      ...values,
      items: values.items.map((item, i) => ({
        ...item,
        rate: Math.round((Number(item.rate) || 0) * 100),
        sortOrder: i,
      })),
    };
    updateCreditNote.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate(`/credit-notes/${id}`),
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
  if (isError || !creditNote) {
    return (
      <div className="p-6 max-w-6xl">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-gray-800">Credit note not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            The credit note you are looking for does not exist or has been deleted.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/credit-notes")}
          >
            Back to Credit Notes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Edit Credit Note"
        subtitle={`Credit Note ${(creditNote.creditNoteNumber as string) || ""}`}
        breadcrumb={[
          { label: "Credit Notes", href: "/credit-notes" },
          { label: (creditNote.creditNoteNumber as string) || "Credit Note", href: `/credit-notes/${id}` },
          { label: "Edit" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/credit-notes/${id}`)}
          >
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Credit Note Details</h2>
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
            <Input
              label="Date"
              type="date"
              required
              error={errors.date?.message}
              {...register("date")}
            />
          </div>
          <Textarea
            label="Reason"
            rows={2}
            placeholder="Reason for credit note..."
            error={errors.reason?.message}
            {...register("reason")}
          />
        </section>

        {/* Line Items */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Line Items</h2>

          {typeof errors.items?.message === "string" && (
            <p className="text-xs text-red-600">{errors.items.message}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-3 pb-2 font-medium text-gray-500">Name</th>
                  <th className="px-3 pb-2 font-medium text-gray-500">Qty</th>
                  <th className="px-3 pb-2 font-medium text-gray-500">Rate</th>
                  <th className="px-3 pb-2 font-medium text-gray-500 text-right">Amount</th>
                  <th className="px-3 pb-2" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <LineItemRow
                    key={field.id}
                    index={index}
                    remove={remove}
                    register={register}
                    errors={errors}
                    currency={currency}
                    watch={watch}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => append({ name: "", quantity: 1, rate: 0, sortOrder: fields.length })}
          >
            Add Line Item
          </Button>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatMoney(Math.round(total * 100), currency)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateCreditNote.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/credit-notes/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
