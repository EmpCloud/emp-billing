import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, AlertTriangle, X, Paperclip, Ticket } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { DiscountType, formatMoney, TDS_RATES_INDIA, PricingModel } from "@emp-billing/shared";
import type { Product, PricingTier } from "@emp-billing/shared";
import {
  useCreateInvoice,
  useInvoices,
  uploadInvoiceAttachment,
  formatFileSize,
} from "@/api/hooks/invoice.hooks";
import type { InvoiceAttachment } from "@/api/hooks/invoice.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { useProducts, useTaxRates } from "@/api/hooks/product.hooks";
import { useValidateCoupon } from "@/api/hooks/coupon.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { CustomFieldsEditor } from "@/components/common/CustomFieldsEditor";

// ── Pricing model helpers (client-side preview) ──────────────────────────────

function calculateTieredPrice(tiers: PricingTier[], quantity: number): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
  let remaining = quantity;
  let total = 0;
  let prevCap = 0;
  for (const tier of sorted) {
    if (remaining <= 0) break;
    const cap = tier.upTo === null ? Infinity : tier.upTo;
    const qty = Math.min(remaining, cap - prevCap);
    if (qty > 0) {
      total += qty * tier.unitPrice;
      if (tier.flatFee) total += tier.flatFee;
      remaining -= qty;
    }
    prevCap = tier.upTo === null ? Infinity : tier.upTo;
  }
  return Math.round(total);
}

function calculateVolumePrice(tiers: PricingTier[], quantity: number): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
  for (const tier of sorted) {
    if (tier.upTo === null || quantity <= tier.upTo) {
      let total = Math.round(quantity * tier.unitPrice);
      if (tier.flatFee) total += tier.flatFee;
      return total;
    }
  }
  const last = sorted[sorted.length - 1];
  return Math.round(quantity * last.unitPrice) + (last.flatFee ?? 0);
}

/** Calculate price in paise using the product's pricing model */
function calculateProductPrice(product: Product, quantity: number): number {
  const model = product.pricingModel ?? PricingModel.FLAT;
  const tiers = product.pricingTiers ?? [];
  switch (model) {
    case PricingModel.TIERED:
    case PricingModel.METERED:
      return tiers.length > 0 ? calculateTieredPrice(tiers, quantity) : Math.round(product.rate * quantity);
    case PricingModel.VOLUME:
      return tiers.length > 0 ? calculateVolumePrice(tiers, quantity) : Math.round(product.rate * quantity);
    case PricingModel.FLAT:
    case PricingModel.PER_SEAT:
    default:
      return Math.round(product.rate * quantity);
  }
}

function getTieredBreakdown(tiers: PricingTier[], quantity: number): string[] {
  if (tiers.length === 0) return [];
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
  const lines: string[] = [];
  let remaining = quantity;
  let prevCap = 0;
  for (const tier of sorted) {
    if (remaining <= 0) break;
    const cap = tier.upTo === null ? Infinity : tier.upTo;
    const qty = Math.min(remaining, cap - prevCap);
    if (qty > 0) {
      const amt = Math.round(qty * tier.unitPrice);
      const label = tier.upTo === null ? `${prevCap + 1}+` : `${prevCap + 1}-${tier.upTo}`;
      lines.push(`${label}: ${qty} x ${(tier.unitPrice / 100).toFixed(2)} = ${(amt / 100).toFixed(2)}`);
      remaining -= qty;
    }
    prevCap = tier.upTo === null ? Infinity : tier.upTo;
  }
  return lines;
}

