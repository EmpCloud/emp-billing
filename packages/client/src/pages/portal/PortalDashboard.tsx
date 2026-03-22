import { Link } from "react-router-dom";
import { FileText, CreditCard, Receipt } from "lucide-react";
import { usePortalDashboard } from "@/api/hooks/portal.hooks";
import { usePortalStore } from "@/store/portal.store";
import { usePortalBranding } from "@/api/hooks/portal-branding.hooks";
import { StatsCard } from "@/components/common/StatsCard";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney } from "@emp-billing/shared";
import dayjs from "dayjs";
import type { Invoice, Payment } from "@emp-billing/shared";

export function PortalDashboard() {
  const { clientName, orgName: storeOrgName } = usePortalStore();
  const { data: branding } = usePortalBranding();
  const orgName = storeOrgName || branding?.orgName || "EMP Billing";
  const { data: res, isLoading } = usePortalDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    );
  }

  const dashboard = res?.data as {
    outstandingBalance: number;
    currency: string;
    recentInvoices: Invoice[];
    recentPayments: Payment[];
    pendingQuotesCount: number;
  } | undefined;

  const currency = dashboard?.currency ?? "INR";

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Welcome{clientName ? `, ${clientName}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {orgName} &middot; {dayjs().format("dddd, D MMMM YYYY")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          label="Outstanding Balance"
          value={formatMoney(dashboard?.outstandingBalance ?? 0, currency)}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          label="Recent Payments"
          value={String(dashboard?.recentPayments?.length ?? 0)}
          icon={<CreditCard className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          label="Pending Quotes"
          value={String(dashboard?.pendingQuotesCount ?? 0)}
          icon={<Receipt className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Recent sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Recent Invoices</h2>
            <Link to="/portal/invoices" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {!dashboard?.recentInvoices?.length ? (
              <p className="py-10 text-center text-sm text-gray-400">No invoices yet</p>
            ) : (
              dashboard.recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Due {dayjs(inv.dueDate).format("DD MMM YYYY")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatMoney(inv.total, inv.currency)}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Recent Payments</h2>
            <Link to="/portal/payments" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {!dashboard?.recentPayments?.length ? (
              <p className="py-10 text-center text-sm text-gray-400">No payments yet</p>
            ) : (
              dashboard.recentPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pay.paymentNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {String(pay.method).replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      +{formatMoney(pay.amount, currency)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {dayjs(pay.date).format("DD MMM YYYY")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
