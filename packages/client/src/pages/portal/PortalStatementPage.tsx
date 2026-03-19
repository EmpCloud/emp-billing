import { useState } from "react";
import { Calendar } from "lucide-react";
import { usePortalStatement } from "@/api/hooks/portal.hooks";
import { Spinner } from "@/components/common/Spinner";
import { formatMoney } from "@emp-billing/shared";
import dayjs from "dayjs";

export function PortalStatementPage() {
  const [from, setFrom] = useState(() =>
    dayjs().startOf("year").format("YYYY-MM-DD")
  );
  const [to, setTo] = useState(() =>
    dayjs().format("YYYY-MM-DD")
  );

  const { data: res, isLoading } = usePortalStatement(from, to);

  const statement = res?.data as {
    entries: Array<{
      date: string;
      type: string;
      number: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    openingBalance: number;
    closingBalance: number;
    currency: string;
  } | undefined;

  return (
    <div className="space-y-6">
      {/* Header with date filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">Statement</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="stmt-from" className="text-xs font-medium text-gray-500">From</label>
            <input
              id="stmt-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="stmt-to" className="text-xs font-medium text-gray-500">To</label>
            <input
              id="stmt-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Statement table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" className="text-brand-600" />
        </div>
      ) : !statement || statement.entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No transactions found for the selected period</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Reference #</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Debit</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Credit</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Opening Balance */}
                <tr className="bg-gray-50/50">
                  <td colSpan={5} className="px-5 py-3 font-medium text-gray-700">
                    Opening Balance
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">
                    {formatMoney(statement.openingBalance, statement.currency)}
                  </td>
                </tr>

                {/* Entries */}
                {statement.entries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-600">
                      {dayjs(entry.date).format("DD MMM YYYY")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={
                        entry.type === "invoice"
                          ? "text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-medium"
                          : entry.type === "payment"
                            ? "text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium"
                            : "text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium"
                      }>
                        {entry.type === "invoice" ? "Invoice" : entry.type === "payment" ? "Payment" : "Credit Note"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-800 font-medium">{entry.number}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">
                      {entry.debit > 0 ? formatMoney(entry.debit, statement.currency) : "\u2014"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">
                      {entry.credit > 0 ? formatMoney(entry.credit, statement.currency) : "\u2014"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">
                      {formatMoney(entry.balance, statement.currency)}
                    </td>
                  </tr>
                ))}

                {/* Closing Balance */}
                <tr className="bg-gray-50/50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-5 py-3 font-semibold text-gray-800">
                    Closing Balance
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatMoney(statement.closingBalance, statement.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