// Form uses human-readable rates (not paise); we convert before submitting.
const FormItemSchema = z.object({
  name: z.string().min(1, "Item name required").refine((v) => !/^\d+$/.test(v.trim()), "Item name cannot be purely numeric"),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("Must be > 0"),
  rate: z.coerce.number().min(0, "Must be ≥ 0"), // in normal units, e.g. ₹5000
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

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get("clientId") ?? "";

  const createInvoice = useCreateInvoice();
  const { data: clientsData } = useClients();
  const { data: taxRatesData } = useTaxRates();
  const { data: productsData } = useProducts();
  const validateCoupon = useValidateCoupon();

  const clients = clientsData?.data ?? [];
  const taxRates = (taxRatesData?.data ?? []) as { id: string; name: string; rate: number }[];
  const products = (productsData?.data ?? []) as Product[];

  // Build a map from product name to product for quick lookup
  const productsByName = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.name, p);
    }
    return map;
  }, [products]);

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
      dueDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
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

  // ── Duplicate detection ────────────────────────────────────────────────
  const watchedClientId = watch("clientId");
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  // Fetch recent invoices for the selected client to check for duplicates
  const { data: recentInvoicesData } = useInvoices(
    watchedClientId ? { clientId: watchedClientId, limit: 5 } : { limit: 0 }
  );

  const duplicateInvoice = useMemo(() => {
    if (duplicateDismissed || !watchedClientId || total <= 0) return null;
    const recentInvoices = recentInvoicesData?.data ?? [];
    const thirtyDaysAgo = dayjs().subtract(30, "day");

    for (const inv of recentInvoices) {
      const invoiceDate = dayjs(inv.issueDate);
      if (invoiceDate.isBefore(thirtyDaysAgo)) continue;

      // inv.total is stored in paise/cents; total is in display units
      const invTotal = inv.total / 100;
      if (invTotal <= 0) continue;

      const diff = Math.abs(invTotal - total) / invTotal;
      if (diff <= 0.01) {
        return {
          invoiceNumber: inv.invoiceNumber,
          date: invoiceDate.format("MMM D, YYYY"),
        };
      }
    }
    return null;
  }, [recentInvoicesData, watchedClientId, total, duplicateDismissed]);

  // ── Custom Fields ────────────────────────────────────────────────
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

  // ── Coupon ──────────────────────────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    type: string;
    value: number;
  } | null>(null);

  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount / 100 : 0; // display units
  const totalAfterCoupon = Math.max(0, total - couponDiscount);

  // TDS calculated on (subtotal - discount) in display units
  const tdsAmount = tdsEnabled && tdsRate > 0 ? subtotal * tdsRate / 100 : 0;
  const netReceivable = totalAfterCoupon - tdsAmount;

  function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    validateCoupon.mutate(
      { code: couponCode.trim(), amount: Math.round(total * 100) },
      {
        onSuccess: (res) => {
          if (res.data?.valid) {
            setAppliedCoupon({
              code: res.data.coupon.code,
              discountAmount: res.data.discountAmount,
              type: res.data.coupon.type,
              value: res.data.coupon.value,
            });
            toast.success(`Coupon "${res.data.coupon.code}" applied`);
          }
        },
      }
    );
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
  }

  // ── Auto-send toggle ────────────────────────────────────────────────
  const [autoSend, setAutoSend] = useState(false);

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
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  function onSubmit(values: FormValues) {
    // Convert rates from display units to paise (× 100)
    const payload = {
      ...values,
      autoSend,
      attachments,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      ...(tdsEnabled && tdsRate > 0
        ? { tdsRate, tdsSection: tdsSection || undefined }
        : {}),
      items: values.items.map((item, i) => ({
        ...item,
        rate: Math.round((Number(item.rate) || 0) * 100),
        sortOrder: i,
        taxRateId: item.taxRateId || undefined,
      })),
    };
    createInvoice.mutate(payload as unknown as Record<string, unknown>);
  }

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="New Invoice"
        breadcrumb={[{ label: "Invoices", href: "/invoices" }, { label: "New Invoice" }]}
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
            <div className="w-80 space-y-2 text-sm">
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
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" />
                    Coupon ({appliedCoupon.code})
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span>-{formatMoney(appliedCoupon.discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{formatMoney(Math.round(totalAfterCoupon * 100), currency)}</span>
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

        {/* Apply Coupon */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Coupon / Promo Code</h2>
          {appliedCoupon ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <Ticket className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  {appliedCoupon.code} applied
                </p>
                <p className="text-xs text-green-600">
                  {appliedCoupon.type === "percentage"
                    ? `${appliedCoupon.value}% off`
                    : `${formatMoney(appliedCoupon.value, currency)} off`}
                  {" "} — saving {formatMoney(appliedCoupon.discountAmount, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-green-600 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  placeholder="Enter coupon code..."
                  className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon(); } }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Ticket className="h-4 w-4" />}
                loading={validateCoupon.isPending}
                onClick={handleApplyCoupon}
              >
                Apply
              </Button>
            </div>
          )}
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

        {/* Duplicate detection warning */}
        {duplicateInvoice && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-yellow-800">
              A similar invoice ({duplicateInvoice.invoiceNumber}) for this client was created on{" "}
              {duplicateInvoice.date}. This might be a duplicate.
            </div>
            <button
              type="button"
              onClick={() => setDuplicateDismissed(true)}
              className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Auto-send toggle */}
        <div className="flex items-center gap-3 px-1">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Auto-send to client after creation</span>
            <p className="text-xs text-gray-500">
              The invoice will be sent immediately and its status will be set to &quot;Sent&quot;.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || createInvoice.isPending}>
            {autoSend ? "Create & Send Invoice" : "Create Invoice"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/invoices")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
