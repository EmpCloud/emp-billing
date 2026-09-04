import { describe, expect, it } from "vitest";
import { InvoiceStatus, type Invoice } from "@emp-billing/shared";
import { summarizeClientInvoices } from "./payment-summary";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "invoice-1",
    orgId: "billing-org-1",
    clientId: "client-1",
    invoiceNumber: "INV-001",
    status: InvoiceStatus.PAID,
    issueDate: new Date("2026-07-01T00:00:00Z"),
    dueDate: new Date("2026-07-31T00:00:00Z"),
    currency: "INR",
    exchangeRate: 1,
    items: [],
    subtotal: 100_000,
    discountAmount: 0,
    taxAmount: 0,
    total: 100_000,
    amountPaid: 100_000,
    amountDue: 0,
    tdsAmount: 0,
    createdBy: "user-1",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

describe("client payment summaries", () => {
  it("reports complete overdue and outstanding totals without mixing currencies", () => {
    const result = summarizeClientInvoices(
      "client-1",
      [
        invoice({}),
        invoice({
          id: "invoice-2",
          invoiceNumber: "INV-002",
          status: InvoiceStatus.SENT,
          issueDate: new Date("2026-08-01T00:00:00Z"),
          dueDate: new Date("2026-08-31T00:00:00Z"),
          total: 400_000,
          amountPaid: 0,
          amountDue: 400_000,
        }),
        invoice({
          id: "invoice-3",
          invoiceNumber: "INV-003",
          status: InvoiceStatus.PARTIALLY_PAID,
          issueDate: new Date("2026-09-01T00:00:00Z"),
          dueDate: new Date("2026-09-30T00:00:00Z"),
          currency: "USD",
          total: 5_000,
          amountPaid: 2_500,
          amountDue: 2_500,
        }),
        invoice({
          id: "invoice-void",
          status: InvoiceStatus.VOID,
          issueDate: new Date("2026-09-03T00:00:00Z"),
          amountDue: 0,
        }),
      ],
      new Date("2026-09-04T00:00:00Z").getTime(),
    );

    expect(result).toEqual({
      clientId: "client-1",
      status: "overdue",
      outstandingByCurrency: [
        { currency: "INR", amount: 400_000 },
        { currency: "USD", amount: 2_500 },
      ],
      overdueInvoiceCount: 1,
      unpaidInvoiceCount: 2,
      latestInvoice: {
        id: "invoice-3",
        invoiceNumber: "INV-003",
        status: InvoiceStatus.PARTIALLY_PAID,
        amountDue: 2_500,
        total: 5_000,
        currency: "USD",
        issueDate: new Date("2026-09-01T00:00:00Z"),
        dueDate: new Date("2026-09-30T00:00:00Z"),
      },
    });
  });

  it("distinguishes clients with no issued invoices from fully paid clients", () => {
    expect(summarizeClientInvoices("empty-client", [invoice({
      clientId: "empty-client",
      status: InvoiceStatus.DRAFT,
      amountPaid: 0,
      amountDue: 10_000,
    })])).toMatchObject({
      clientId: "empty-client",
      status: "no_invoice",
      unpaidInvoiceCount: 0,
      latestInvoice: null,
    });

    expect(summarizeClientInvoices("paid-client", [invoice({ clientId: "paid-client" })])).toMatchObject({
      clientId: "paid-client",
      status: "paid",
      unpaidInvoiceCount: 0,
    });
  });

  it("does not mark an invoice overdue until the day after its due date", () => {
    const result = summarizeClientInvoices(
      "client-1",
      [invoice({
        status: InvoiceStatus.SENT,
        amountPaid: 0,
        amountDue: 10_000,
        dueDate: new Date("2026-09-04T00:00:00Z"),
      })],
      new Date("2026-09-04T18:00:00Z").getTime(),
    );

    expect(result.status).toBe("unpaid");
    expect(result.overdueInvoiceCount).toBe(0);
  });
});
