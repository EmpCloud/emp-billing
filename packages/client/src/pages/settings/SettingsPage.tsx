import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Building2, Hash, Palette, Percent, Plus, Pencil, Trash2, CreditCard, Mail, Info, FileText, AlertCircle, Clock, Calendar, Globe, CheckCircle2, XCircle, ShieldCheck, Loader2, Key, Copy, Eye, EyeOff } from "lucide-react";
import {
  useOrgSettings,
  useUpdateOrgSettings,
  useNumberingConfig,
  useUpdateNumberingConfig,
  useEmailTemplates,
  useUpdateEmailTemplate,
} from "@/api/hooks/settings.hooks";
import type { EmailTemplate } from "@/api/hooks/settings.hooks";
import {
  useTaxRates,
  useCreateTaxRate,
  useUpdateTaxRate,
  useDeleteTaxRate,
} from "@/api/hooks/product.hooks";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Input";
import { Textarea } from "@/components/common/Input";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Modal } from "@/components/common/Modal";
import {
  useScheduledReports,
  useCreateScheduledReport,
  useUpdateScheduledReport,
  useDeleteScheduledReport,
} from "@/api/hooks/scheduled-report.hooks";
import {
  useDunningConfig,
  useUpdateDunningConfig,
} from "@/api/hooks/dunning.hooks";
import {
  useListDomains,
  useAddDomain,
  useRemoveDomain,
  useVerifyDomain,
} from "@/api/hooks/domain.hooks";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/api/hooks/api-key.hooks";
import type { TaxRate, TaxComponent, ScheduledReport, CustomDomain, ApiKey } from "@emp-billing/shared";

type SettingsTab = "organization" | "numbering" | "branding" | "tax-rates" | "gateways" | "email" | "scheduled-reports" | "dunning" | "domains" | "api-keys";

const TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: "organization", label: "Organization", icon: <Building2 className="h-4 w-4" /> },
  { key: "numbering", label: "Numbering", icon: <Hash className="h-4 w-4" /> },
  { key: "branding", label: "Branding", icon: <Palette className="h-4 w-4" /> },
  { key: "tax-rates", label: "Tax Rates", icon: <Percent className="h-4 w-4" /> },
  { key: "gateways", label: "Gateways", icon: <CreditCard className="h-4 w-4" /> },
  { key: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { key: "scheduled-reports", label: "Scheduled Reports", icon: <Calendar className="h-4 w-4" /> },
  { key: "dunning", label: "Dunning", icon: <AlertCircle className="h-4 w-4" /> },
  { key: "domains", label: "Domains", icon: <Globe className="h-4 w-4" /> },
  { key: "api-keys", label: "API Keys", icon: <Key className="h-4 w-4" /> },
];

const CURRENCIES = [
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
];

