import { useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, FileText, DollarSign, TrendingUp, Mail, Phone, MapPin, Hash, Calendar, Tag, CreditCard } from "lucide-react";
import dayjs from "dayjs";
import { formatMoney } from "@emp-billing/shared";
import toast from "react-hot-toast";
import { useClient, useClientBalance, useClientStatement } from "@/api/hooks/client.hooks";
import { useInvoices } from "@/api/hooks/invoice.hooks";
import { apiDelete } from "@/api/client";
import { Button } from "@/components/common/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatsCard } from "@/components/common/StatsCard";
import { InvoiceStatusBadge } from "@/components/common/Badge";
import { Spinner } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

export function ClientDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [statementFrom, setStatementFrom] = useState(() =>
    dayjs().startOf("year").format("YYYY-MM-DD")
  );
  const [statementTo, setStatementTo] = useState(() =>
    dayjs().format("YYYY-MM-DD")
  );

  const queryClient = useQueryClient();
  const { data: clientData, isLoading: clientLoading } = useClient(id);
  const { data: balanceData } = useClientBalance(id);
  const { data: invoicesData } = useInvoices({ clientId: id, limit: 10 });
  const { data: statementData, isLoading: statementLoading } = useClientStatement(id, statementFrom, statementTo);

  const handleRemovePaymentMethod = useCallback(async () => {
    if (!window.confirm("Remove saved payment method for this client?")) return;
    try {
      await apiDelete(`/clients/${id}/payment-method`);
      toast.success("Payment method removed");
      queryClient.invalidateQueries({ queryKey: ["clients", id] });
    } catch {
      toast.error("Failed to remove payment method");
    }
  }, [id, queryClient]);

  const client = clientData?.data;
  const balance = balanceData?.data as {
    outstanding: number;
    totalBilled: number;
    totalPaid: number;
    currency: string;
  } | undefined;
  const invoices = invoicesData?.data ?? [];
  const currency = client?.currency ?? "INR";

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <EmptyState title="Client not found" description="This client may have been deleted." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={client.displayName || client.name}
        subtitle={client.email}
        breadcrumb={[{ label: "Clients", href: "/clients" }, { label: client.displayName || client.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/clients/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(`/invoices/new?clientId=${id}`)}
            >
              New Invoice
            </Button>
          </div>
        }
      />

      {/* Balance Stats */}
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            label="Outstanding"
            value={formatMoney(balance.outstanding, currency)}
            icon={<DollarSign className="h-5 w-5" />}
            color={balance.outstanding > 0 ? "yellow" : "green"}
          />
          <StatsCard
            label="Total Billed"
            value={formatMoney(balance.totalBilled, currency)}
            icon={<TrendingUp className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            label="Total Paid"
            value={formatMoney(balance.totalPaid, currency)}
            icon={<FileText className="h-5 w-5" />}
            color="green"
          />
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Contact Information</h2>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
            </li>
            {client.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {client.phone}
              </li>
            )}
            {client.taxId && (
              <li className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">GSTIN:</span>
                <span className="font-mono">{client.taxId}</span>
              </li>
            )}
          </ul>
        </div>

        {/* Billing Address */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Billing Address</h2>
          {client.billingAddress ? (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <address className="not-italic leading-relaxed">
                {client.billingAddress.line1}
                {client.billingAddress.line2 && <><br />{client.billingAddress.line2}</>}
                <br />
                {client.billingAddress.city}, {client.billingAddress.state} {client.billingAddress.postalCode}
                <br />
                {client.billingAddress.country}
              </address>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No billing address on file.</p>
          )}
        </div>
      </div>

      {/* Tags */}
      {client.tags && client.tags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" />
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {client.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Payment Method</h3>
        {client.paymentGateway && client.paymentMethodLast4 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {client.paymentMethodBrand || "Card"} &bull;&bull;&bull;&bull; {client.paymentMethodLast4}
                </p>
                <p className="text-xs text-gray-500 capitalize">via {client.paymentGateway}</p>
              </div>
            </div>
            <button
              className="text-sm text-red-500 hover:text-red-700"
              onClick={handleRemovePaymentMethod}
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No payment method saved</p>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Recent Invoices</h2>
          <Link to={`/invoices?clientId=${id}`} className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Create the first invoice for this client."
            action={{ label: "New Invoice", onClick: () => navigate(`/invoices/new?clientId=${id}`) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-brand-600">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{dayjs(inv.issueDate).format("DD MMM YYYY")}</td>
                    <td className="px-4 py-3 text-gray-600">{dayjs(inv.dueDate).format("DD MMM YYYY")}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statement */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            Statement
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="stmt-from" className="text-xs font-medium text-gray-500">From</label>
              <input
                id="stmt-from"
                type="date"
                value={statementFrom}
                onChange={(e) => setStatementFrom(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="stmt-to" className="text-xs font-medium text-gray-500">To</label>
              <input
                id="stmt-to"
                type="date"
                value={statementTo}
                onChange={(e) => setStatementTo(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {statementLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (() => {
          const statement = statementData?.data as {
            entries: Array<{ date: string; type: string; number: string; description: string; debit: number; credit: number; balance: number }>;
            openingBalance: number;
            closingBalance: number;
            currency: string;
          } | undefined;

          if (!statement || statement.entries.length === 0) {
            return (
              <EmptyState
                title="No transactions"
                description="No invoices or payments found for the selected period."
              />
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Debit</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Credit</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Opening Balance */}
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-500" colSpan={5}>
                      <span className="font-medium">Opening Balance</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {formatMoney(statement.openingBalance, statement.currency)}
                    </td>
                  </tr>

                  {/* Entries */}
                  {statement.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{dayjs(entry.date).format("DD MMM YYYY")}</td>
                      <td className="px-4 py-3 text-gray-800">{entry.description}</td>
                      <td className="px-4 py-3">
                        <span className={
                          entry.type === "invoice"
                            ? "inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                            : entry.type === "payment"
                            ? "inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                            : "inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
                        }>
                          {entry.type === "credit_note" ? "Credit Note" : entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {entry.debit > 0 ? formatMoney(entry.debit, statement.currency) : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {entry.credit > 0 ? formatMoney(entry.credit, statement.currency) : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {formatMoney(entry.balance, statement.currency)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Balance */}
                  <tr className="bg-gray-50/50 border-t-2 border-gray-200">
                    <td className="px-4 py-3 text-gray-700" colSpan={5}>
                      <span className="font-semibold">Closing Balance</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatMoney(statement.closingBalance, statement.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}
    </div>
  );
}
