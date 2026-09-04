import {
  ClientPaymentStatus,
  InvoiceStatus,
  type ClientPaymentSummary,
  type Invoice,
} from "@emp-billing/shared";
import dayjs from "dayjs";

const OUTSTANDING_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIALLY_PAID,
]);
const OVERDUE_ELIGIBLE_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
]);
const IGNORED_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.DRAFT,
  InvoiceStatus.VOID,
  InvoiceStatus.WRITTEN_OFF,
]);

function dateValue(value: Date): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isBeforeCalendarDay(value: Date, nowMs: number): boolean {
  return dayjs(value).format("YYYY-MM-DD") < dayjs(nowMs).format("YYYY-MM-DD");
}

export function summarizeClientInvoices(
  clientId: string,
  invoices: Invoice[],
  nowMs: number = Date.now(),
): ClientPaymentSummary {
  const relevantInvoices = invoices.filter(
    (invoice) => !IGNORED_STATUSES.has(invoice.status),
  );
  if (relevantInvoices.length === 0) {
    return {
      clientId,
      status: ClientPaymentStatus.NO_INVOICE,
      outstandingByCurrency: [],
      overdueInvoiceCount: 0,
      unpaidInvoiceCount: 0,
      latestInvoice: null,
    };
  }

  const latest = [...relevantInvoices].sort(
    (a, b) => dateValue(b.issueDate) - dateValue(a.issueDate),
  )[0];
  const outstanding = relevantInvoices.filter(
    (invoice) =>
      OUTSTANDING_STATUSES.has(invoice.status) &&
      (Number(invoice.amountDue) || 0) > 0,
  );
  const overdue = outstanding.filter(
    (invoice) =>
      invoice.status === InvoiceStatus.OVERDUE ||
      (OVERDUE_ELIGIBLE_STATUSES.has(invoice.status) &&
        isBeforeCalendarDay(invoice.dueDate, nowMs)),
  );
  const byCurrency = new Map<string, number>();
  for (const invoice of outstanding) {
    const currency = String(invoice.currency || "INR").toUpperCase();
    byCurrency.set(
      currency,
      (byCurrency.get(currency) ?? 0) + (Number(invoice.amountDue) || 0),
    );
  }

  return {
    clientId,
    status: overdue.length > 0
      ? ClientPaymentStatus.OVERDUE
      : outstanding.length > 0
        ? ClientPaymentStatus.UNPAID
        : ClientPaymentStatus.PAID,
    outstandingByCurrency: Array.from(byCurrency)
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    overdueInvoiceCount: overdue.length,
    unpaidInvoiceCount: outstanding.length,
    latestInvoice: {
      id: latest.id,
      invoiceNumber: latest.invoiceNumber,
      status: latest.status,
      amountDue: Number(latest.amountDue) || 0,
      total: Number(latest.total) || 0,
      currency: latest.currency,
      issueDate: latest.issueDate,
      dueDate: latest.dueDate,
    },
  };
}
