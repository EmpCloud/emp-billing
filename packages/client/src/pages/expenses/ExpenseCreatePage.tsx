import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { Upload, X, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { useCreateExpense, useExpenseCategories } from "@/api/hooks/expense.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { uploadReceiptFile } from "@/api/hooks/invoice.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";

// Form uses display units for amount; we convert to paise before submitting.
const FormSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be positive"), // display units
  currency: z.string().length(3).default("INR"),
  description: z.string().min(1, "Description is required"),
  vendorName: z.string().optional(),
  isBillable: z.boolean().default(false),
  clientId: z.string().optional(),
  tags: z.string().optional(), // comma-separated, split before submit
  isMileage: z.boolean().default(false),
  distance: z.coerce.number().min(0).optional(),
  mileageRate: z.coerce.number().min(0).optional(), // display units (e.g. rupees per km)
});

type FormValues = z.infer<typeof FormSchema>;

const CURRENCIES = ["INR", "USD", "GBP", "EUR"];

export function ExpenseCreatePage() {
  const navigate = useNavigate();

  const createExpense = useCreateExpense();
  const { data: categoriesData } = useExpenseCategories();
  const { data: clientsData } = useClients();

  const categories = (categoriesData?.data ?? []) as { id: string; name: string }[];
  const clients = clientsData?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      currency: "INR",
      date: dayjs().format("YYYY-MM-DD"),
      amount: 0,
      isBillable: false,
      description: "",
      tags: "",
      isMileage: false,
      distance: 0,
      mileageRate: 0,
    },
  });

  const isBillable = watch("isBillable");
  const isMileage = watch("isMileage");
  const distance = watch("distance");
  const mileageRate = watch("mileageRate");

  // Auto-calculate amount when distance or rate changes in mileage mode
  useEffect(() => {
    if (isMileage && distance && mileageRate) {
      const calculatedAmount = Number((distance * mileageRate).toFixed(2));
      setValue("amount", calculatedAmount);
    }
  }, [isMileage, distance, mileageRate, setValue]);

  // ── Receipt upload ──────────────────────────────────────────────────────
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const handleReceiptUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    try {
      const result = await uploadReceiptFile(file);
      setReceiptUrl(result.url);
      setReceiptName(result.name);
      toast.success("Receipt uploaded");
    } catch {
      toast.error("Failed to upload receipt");
    } finally {
      setUploadingReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }, []);

  const removeReceipt = useCallback(() => {
    setReceiptUrl(null);
    setReceiptName(null);
  }, []);

  const isReceiptImage = receiptUrl
    ? /\.(jpg|jpeg|png|gif|webp)$/i.test(receiptUrl) || receiptUrl.startsWith("data:image")
    : false;

  function onSubmit(values: FormValues) {
    const tags = values.tags
      ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const payload: Record<string, unknown> = {
      categoryId: values.categoryId,
      date: values.date,
      amount: Math.round((Number(values.amount) || 0) * 100),
      currency: values.currency,
      taxAmount: 0,
      description: values.description,
      vendorName: values.vendorName || undefined,
      isBillable: values.isBillable,
      clientId: values.isBillable && values.clientId ? values.clientId : undefined,
      receiptUrl: receiptUrl || undefined,
      tags,
    };

    // Include mileage fields if mileage tracking is enabled
    if (values.isMileage && values.distance && values.mileageRate) {
      payload.distance = values.distance;
      payload.mileageRate = Math.round((Number(values.mileageRate) || 0) * 100);
    }

    createExpense.mutate(payload as unknown as Record<string, unknown>);
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="New Expense"
        breadcrumb={[{ label: "Expenses", href: "/expenses" }, { label: "New Expense" }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Expense Details */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Expense Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              required
              error={errors.categoryId?.message}
              {...register("categoryId")}
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input
              label="Date"
              type="date"
              required
              error={errors.date?.message}
              {...register("date")}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              error={errors.amount?.message}
              {...register("amount")}
            />
            <Select
              label="Currency"
              error={errors.currency?.message}
              {...register("currency")}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="sm:col-span-2">
              <Textarea
                label="Description"
                rows={2}
                required
                placeholder="What was this expense for?"
                error={errors.description?.message}
                {...register("description")}
              />
            </div>
            <Input
              label="Vendor Name"
              placeholder="e.g. Amazon, Uber"
              error={errors.vendorName?.message}
              {...register("vendorName")}
            />
            <Input
              label="Tags"
              placeholder="travel, software, office (comma-separated)"
              error={errors.tags?.message}
              {...register("tags")}
            />
          </div>
        </section>

        {/* Billing */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Billing</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                {...register("isBillable")}
              />
              <span className="text-sm text-gray-700">This expense is billable to a client</span>
            </label>

            {isBillable && (
              <div className="max-w-sm">
                <Select
                  label="Client"
                  error={errors.clientId?.message}
                  {...register("clientId")}
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </section>

        {/* Mileage */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Mileage</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                {...register("isMileage")}
              />
              <span className="text-sm text-gray-700">Calculate amount from mileage</span>
            </label>

            {isMileage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Distance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  error={errors.distance?.message}
                  {...register("distance")}
                />
                <Input
                  label="Rate per unit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  error={errors.mileageRate?.message}
                  {...register("mileageRate")}
                />
                {distance && mileageRate ? (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-gray-500">
                      Calculated amount: <span className="font-semibold text-gray-800">{(distance * mileageRate).toFixed(2)}</span>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Receipt */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Receipt</h2>

          <input
            ref={receiptInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleReceiptUpload}
          />

          {receiptUrl ? (
            <div className="space-y-3">
              {isReceiptImage ? (
                <div className="relative inline-block">
                  <img
                    src={receiptUrl}
                    alt="Receipt"
                    className="max-w-xs max-h-48 rounded-lg border border-gray-200 object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span>{receiptName || "receipt.pdf"}</span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<X className="h-4 w-4" />}
                onClick={removeReceipt}
              >
                Remove Receipt
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              loading={uploadingReceipt}
              onClick={() => receiptInputRef.current?.click()}
            >
              Upload Receipt
            </Button>
          )}
          <p className="text-xs text-gray-400">Accepted formats: JPG, PNG, PDF</p>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || createExpense.isPending}>
            Create Expense
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/expenses")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
