import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { DiscountType, formatMoney } from "@emp-billing/shared";
import { useCreateQuote } from "@/api/hooks/quote.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { useTaxRates } from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";

// Form uses human-readable rates (not paise); we convert before submitting.
const FormItemSchema = z.object({
  name: z.string().min(1, "Item name required"),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("Must be > 0"),
  rate: z.coerce.number().min(0, "Must be >= 0"), // in normal units, e.g. 5000
  taxRateId: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  sortOrder: z.number().int().default(0),
});

const FormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string().min(1, "Issue date required"),
  expiryDate: z.string().min(1, "Expiry date required"),
  currency: z.string().length(3).default("INR"),
  items: z.array(FormItemSchema).min(1, "At least one item required"),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

const CURRENCIES = ["INR", "USD", "GBP", "EUR"];

function LineItemRow({
  index,
  remove,
  register,
  errors,
  taxRates,
  currency,
  watch,
}: {
  index: number;
  remove: (i: number) => void;
  register: ReturnType<typeof useForm<FormValues>>["register"];
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
  taxRates: { id: string; name: string; rate: number }[];
  currency: string;
  watch: ReturnType<typeof useForm<FormValues>>["watch"];
}) {
  const qty = Number(watch(`items.${index}.quantity`)) || 0;
  const rate = Number(watch(`items.${index}.rate`)) || 0;
  const lineTotal = qty * rate;

  const itemErrors = errors.items?.[index];

  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2 w-40">
        <Input
          placeholder="Item name"
          error={itemErrors?.name?.message}
          {...register(`items.${index}.name`)}
        />
      </td>
      <td className="px-3 py-2 w-48">
        <Input
          placeholder="Description"
          {...register(`items.${index}.description`)}
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
      <td className="px-3 py-2 w-36">
        <select
          className="w-full rounded-lg border border-gray-300 bg-white text-sm px-2 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          {...register(`items.${index}.taxRateId`)}
        >
          <option value="">No tax</option>
          {taxRates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
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

export function QuoteCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get("clientId") ?? "";

  const createQuote = useCreateQuote();
  const { data: clientsData } = useClients();
  const { data: taxRatesData } = useTaxRates();

  const clients = clientsData?.data ?? [];
  const taxRates = (taxRatesData?.data ?? []) as { id: string; name: string; rate: number }[];

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      clientId: prefillClientId,
      currency: "INR",
      issueDate: dayjs().format("YYYY-MM-DD"),
      expiryDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
      items: [{ name: "", description: "", quantity: 1, rate: 0, sortOrder: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const currency = watch("currency");

  // Totals computed in display units (not paise)
  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  }, 0);

  const taxTotal = (watchedItems ?? []).reduce((sum, item) => {
    const taxRate = taxRates.find((t) => t.id === item.taxRateId);
    if (!taxRate) return sum;
    const line = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    return sum + line * (taxRate.rate / 100);
  }, 0);

  const total = subtotal + taxTotal;

  function onSubmit(values: FormValues) {
    // Convert rates from display units to paise (x 100)
    const payload = {
      ...values,
      items: values.items.map((item, i) => ({
        ...item,
        rate: Math.round((Number(item.rate) || 0) * 100),
        sortOrder: i,
        taxRateId: item.taxRateId || undefined,
      })),
    };
    createQuote.mutate(payload as unknown as Record<string, unknown>);
  }

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="New Quote"
        breadcrumb={[{ label: "Quotes", href: "/quotes" }, { label: "New Quote" }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Quote Details</h2>
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
              label="Issue Date"
              type="date"
              required
              error={errors.issueDate?.message}
              {...register("issueDate")}
            />
            <Input
              label="Expiry Date"
              type="date"
              required
              error={errors.expiryDate?.message}
              {...register("expiryDate")}
            />
            <Select
              label="Currency"
              error={errors.currency?.message}
              {...register("currency")}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
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
                  <th className="px-3 pb-2 font-medium text-gray-500">Description</th>
                  <th className="px-3 pb-2 font-medium text-gray-500">Qty</th>
                  <th className="px-3 pb-2 font-medium text-gray-500">Rate</th>
                  <th className="px-3 pb-2 font-medium text-gray-500">Tax</th>
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
                    taxRates={taxRates}
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
            onClick={() => append({ name: "", description: "", quantity: 1, rate: 0, sortOrder: fields.length })}
          >
            Add Line Item
          </Button>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatMoney(Math.round(subtotal * 100), currency)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatMoney(Math.round(taxTotal * 100), currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatMoney(Math.round(total * 100), currency)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes & Terms */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Notes & Terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Notes"
              rows={3}
              placeholder="Thank you for your business!"
              {...register("notes")}
            />
            <Textarea
              label="Terms & Conditions"
              rows={3}
              placeholder="This quote is valid for 30 days..."
              {...register("terms")}
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || createQuote.isPending}>
            Create Quote
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/quotes")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