const PAYMENT_TERMS = [
  { days: 0, label: "Due on receipt" },
  { days: 7, label: "Net 7" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
  { days: 90, label: "Net 90" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Chicago", label: "America/Chicago (Central)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST)" },
];

// ---------- Organization Tab ----------

interface OrgFormValues {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  taxId: string;
  defaultCurrency: string;
  defaultPaymentTerms: number;
  defaultTerms: string;
  timezone: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
}

function OrganizationTab() {
  const { data, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrgFormValues>();

  useEffect(() => {
    if (data?.data) {
      const org = data.data;
      reset({
        name: org.name || "",
        legalName: org.legalName || "",
        email: org.email || "",
        phone: org.phone || "",
        taxId: org.taxId || "",
        defaultCurrency: org.defaultCurrency || "INR",
        defaultPaymentTerms: org.defaultPaymentTerms ?? 30,
        defaultTerms: org.defaultTerms || "",
        timezone: org.timezone || "UTC",
        addressLine1: org.address?.line1 || "",
        addressLine2: org.address?.line2 || "",
        addressCity: org.address?.city || "",
        addressState: org.address?.state || "",
        addressPostalCode: org.address?.postalCode || "",
        addressCountry: org.address?.country || "",
      });
    }
  }, [data, reset]);

  function onSubmit(values: OrgFormValues) {
    updateSettings.mutate({
      name: values.name,
      legalName: values.legalName,
      email: values.email,
      phone: values.phone,
      taxId: values.taxId,
      defaultCurrency: values.defaultCurrency,
      defaultPaymentTerms: values.defaultPaymentTerms,
      defaultTerms: values.defaultTerms,
      timezone: values.timezone,
      address: {
        line1: values.addressLine1,
        line2: values.addressLine2,
        city: values.addressCity,
        state: values.addressState,
        postalCode: values.addressPostalCode,
        country: values.addressCountry,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">
          Organization Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Organization Name"
            required
            placeholder="My Company"
            error={errors.name?.message}
            {...register("name", { required: "Organization name is required" })}
          />
          <Input
            label="Legal Name"
            placeholder="My Company Pvt Ltd"
            error={errors.legalName?.message}
            {...register("legalName")}
          />
          <Input
            label="Email"
            type="email"
            required
            placeholder="billing@company.com"
            error={errors.email?.message}
            {...register("email", { required: "Email is required" })}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+91 98765 43210"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Input
            label="GSTIN / Tax ID"
            placeholder="22AAAAA0000A1Z5"
            error={errors.taxId?.message}
            {...register("taxId")}
          />
          <Select
            label="Default Currency"
            error={errors.defaultCurrency?.message}
            {...register("defaultCurrency")}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            label="Default Payment Terms"
            error={errors.defaultPaymentTerms?.message}
            {...register("defaultPaymentTerms", { valueAsNumber: true })}
          >
            {PAYMENT_TERMS.map((t) => (
              <option key={t.days} value={t.days}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="Timezone"
            error={errors.timezone?.message}
            {...register("timezone")}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">
          Default Invoice Terms & Conditions
        </h2>
        <Textarea
          label="Default Terms & Conditions"
          rows={4}
          placeholder="Enter default terms and conditions that will appear on invoices..."
          {...register("defaultTerms")}
        />
      </section>

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Address</h2>
        <div className="space-y-4">
          <Input
            label="Address Line 1"
            placeholder="123 Main Street"
            {...register("addressLine1")}
          />
          <Input
            label="Address Line 2"
            placeholder="Suite 400"
            {...register("addressLine2")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              placeholder="Mumbai"
              {...register("addressCity")}
            />
            <Input
              label="State"
              placeholder="Maharashtra"
              {...register("addressState")}
            />
            <Input
              label="Postal Code"
              placeholder="400001"
              {...register("addressPostalCode")}
            />
            <Input
              label="Country"
              placeholder="India"
              {...register("addressCountry")}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={updateSettings.isPending}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}

// ---------- Numbering Tab ----------

interface NumberingFormValues {
  invoicePrefix: string;
  invoiceNextNumber: number;
  quotePrefix: string;
  quoteNextNumber: number;
}

function NumberingTab() {
  const { data, isLoading } = useNumberingConfig();
  const updateNumbering = useUpdateNumberingConfig();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NumberingFormValues>();

  useEffect(() => {
    if (data?.data) {
      reset({
        invoicePrefix: data.data.invoicePrefix || "INV",
        invoiceNextNumber: data.data.invoiceNextNumber ?? 1,
        quotePrefix: data.data.quotePrefix || "QTE",
        quoteNextNumber: data.data.quoteNextNumber ?? 1,
      });
    }
  }, [data, reset]);

  function onSubmit(values: NumberingFormValues) {
    updateNumbering.mutate(values as unknown as Record<string, unknown>);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">
          Invoice Numbering
        </h2>
        <p className="text-sm text-gray-500">
          Configure the prefix and next number for invoices. The next invoice
          will be numbered as{" "}
          <span className="font-mono text-gray-700">PREFIX-XXXX</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Invoice Prefix"
            placeholder="INV"
            error={errors.invoicePrefix?.message}
            {...register("invoicePrefix", {
              required: "Prefix is required",
            })}
          />
          <Input
            label="Next Invoice Number"
            type="number"
            placeholder="1"
            error={errors.invoiceNextNumber?.message}
            {...register("invoiceNextNumber", {
              valueAsNumber: true,
              required: "Next number is required",
              min: { value: 1, message: "Must be at least 1" },
            })}
          />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">
          Quote Numbering
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quote Prefix"
            placeholder="QTE"
            error={errors.quotePrefix?.message}
            {...register("quotePrefix", { required: "Prefix is required" })}
          />
          <Input
            label="Next Quote Number"
            type="number"
            placeholder="1"
            error={errors.quoteNextNumber?.message}
            {...register("quoteNextNumber", {
              valueAsNumber: true,
              required: "Next number is required",
              min: { value: 1, message: "Must be at least 1" },
            })}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={updateNumbering.isPending}>
          Save Numbering
        </Button>
      </div>
    </form>
  );
}

// ---------- Branding Tab ----------

interface BrandingFormValues {
  primary: string;
  accent: string;
}

function BrandingTab() {
  const { data, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();

  const { register, handleSubmit, reset, watch } =
    useForm<BrandingFormValues>();

  useEffect(() => {
    if (data?.data) {
      reset({
        primary: data.data.brandColors?.primary || "#4f46e5",
        accent: data.data.brandColors?.accent || "#06b6d4",
      });
    }
  }, [data, reset]);

  const primary = watch("primary");
  const accent = watch("accent");

  function onSubmit(values: BrandingFormValues) {
    updateSettings.mutate({
      brandColors: { primary: values.primary, accent: values.accent },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Brand Colors</h2>
        <p className="text-sm text-gray-500">
          These colors are used in your invoices, quotes, and client portal.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Input
              label="Primary Color"
              type="text"
              placeholder="#4f46e5"
              {...register("primary")}
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary || "#4f46e5"}
                onChange={(e) => {
                  const input = document.querySelector<HTMLInputElement>(
                    'input[name="primary"]',
                  );
                  if (input) {
                    const nativeInputValueSetter =
                      Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value",
                      )?.set;
                    nativeInputValueSetter?.call(input, e.target.value);
                    input.dispatchEvent(
                      new Event("input", { bubbles: true }),
                    );
                  }
                }}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <div
                className="h-8 flex-1 rounded border border-gray-200"
                style={{ backgroundColor: primary || "#4f46e5" }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Input
              label="Accent Color"
              type="text"
              placeholder="#06b6d4"
              {...register("accent")}
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent || "#06b6d4"}
                onChange={(e) => {
                  const input = document.querySelector<HTMLInputElement>(
                    'input[name="accent"]',
                  );
                  if (input) {
                    const nativeInputValueSetter =
                      Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value",
                      )?.set;
                    nativeInputValueSetter?.call(input, e.target.value);
                    input.dispatchEvent(
                      new Event("input", { bubbles: true }),
                    );
                  }
                }}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <div
                className="h-8 flex-1 rounded border border-gray-200"
                style={{ backgroundColor: accent || "#06b6d4" }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={updateSettings.isPending}>
          Save Branding
        </Button>
      </div>
    </form>
  );
}

// ---------- Tax Rates Tab ----------

const TAX_TYPE_OPTIONS = [
  { value: "gst", label: "GST" },
  { value: "vat", label: "VAT" },
  { value: "sales_tax", label: "Sales Tax" },
  { value: "custom", label: "Custom" },
];

const TAX_TYPE_LABELS: Record<string, string> = {
  gst: "GST",
  igst: "IGST",
  vat: "VAT",
  sales_tax: "Sales Tax",
  custom: "Custom",
};

interface TaxRateFormValues {
  name: string;
  type: string;
  rate: number;
  isDefault: boolean;
}

function TaxRatesTab() {
  const { data, isLoading } = useTaxRates();
  const deleteTaxRate = useDeleteTaxRate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const taxRates: TaxRate[] = data?.data ?? [];

  function openCreateModal() {
    setEditingRate(null);
    setModalOpen(true);
  }

  function openEditModal(rate: TaxRate) {
    setEditingRate(rate);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRate(null);
  }

  function handleDelete(id: string) {
    deleteTaxRate.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Tax Rates</h2>
            <p className="text-sm text-gray-500">
              Manage tax rates applied to your invoices and quotes.
            </p>
          </div>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
            Add Tax Rate
          </Button>
        </div>

        {taxRates.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No tax rates configured yet. Click &quot;Add Tax Rate&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rate %</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Components</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxRates.map((rate) => {
                  const components: TaxComponent[] =
                    typeof rate.components === "string"
                      ? JSON.parse(rate.components as unknown as string)
                      : rate.components ?? [];
                  return (
                    <tr
                      key={rate.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openEditModal(rate)}
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">{rate.name}</td>
                      <td className="py-3 px-3 text-gray-600">{TAX_TYPE_LABELS[rate.type] ?? rate.type}</td>
                      <td className="py-3 px-3 text-right text-gray-900">{rate.rate}%</td>
                      <td className="py-3 px-3 text-gray-600">
                        {components.length > 0
                          ? components.map((c) => `${c.name} ${c.rate}%`).join(", ")
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {rate.isDefault ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">Yes</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {rate.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Active</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(rate);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(rate.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <TaxRateModal
          taxRate={editingRate}
          onClose={closeModal}
        />
      )}

      {/* Delete confirm modal */}
      <Modal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Tax Rate"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteTaxRate.isPending}
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this tax rate? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// ---------- Tax Rate Modal (Create / Edit) ----------

function TaxRateModal({ taxRate, onClose }: { taxRate: TaxRate | null; onClose: () => void }) {
  const isEditing = taxRate !== null;
  const createTaxRate = useCreateTaxRate();
  const updateTaxRate = useUpdateTaxRate(taxRate?.id ?? "");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TaxRateFormValues>({
    defaultValues: {
      name: taxRate?.name ?? "",
      type: taxRate?.type ?? "gst",
      rate: taxRate?.rate ?? 18,
      isDefault: taxRate?.isDefault ?? false,
    },
  });

  const selectedType = watch("type");
  const selectedRate = watch("rate");

  function generateComponents(type: string, rate: number): TaxComponent[] {
    if (type === "gst") {
      const halfRate = Math.round((rate / 2) * 100) / 100;
      return [
        { name: "CGST", rate: halfRate },
        { name: "SGST", rate: halfRate },
      ];
    }
    return [];
  }

  const previewComponents = generateComponents(selectedType, selectedRate);

  function onSubmit(values: TaxRateFormValues) {
    const components = generateComponents(values.type, values.rate);
    const payload: Record<string, unknown> = {
      name: values.name,
      type: values.type,
      rate: values.rate,
      isCompound: false,
      isDefault: values.isDefault,
      ...(components.length > 0 ? { components } : {}),
    };

    if (isEditing) {
      updateTaxRate.mutate(payload, { onSuccess: () => onClose() });
    } else {
      createTaxRate.mutate(payload, { onSuccess: () => onClose() });
    }
  }

  const isPending = isEditing ? updateTaxRate.isPending : createTaxRate.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? "Edit Tax Rate" : "Add Tax Rate"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isPending} onClick={handleSubmit(onSubmit)}>
            {isEditing ? "Save Changes" : "Create Tax Rate"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Name"
          required
          placeholder="e.g. GST 18%"
          error={errors.name?.message}
          {...register("name", { required: "Tax rate name is required" })}
        />

        <Select
          label="Type"
          required
          error={errors.type?.message}
          {...register("type")}
        >
          {TAX_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Input
          label="Rate (%)"
          type="number"
          required
          placeholder="18"
          step="0.01"
          min="0"
          max="100"
          error={errors.rate?.message}
          {...register("rate", {
            valueAsNumber: true,
            required: "Rate is required",
            min: { value: 0, message: "Rate must be 0 or greater" },
            max: { value: 100, message: "Rate cannot exceed 100" },
          })}
        />

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              {...register("isDefault")}
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
          </label>
          <span className="text-sm font-medium text-gray-700">Set as default tax rate</span>
        </div>

        {/* Components preview for GST */}
        {selectedType === "gst" && previewComponents.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-2">
            <p className="text-xs font-medium text-blue-800 uppercase tracking-wider">
              Auto-generated Components
            </p>
            <div className="space-y-1">
              {previewComponents.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-blue-700">
                  <span>{c.name}</span>
                  <span className="font-mono">{c.rate}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600">
              For GST, CGST and SGST are automatically split at half the total rate.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------- Payment Gateways Tab ----------

function GatewaysTab() {
  return (
    <div className="space-y-6">
      {/* Stripe */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Stripe</h2>
              <p className="text-sm text-gray-500">Accept cards, ACH, and more via Stripe</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Configured via environment variables</p>
            <p className="text-amber-700">
              Stripe credentials are managed through server environment variables for security.
              Set the following in your <code className="bg-amber-100 px-1 py-0.5 rounded text-xs font-mono">.env</code> file:
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Environment Variable</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-900 bg-gray-50">STRIPE_SECRET_KEY</td>
                <td className="py-2.5 px-4 text-gray-600">Your Stripe secret API key (starts with <code className="text-xs font-mono bg-gray-100 px-1 rounded">sk_</code>)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-mono text-xs text-gray-900 bg-gray-50">STRIPE_WEBHOOK_SECRET</td>
                <td className="py-2.5 px-4 text-gray-600">Webhook signing secret (starts with <code className="text-xs font-mono bg-gray-100 px-1 rounded">whsec_</code>)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">
            Get your API keys from{" "}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline">
              Stripe Dashboard
            </a>
          </span>
        </div>
      </section>

      {/* Razorpay */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Razorpay</h2>
              <p className="text-sm text-gray-500">Accept UPI, netbanking, cards, and wallets (India)</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Configured via environment variables</p>
            <p className="text-amber-700">
              Razorpay credentials are managed through server environment variables for security.
              Set the following in your <code className="bg-amber-100 px-1 py-0.5 rounded text-xs font-mono">.env</code> file:
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Environment Variable</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-900 bg-gray-50">RAZORPAY_KEY_ID</td>
                <td className="py-2.5 px-4 text-gray-600">Your Razorpay Key ID (starts with <code className="text-xs font-mono bg-gray-100 px-1 rounded">rzp_</code>)</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-900 bg-gray-50">RAZORPAY_KEY_SECRET</td>
                <td className="py-2.5 px-4 text-gray-600">Your Razorpay Key Secret</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-mono text-xs text-gray-900 bg-gray-50">RAZORPAY_WEBHOOK_SECRET</td>
                <td className="py-2.5 px-4 text-gray-600">Webhook secret for verifying Razorpay callbacks</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">
            Get your API keys from{" "}
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">
              Razorpay Dashboard
            </a>
          </span>
        </div>
      </section>
    </div>
  );
}

// ---------- Email Templates Tab ----------

const TEMPLATE_VARIABLES: Record<string, { name: string; desc: string }[]> = {
  "email-invoice": [
    { name: "org.name", desc: "Organization name" },
    { name: "invoice.invoiceNumber", desc: "Invoice number (e.g. INV-0001)" },
    { name: "invoice.issueDate", desc: "Date the invoice was issued" },
    { name: "invoice.dueDate", desc: "Payment due date" },
    { name: "invoice.total", desc: "Total amount (integer, in smallest currency unit)" },
    { name: "invoice.currency", desc: "Currency code (e.g. INR, USD)" },
    { name: "portalUrl", desc: "Base URL for the client portal" },
    { name: "invoiceId", desc: "Invoice ID (used in portal link)" },
  ],
  "email-quote": [
    { name: "org.name", desc: "Organization name" },
    { name: "quote.quoteNumber", desc: "Quote number (e.g. QTE-0001)" },
    { name: "quote.expiryDate", desc: "Quote expiry date" },
    { name: "quote.total", desc: "Total amount" },
    { name: "quote.currency", desc: "Currency code" },
    { name: "portalUrl", desc: "Base URL for the client portal" },
    { name: "quoteId", desc: "Quote ID (used in portal link)" },
  ],
  "email-payment-receipt": [
    { name: "org.name", desc: "Organization name" },
    { name: "payment.paymentNumber", desc: "Payment reference number" },
    { name: "payment.paymentDate", desc: "Date payment was received" },
    { name: "payment.method", desc: "Payment method (e.g. card, UPI, bank_transfer)" },
    { name: "payment.amount", desc: "Payment amount" },
    { name: "payment.currency", desc: "Currency code" },
    { name: "invoice.invoiceNumber", desc: "Related invoice number" },
  ],
  "email-payment-reminder": [
    { name: "org.name", desc: "Organization name" },
    { name: "invoice.invoiceNumber", desc: "Invoice number" },
    { name: "invoice.dueDate", desc: "Payment due date" },
    { name: "invoice.amountDue", desc: "Remaining amount due" },
    { name: "invoice.currency", desc: "Currency code" },
    { name: "daysOverdue", desc: "Number of days past due" },
    { name: "portalUrl", desc: "Base URL for the client portal" },
    { name: "invoiceId", desc: "Invoice ID (used in portal link)" },
  ],
};

const TEMPLATE_DISPLAY_NAMES: Record<string, string> = {
  "email-invoice": "Invoice",
  "email-quote": "Quote",
  "email-payment-receipt": "Payment Receipt",
  "email-payment-reminder": "Payment Reminder",
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "email-invoice": "Sent when an invoice is issued or emailed to a client.",
  "email-quote": "Sent when a quote/estimate is shared with a client.",
  "email-payment-receipt": "Sent after a payment is successfully recorded or received.",
  "email-payment-reminder": "Sent automatically before or after an invoice due date.",
};

function EmailTemplateCard({ template }: { template: EmailTemplate }) {
  const updateTemplate = useUpdateEmailTemplate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
  }, [template.subject, template.body]);

  const displayName = TEMPLATE_DISPLAY_NAMES[template.name] ?? template.name;
  const description = TEMPLATE_DESCRIPTIONS[template.name] ?? "";
  const variables = TEMPLATE_VARIABLES[template.name] ?? [];
  const hasChanges = subject !== template.subject || body !== template.body;

  function handleSave() {
    updateTemplate.mutate({ name: template.name, subject, body });
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{displayName}</span>
            <span className="text-xs text-gray-400 font-mono">{template.name}.hbs</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            Subject: <span className="font-mono text-gray-700">{subject}</span>
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Body (Handlebars HTML)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={15}
              className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {variables.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Available Variables
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {variables.map((v) => (
                  <div key={v.name} className="flex items-start gap-2 text-xs">
                    <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-indigo-700 shrink-0">
                      {`{{${v.name}}}`}
                    </code>
                    <span className="text-gray-500 pt-0.5">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Info className="h-3.5 w-3.5" />
            <span>
              Helper functions available: <code className="font-mono">formatDate</code>, <code className="font-mono">formatMoney</code>
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              loading={updateTemplate.isPending}
              disabled={!hasChanges}
            >
              Save Template
            </Button>
            {hasChanges && (
              <span className="text-xs text-amber-600">Unsaved changes</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmailTemplatesTab() {
  const { data, isLoading } = useEmailTemplates();
  const templates: EmailTemplate[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Email Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Email templates use Handlebars syntax. Click a template to edit its subject and body.
          </p>
        </div>

        <div className="space-y-3">
          {templates.map((template) => (
            <EmailTemplateCard key={template.name} template={template} />
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No email templates found.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------- Scheduled Reports Tab ----------

const REPORT_TYPE_OPTIONS = [
  { value: "revenue", label: "Revenue" },
  { value: "receivables", label: "Receivables" },
  { value: "expenses", label: "Expenses" },
  { value: "tax", label: "Tax" },
  { value: "profit_loss", label: "Profit & Loss" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function ScheduledReportsTab() {
  const { data, isLoading } = useScheduledReports();
  const createReport = useCreateScheduledReport();
  const deleteReport = useDeleteScheduledReport();
  const reports: ScheduledReport[] = (data?.data as ScheduledReport[] | undefined) ?? [];

  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);

  // Form state
  const [formReportType, setFormReportType] = useState("revenue");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formEmail, setFormEmail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  function openCreateModal() {
    setEditingReport(null);
    setFormReportType("revenue");
    setFormFrequency("daily");
    setFormEmail("");
    setFormIsActive(true);
    setShowModal(true);
  }

  function openEditModal(report: ScheduledReport) {
    setEditingReport(report);
    setFormReportType(report.reportType);
    setFormFrequency(report.frequency);
    setFormEmail(report.recipientEmail);
    setFormIsActive(report.isActive);
    setShowModal(true);
  }

  function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this scheduled report?")) {
      deleteReport.mutate(id);
    }
  }

  function formatDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return "Never";
    return new Date(String(dateStr)).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getReportTypeLabel(type: string): string {
    return REPORT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  }

  function getFrequencyLabel(freq: string): string {
    return FREQUENCY_OPTIONS.find((o) => o.value === freq)?.label ?? freq;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Scheduled Reports</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure automated email reports sent on a daily, weekly, or monthly schedule.
            </p>
          </div>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1" />
            Add Scheduled Report
          </Button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No scheduled reports yet</p>
            <p className="text-xs mt-1">Create one to receive automated report digests via email.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Report Type</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Frequency</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Recipient</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Active</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Last Sent</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Next Send</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">
                      {getReportTypeLabel(report.reportType)}
                    </td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {getFrequencyLabel(report.frequency)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">{report.recipientEmail}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          report.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {report.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-500 text-xs">
                      {formatDate(report.lastSentAt)}
                    </td>
                    <td className="py-3 px-2 text-gray-500 text-xs">
                      {formatDate(report.nextSendAt)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(report)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(report.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingReport ? "Edit Scheduled Report" : "Add Scheduled Report"}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Report Type</label>
            <select
              value={formReportType}
              onChange={(e) => setFormReportType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Frequency</label>
            <select
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Recipient Email</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="reports@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="scheduled-report-active"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="scheduled-report-active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            {editingReport ? (
              <ScheduledReportSaveButton
                reportId={editingReport.id}
                payload={{
                  reportType: formReportType,
                  frequency: formFrequency,
                  recipientEmail: formEmail,
                  isActive: formIsActive,
                }}
                onSuccess={() => setShowModal(false)}
              />
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  createReport.mutate(
                    {
                      reportType: formReportType,
                      frequency: formFrequency,
                      recipientEmail: formEmail,
                      isActive: formIsActive,
                    },
                    { onSuccess: () => setShowModal(false) },
                  );
                }}
                loading={createReport.isPending}
                disabled={!formEmail}
              >
                Create
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Helper component to handle the update hook (hooks must be called at component top level)
function ScheduledReportSaveButton({
  reportId,
  payload,
  onSuccess,
}: {
  reportId: string;
  payload: Record<string, unknown>;
  onSuccess: () => void;
}) {
  const updateReport = useUpdateScheduledReport(reportId);
  return (
    <Button
      size="sm"
      onClick={() => {
        updateReport.mutate(payload, { onSuccess });
      }}
      loading={updateReport.isPending}
      disabled={!payload.recipientEmail}
    >
      Save
    </Button>
  );
}

// ---------- Dunning Settings Tab ----------

function DunningSettingsTab() {
  const { data: configRes, isLoading } = useDunningConfig();
  const updateConfig = useUpdateDunningConfig();

  const config = configRes?.data;

  const [maxRetries, setMaxRetries] = useState(4);
  const [retryScheduleStr, setRetryScheduleStr] = useState("1, 3, 5, 7");
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [cancelAfterAllRetries, setCancelAfterAllRetries] = useState(true);
  const [sendReminderEmails, setSendReminderEmails] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setMaxRetries(config.maxRetries);
      const schedule = Array.isArray(config.retrySchedule)
        ? config.retrySchedule
        : [];
      setRetryScheduleStr(schedule.join(", "));
      setGracePeriodDays(config.gracePeriodDays);
      setCancelAfterAllRetries(config.cancelAfterAllRetries);
      setSendReminderEmails(config.sendReminderEmails);
      setInitialized(true);
    }
  }, [config, initialized]);

  const handleSave = () => {
    const retrySchedule = retryScheduleStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    updateConfig.mutate({
      maxRetries,
      retrySchedule,
      gracePeriodDays,
      cancelAfterAllRetries,
      sendReminderEmails,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Dunning Configuration</h3>
        <p className="text-xs text-gray-500">
          Configure how failed payment retries are handled for overdue invoices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Retries
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxRetries}
            onChange={(e) => setMaxRetries(parseInt(e.target.value, 10) || 4)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Number of times to retry a failed payment
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Grace Period (days)
          </label>
          <input
            type="number"
            min={0}
            max={30}
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10) || 3)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Days before marking subscription past due
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Retry Schedule (days after failure)
        </label>
        <input
          type="text"
          value={retryScheduleStr}
          onChange={(e) => setRetryScheduleStr(e.target.value)}
          placeholder="1, 3, 5, 7"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Comma-separated list of days. E.g. "1, 3, 5, 7" means retry on day 1, 3, 5, and 7.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setCancelAfterAllRetries((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              cancelAfterAllRetries ? "bg-brand-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                cancelAfterAllRetries ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">Cancel subscription after all retries fail</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setSendReminderEmails((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              sendReminderEmails ? "bg-brand-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                sendReminderEmails ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">Send reminder emails on retry</span>
        </label>
      </div>

      <div className="pt-2">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? "Saving..." : "Save Dunning Config"}
        </Button>
      </div>
    </div>
  );
}

// ---------- Custom Domains Tab ----------

function DomainsTab() {
  const { data, isLoading } = useListDomains();
  const addDomain = useAddDomain();
  const removeDomain = useRemoveDomain();
  const verifyDomain = useVerifyDomain();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const domains: CustomDomain[] = data?.data ?? [];

  function handleAdd() {
    if (!newDomain.trim()) return;
    addDomain.mutate({ domain: newDomain.trim().toLowerCase() }, {
      onSuccess: () => {
        setNewDomain("");
        setShowAddModal(false);
      },
    });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Custom Domains</h3>
          <p className="text-xs text-gray-500">
            Point your own subdomain to your billing portal. Add a CNAME record pointing your subdomain to{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">billing.empcloud.com</code>
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Domain
        </Button>
      </div>

      {domains.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No custom domains configured. Click "Add Domain" to get started.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-sm font-medium text-gray-900">{d.domain}</span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-xs ${d.verified ? "text-green-600" : "text-amber-600"}`}>
                      {d.verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {d.verified ? "DNS Verified" : "Unverified"}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs ${d.sslProvisioned ? "text-green-600" : "text-gray-400"}`}>
                      <ShieldCheck className="h-3 w-3" />
                      {d.sslProvisioned ? "SSL Active" : "SSL Pending"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verifyDomain.mutate(d.id)}
                  disabled={verifyDomain.isPending}
                >
                  {verifyDomain.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Remove domain "${d.domain}"?`)) {
                      removeDomain.mutate(d.id);
                    }
                  }}
                  disabled={removeDomain.isPending}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 space-y-1">
            <p className="font-medium">How to set up a custom domain:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.)</li>
              <li>Add a <strong>CNAME</strong> record for your subdomain pointing to <code className="bg-blue-100 px-1 rounded">billing.empcloud.com</code></li>
              <li>Come back here and click "Verify" to confirm DNS propagation</li>
              <li>SSL will be provisioned automatically once DNS is verified</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Add Domain Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Custom Domain">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <Input
              placeholder="billing.yourdomain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the subdomain you want to use (e.g. billing.example.com)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addDomain.isPending || !newDomain.trim()}>
              {addDomain.isPending ? "Adding..." : "Add Domain"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- API Keys Tab ----------

function ApiKeysTab() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [showRawKey, setShowRawKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const keys: ApiKey[] = data?.data ?? [];

  function handleCreate() {
    const scopes = newKeyScopes.trim()
      ? newKeyScopes.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    createKey.mutate(
      {
        name: newKeyName,
        scopes,
        expiresAt: newKeyExpiry || undefined,
      },
      {
        onSuccess: (res) => {
          const result = res.data;
          if (result?.rawKey) {
            setCreatedRawKey(result.rawKey);
            setShowRawKey(true);
          }
          setNewKeyName("");
          setNewKeyScopes("");
          setNewKeyExpiry("");
        },
      }
    );
  }

  function handleCopy() {
    if (createdRawKey) {
      navigator.clipboard.writeText(createdRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreatedRawKey(null);
    setShowRawKey(false);
    setCopied(false);
    setNewKeyName("");
    setNewKeyScopes("");
    setNewKeyExpiry("");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">API Keys</h2>
            <p className="text-sm text-gray-500 mt-1">
              Create API keys for server-to-server integrations. Keys use the <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Authorization: Bearer empb_live_...</code> header.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create API Key
          </Button>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Key className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No API keys yet</p>
            <p className="text-xs mt-1">Create one to enable server-to-server API access</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Key Prefix</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Scopes</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Last Used</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Expires</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{k.name}</td>
                    <td className="py-2.5 px-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{k.keyPrefix}...</code>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {k.scopes && k.scopes.length > 0
                        ? k.scopes.join(", ")
                        : <span className="text-gray-400">All</span>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString()
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {k.expiresAt
                        ? new Date(k.expiresAt).toLocaleDateString()
                        : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      {k.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle className="h-3 w-3" /> Revoked
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {k.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("Revoke this API key? This cannot be undone.")) {
                              revokeKey.mutate(k.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create API Key Modal */}
      <Modal open={showCreateModal} onClose={closeCreateModal} title={createdRawKey ? "API Key Created" : "Create API Key"}>
        {createdRawKey ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Save this key now</p>
                  <p className="mt-1">This is the only time you will see the full API key. Store it securely.</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gray-900 text-green-400 font-mono text-sm p-3 rounded-lg pr-20 break-all">
                {showRawKey ? createdRawKey : createdRawKey.slice(0, 12) + "..." + "*".repeat(20)}
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => setShowRawKey(!showRawKey)}
                  className="p-1.5 text-gray-400 hover:text-white rounded"
                  title={showRawKey ? "Hide" : "Show"}
                >
                  {showRawKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-gray-400 hover:text-white rounded"
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            {copied && <p className="text-xs text-green-600 font-medium">Copied to clipboard</p>}
            <div className="flex justify-end">
              <Button onClick={closeCreateModal}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <Input
                placeholder="e.g. Production Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scopes (optional)</label>
              <Input
                placeholder="e.g. invoices:read, payments:write"
                value={newKeyScopes}
                onChange={(e) => setNewKeyScopes(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated. Leave empty for full access.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
              <Input
                type="date"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCreateModal}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createKey.isPending || !newKeyName.trim()}>
                {createKey.isPending ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------- Main Settings Page ----------

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("organization");

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Settings" subtitle="Manage your organization settings" />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "organization" && <OrganizationTab />}
      {tab === "numbering" && <NumberingTab />}
      {tab === "branding" && <BrandingTab />}
      {tab === "tax-rates" && <TaxRatesTab />}
      {tab === "gateways" && <GatewaysTab />}
      {tab === "email" && <EmailTemplatesTab />}
      {tab === "scheduled-reports" && <ScheduledReportsTab />}
      {tab === "dunning" && <DunningSettingsTab />}
      {tab === "domains" && <DomainsTab />}
      {tab === "api-keys" && <ApiKeysTab />}
    </div>
  );
}
