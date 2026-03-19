import { clsx } from "clsx";
import { InvoiceStatus, QuoteStatus, PaymentMethod, DisputeStatus, SubscriptionStatus } from "@emp-billing/shared";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "gray";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  const variants = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger:  "bg-red-100 text-red-800",
    info:    "bg-blue-100 text-blue-800",
    purple:  "bg-brand-100 text-brand-800",
    gray:    "bg-gray-100 text-gray-600",
  };
  const sizes = { sm: "px-1.5 py-0.5 text-xs", md: "px-2 py-1 text-xs" };

  return (
    <span className={clsx("inline-flex items-center font-medium rounded-full", variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}

// Invoice status badge
const INVOICE_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  [InvoiceStatus.DRAFT]:         { label: "Draft",          variant: "gray" },
  [InvoiceStatus.SENT]:          { label: "Sent",           variant: "info" },
  [InvoiceStatus.VIEWED]:        { label: "Viewed",         variant: "purple" },
  [InvoiceStatus.PARTIALLY_PAID]:{ label: "Partial",        variant: "warning" },
  [InvoiceStatus.PAID]:          { label: "Paid",           variant: "success" },
  [InvoiceStatus.OVERDUE]:       { label: "Overdue",        variant: "danger" },
  [InvoiceStatus.VOID]:          { label: "Void",           variant: "gray" },
  [InvoiceStatus.WRITTEN_OFF]:   { label: "Written Off",    variant: "gray" },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = INVOICE_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Quote status badge
const QUOTE_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  [QuoteStatus.DRAFT]:     { label: "Draft",     variant: "gray" },
  [QuoteStatus.SENT]:      { label: "Sent",      variant: "info" },
  [QuoteStatus.VIEWED]:    { label: "Viewed",    variant: "purple" },
  [QuoteStatus.ACCEPTED]:  { label: "Accepted",  variant: "success" },
  [QuoteStatus.DECLINED]:  { label: "Declined",  variant: "danger" },
  [QuoteStatus.EXPIRED]:   { label: "Expired",   variant: "warning" },
  [QuoteStatus.CONVERTED]: { label: "Converted", variant: "success" },
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const cfg = QUOTE_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Dispute status badge
const DISPUTE_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  [DisputeStatus.OPEN]:         { label: "Open",          variant: "warning" },
  [DisputeStatus.UNDER_REVIEW]: { label: "Under Review",  variant: "info" },
  [DisputeStatus.RESOLVED]:     { label: "Resolved",      variant: "success" },
  [DisputeStatus.CLOSED]:       { label: "Closed",        variant: "gray" },
};

export function DisputeStatusBadge({ status }: { status: string }) {
  const cfg = DISPUTE_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Subscription status badge
const SUBSCRIPTION_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  [SubscriptionStatus.TRIALING]:  { label: "Trialing",  variant: "purple" },
  [SubscriptionStatus.ACTIVE]:    { label: "Active",    variant: "success" },
  [SubscriptionStatus.PAUSED]:    { label: "Paused",    variant: "warning" },
  [SubscriptionStatus.PAST_DUE]:  { label: "Past Due",  variant: "danger" },
  [SubscriptionStatus.CANCELLED]: { label: "Cancelled", variant: "gray" },
  [SubscriptionStatus.EXPIRED]:   { label: "Expired",   variant: "gray" },
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const cfg = SUBSCRIPTION_STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
