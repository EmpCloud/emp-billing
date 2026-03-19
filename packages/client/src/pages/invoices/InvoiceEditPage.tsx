import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, Trash2, ArrowLeft, Paperclip, X } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { DiscountType, formatMoney, TDS_RATES_INDIA } from "@emp-billing/shared";
import {
  useInvoice,
  useUpdateInvoice,
  uploadInvoiceAttachment,
  formatFileSize,
} from "@/api/hooks/invoice.hooks";
import type { InvoiceAttachment } from "@/api/hooks/invoice.hooks";
import { useTaxRates } from "@/api/hooks/product.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { Button } from "@/components/common/Button";
import { Input, Select, Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { CustomFieldsEditor } from "@/components/common/CustomFieldsEditor";

// Form uses human-readable rates (not paise); we convert before submitting.
const FormItemSchema = z.object({
  name: z.string().min(1, "Item name required"),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("Must be > 0"),
  rate: z.coerce.number().min(0, "Must be ≥ 0"),
  taxRateId: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  sortOrder: z.number().int().default(0),
});

const FormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string().min(1, "Issue date required"),
  dueDate: z.string().min(1, "Due date required"),
  currency: z.string().length(3).default("INR"),
  referenceNumber: z.string().optional(),
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

export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoiceData, isLoading, isError } = useInvoice(id!);
  const updateInvoice = useUpdateInvoice(id!);
  const { data: clientsData } = useClients();
  const { data: taxRatesData } = useTaxRates();

  const clients = clientsData?.data ?? [];
  const taxRates = (taxRatesData?.data ?? []) as { id: string; name: string; rate: number }[];

  const invoice = invoiceData?.data as
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
      currency: "INR",
      issueDate: "",
      dueDate: "",
      items: [{ name: "", description: "", quantity: 1, rate: 0, sortOrder: 0 }],
    },
  });

  // ── Custom Fields ──────────────────────────────────────────────────────
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  // ── TDS / Withholding Tax ────────────────────────────────────────────
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsSection, setTdsSection] = useState("");
  const [tdsRate, setTdsRate] = useState(0);

  const tdsOptions = Object.entries(TDS_RATES_INDIA).map(([key, val]) => ({
    key,
    label: `${val.section} - ${key.replace(/_/g, " ")} (${val.rate}%)`,
    section: val.section,
    rate: val.rate,
  }));

  // ── Attachments ──────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingAttachment(true);
    try {
      const uploaded: InvoiceAttachment[] = [];
      for (const file of Array.from(files)) {
        const attachment = await uploadInvoiceAttachment(file);
        uploaded.push(attachment);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} file(s) attached`);
    } catch {
      toast.error("Failed to upload attachment");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // When invoice data arrives, reset form with fetched values (converting paise → display units)
  useEffect(() => {
    if (!invoice) return;

    const items =
      (invoice.items as Record<string, unknown>[])?.map((item, i) => ({
        name: (item.name as string) || "",
        description: (item.description as string) || "",
        quantity: Number(item.quantity) || 1,
        rate: (Number(item.rate) || 0) / 100, // paise → display units
        taxRateId: (item.taxRateId as string) || "",
        discountType: item.discountType as DiscountType | undefined,
        discountValue: Number(item.discountValue) || 0,
        sortOrder: Number(item.sortOrder) ?? i,
      })) ?? [];

    reset({
      clientId: (invoice.clientId as string) || "",
      issueDate: invoice.issueDate
        ? dayjs(invoice.issueDate as string).format("YYYY-MM-DD")
        : "",
      dueDate: invoice.dueDate
        ? dayjs(invoice.dueDate as string).format("YYYY-MM-DD")
        : "",
      currency: (invoice.currency as string) || "INR",
      referenceNumber: (invoice.referenceNumber as string) || "",
      items: items.length > 0 ? items : [{ name: "", description: "", quantity: 1, rate: 0, sortOrder: 0 }],
      notes: (invoice.notes as string) || "",
      terms: (invoice.terms as string) || "",
    });

    // Pre-populate custom fields from existing invoice data
    const existingCustomFields = (invoice as Record<string, unknown>).customFields;
    if (existingCustomFields && typeof existingCustomFields === "object" && !Array.isArray(existingCustomFields)) {
      setCustomFields(existingCustomFields as Record<string, string>);
    }

    // Pre-populate attachments from existing invoice data
    const existing = (invoice as Record<string, unknown>).attachments;
    if (Array.isArray(existing)) {
      setAttachments(
        existing.map((a: Record<string, unknown>) => ({
          name: (a.name as string) || "attachment",
          url: (a.url as string) || "",
          size: Number(a.size) || 0,
        }))
      );
    }

    // Pre-populate TDS from existing invoice data
    const existingTdsRate = Number((invoice as Record<string, unknown>).tdsRate) || 0;
    const existingTdsSection = ((invoice as Record<string, unknown>).tdsSection as string) || "";
    if (existingTdsRate > 0) {
      setTdsEnabled(true);
      setTdsRate(existingTdsRate);
      setTdsSection(existingTdsSection);
    } else {
      setTdsEnabled(false);
      setTdsRate(0);
      setTdsSection("");
    }
  }, [invoice, reset]);

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

  // TDS calculated on subtotal (display units)
  const tdsAmount = tdsEnabled && tdsRate > 0 ? subtotal * tdsRate / 100 : 0;
  const netReceivable = total - tdsAmount;

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      attachments,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      tdsRate: tdsEnabled && tdsRate > 0 ? tdsRate : 0,
      tdsSection: tdsEnabled && tdsSection ? tdsSection : undefined,
      items: values.items.map((item, i) => ({
        ...item,
        rate: Math.round((Number(item.rate) || 0) * 100),
        sortOrder: i,
        taxRateId: item.taxRateId || undefined,
      })),
    };
    updateInvoice.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate(`/invoices/${id}`),
    });
  }

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Not found state ───────────────────────────────────────────────────────
  if (isError || !invoice) {
    return (
      <div className="p-6 max-w-6xl">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-gray-800">Invoice not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            The invoice you are looking for does not exist or has been deleted.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate("/invoices")}
          >
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Edit Invoice"
        subtitle={`Invoice ${(invoice.invoiceNumber as string) || ""}`}
        breadcrumb={[
          { label: "Invoices", href: "/invoices" },
          { label: (invoice.invoiceNumber as string) || "Invoice", href: `/invoices/${id}` },
          { label: "Edit" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(`/invoices/${id}`)}
          >
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Client"
              required
              error={errors.clientId?.message}
              {...register("clientId")}
            >
              <option value="">Select a client…</option>
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
              label="Due Date"
              type="date"
              required
              error={errors.dueDate?.message}
              {...register("dueDate")}
            />
            <Select
              label="Currency"
              error={errors.currency?.message}
              {...register("currency")}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input
              label="Reference Number"
              placeholder="PO-12345"
              error={errors.referenceNumber?.message}
              {...register("referenceNumber")}
            />
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
            <div className="w-72 space-y-2 text-sm">
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
              {tdsEnabled && tdsAmount > 0 && (
                <>
                  <div className="flex justify-between text-orange-600">
                    <span>TDS ({tdsSection} @ {tdsRate}%)</span>
                    <span>-{formatMoney(Math.round(tdsAmount * 100), currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 bg-gray-50 rounded-lg px-2 py-1.5">
                    <span>Net Receivable</span>
                    <span>{formatMoney(Math.round(netReceivable * 100), currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* TDS / Withholding Tax */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">TDS / Withholding Tax</h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={tdsEnabled}
                onChange={(e) => {
                  setTdsEnabled(e.target.checked);
                  if (!e.target.checked) {
                    setTdsSection("");
                    setTdsRate(0);
                  }
                }}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Enable if the client deducts TDS when paying. This does not reduce the invoice total but shows the net receivable amount.
          </p>

          {tdsEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TDS Section</label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={tdsSection}
                  onChange={(e) => {
                    const selected = tdsOptions.find((o) => o.section === e.target.value);
                    setTdsSection(e.target.value);
                    if (selected) setTdsRate(selected.rate);
                  }}
                >
                  <option value="">Select section...</option>
                  {tdsOptions.map((opt) => (
                    <option key={opt.key} value={opt.section}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TDS Rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={tdsRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTdsRate(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TDS Amount</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                  {formatMoney(Math.round(tdsAmount * 100), currency)}
                </div>
              </div>
            </div>
          )}
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
              placeholder="Payment due within 30 days…"
              {...register("terms")}
            />
          </div>
        </section>

        {/* Custom Fields */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Custom Fields</h2>
          <CustomFieldsEditor
            value={customFields}
            onChange={setCustomFields}
          />
        </section>

        {/* Attachments */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Attachments</h2>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachFiles}
          />

          {attachments.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {attachments.map((att, idx) => (
                <li key={`${att.url}-${idx}`} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{att.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatFileSize(att.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Paperclip className="h-4 w-4" />}
            loading={uploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
          >
            Attach File
          </Button>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={isSubmitting || updateInvoice.isPending}
          >
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/invoices/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
