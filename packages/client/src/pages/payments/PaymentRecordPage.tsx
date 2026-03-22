import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { PaymentMethod } from "@emp-billing/shared";
import { useRecordPayment } from "@/api/hooks/payment.hooks";
import { useClients } from "@/api/hooks/client.hooks";
import { useInvoices } from "@/api/hooks/invoice.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { SearchableSelect } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";

// Adapt schema: amount in display units (rupees), not paise.
const FormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  invoiceId: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.BANK_TRANSFER]: "Bank Transfer",
  [PaymentMethod.CHEQUE]: "Cheque",
  [PaymentMethod.UPI]: "UPI",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.GATEWAY_STRIPE]: "Stripe",
  [PaymentMethod.GATEWAY_RAZORPAY]: "Razorpay",
  [PaymentMethod.GATEWAY_PAYPAL]: "PayPal",
  [PaymentMethod.OTHER]: "Other",
};

export function PaymentRecordPage() {
  const navigate = useNavigate();
  const recordPayment = useRecordPayment();
  const { data: clientsData } = useClients();
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
      date: dayjs().format("YYYY-MM-DD"),
      method: PaymentMethod.BANK_TRANSFER,
    },
  });

  const selectedClientId = watch("clientId");
  const selectedMethod = watch("method");

  const paymentMethodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => ({
    value: val,
    label,
  }));

  const { data: invoicesData } = useInvoices(
    selectedClientId ? { clientId: selectedClientId } : undefined,
  );
  const clientInvoices = invoicesData?.data ?? [];

  function onSubmit(values: FormValues) {
    // Convert amount from display units (rupees) to paise
    const payload = {
      ...values,
      amount: Math.round(values.amount * 100),
      invoiceId: values.invoiceId || undefined,
    };

    recordPayment.mutate(payload as unknown as Record<string, unknown>, {
      onSuccess: () => navigate("/payments"),
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Record Payment"
        breadcrumb={[{ label: "Payments", href: "/payments" }, { label: "Record Payment" }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Payment Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <Select
              label="Invoice (optional)"
              error={errors.invoiceId?.message}
              disabled={!selectedClientId || clientInvoices.length === 0}
              {...register("invoiceId")}
            >
              <option value="">No specific invoice</option>
              {clientInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.currency} {(inv.amountDue / 100).toFixed(2)} due
                </option>
              ))}
            </Select>

            <Input
              label="Amount"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              hint="Enter amount in base currency units (e.g. 5000 for ₹5,000)"
              error={errors.amount?.message}
              {...register("amount")}
            />

            <Input
              label="Date"
              type="date"
              required
              error={errors.date?.message}
              {...register("date")}
            />

            <SearchableSelect
              label="Payment Method"
              required
              error={errors.method?.message}
              options={paymentMethodOptions}
              value={selectedMethod}
              onChange={(val) => setValue("method", val as PaymentMethod, { shouldValidate: true })}
              placeholder="Select method..."
            />

            <Input
              label="Reference"
              placeholder="UTR / Cheque number…"
              error={errors.reference?.message}
              {...register("reference")}
            />
          </div>

          <Textarea
            label="Notes"
            rows={3}
            placeholder="Optional notes about this payment…"
            error={errors.notes?.message}
            {...register("notes")}
          />
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || recordPayment.isPending}>
            Record Payment
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/payments")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
