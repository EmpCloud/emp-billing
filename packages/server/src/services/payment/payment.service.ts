import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { InvoiceStatus, PaymentMethod, CreditNoteStatus } from "@emp-billing/shared";
import { generateReceiptPdf } from "../../utils/pdf";
import { emit } from "../../events/index";
import type { Payment, Invoice, CreditNote } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreatePaymentSchema, PaymentFilterSchema, RefundSchema } from "@emp-billing/shared";

// ============================================================================
// PAYMENT SERVICE
// ============================================================================

// ── List ─────────────────────────────────────────────────────────────────────

export async function listPayments(orgId: string, opts: z.infer<typeof PaymentFilterSchema>) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId, is_refund: false };
  if (opts.clientId) where.client_id = opts.clientId;
  if (opts.method) where.method = opts.method;

  const result = await db.findPaginated<Payment>("payments", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "date", direction: "desc" }],
  });

  let data = result.data;
  if (opts.from || opts.to) {
    data = data.filter((p) => {
      const d = new Date(p.date);
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  return { ...result, data };
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getPayment(orgId: string, id: string): Promise<Payment> {
  const db = await getDB();
  const payment = await db.findById<Payment>("payments", id, orgId);
  if (!payment) throw NotFoundError("Payment");
  return payment;
}

// ── Record ────────────────────────────────────────────────────────────────────

export async function recordPayment(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreatePaymentSchema>
): Promise<Payment & { creditNote?: CreditNote }> {
  const db = await getDB();

  const client = await db.findById("clients", input.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  let invoiceToAllocate: Invoice | null = null;

  if (input.invoiceId) {
    invoiceToAllocate = await db.findById<Invoice>("invoices", input.invoiceId, orgId);
    if (!invoiceToAllocate) throw NotFoundError("Invoice");

    if ([InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF].includes(invoiceToAllocate.status)) {
      throw BadRequestError("Cannot record payment against a voided or written-off invoice");
    }
  }

  const paymentNumber = await generatePaymentNumber(orgId);
  const paymentId = uuid();
  const now = new Date();

  // Store the full amount paid on the payment record
  const payment = await db.create<Payment>("payments", {
    id: paymentId,
    orgId,
    clientId: input.clientId,
    paymentNumber,
    date: input.date,
    amount: input.amount,
    method: input.method,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    isRefund: false,
    refundedAmount: 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  let creditNote: CreditNote | undefined;

  // Allocate to invoice
  if (invoiceToAllocate && input.invoiceId) {
    const amountDue = invoiceToAllocate.amountDue;
    const allocatedAmount = Math.min(input.amount, amountDue);
    const overpayment = input.amount - allocatedAmount;

    await db.create("payment_allocations", {
      id: uuid(),
      paymentId,
      invoiceId: input.invoiceId,
      orgId,
      amount: allocatedAmount,
      createdAt: now,
      updatedAt: now,
    });

    // Update invoice
    const newAmountPaid = invoiceToAllocate.amountPaid + allocatedAmount;
    const newAmountDue = Math.max(0, invoiceToAllocate.total - newAmountPaid);
    const newStatus =
      newAmountDue === 0
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    await db.update("invoices", input.invoiceId, {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newStatus,
      paidAt: newStatus === InvoiceStatus.PAID ? now : null,
      updatedAt: now,
    }, orgId);

    // If there is an overpayment, create a credit note for the excess
    if (overpayment > 0) {
      const creditNoteNumber = await generateCreditNoteNumber(orgId);
      const creditNoteId = uuid();

      creditNote = await db.create<CreditNote>("credit_notes", {
        id: creditNoteId,
        orgId,
        clientId: input.clientId,
        creditNoteNumber,
        status: CreditNoteStatus.OPEN,
        date: now,
        subtotal: overpayment,
        taxAmount: 0,
        total: overpayment,
        balance: overpayment,
        reason: `Overpayment credit from payment ${paymentNumber}`,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      // Create a single credit note item for the overpayment
      await db.create("credit_note_items", {
        id: uuid(),
        creditNoteId,
        orgId,
        name: "Overpayment credit",
        description: `Excess from payment ${paymentNumber} against invoice`,
        quantity: 1,
        rate: overpayment,
        discountAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: overpayment,
        sortOrder: 0,
      });
    }
  }

  // Update client balances
  await db.increment("clients", input.clientId, "total_paid", input.amount);
  await db.increment("clients", input.clientId, "outstanding_balance", -input.amount);
  await db.update("clients", input.clientId, { updatedAt: now }, orgId);

  // Emit payment.received event
  emit("payment.received", {
    orgId,
    paymentId,
    payment: payment as unknown as Record<string, unknown>,
    invoiceId: input.invoiceId,
  });

  // Emit invoice.paid if invoice is now fully paid
  if (invoiceToAllocate && input.invoiceId) {
    const updatedInvoice = await db.findById<Invoice>("invoices", input.invoiceId, orgId);
    if (updatedInvoice && updatedInvoice.status === InvoiceStatus.PAID) {
      emit("invoice.paid", {
        orgId,
        invoiceId: input.invoiceId,
        invoice: updatedInvoice as unknown as Record<string, unknown>,
      });
    }
  }

  return { ...payment, creditNote };
}

// ── Refund ────────────────────────────────────────────────────────────────────

export async function refundPayment(
  orgId: string,
  paymentId: string,
  userId: string,
  input: z.infer<typeof RefundSchema>
): Promise<Payment> {
  const db = await getDB();

  const payment = await db.findById<Payment>("payments", paymentId, orgId);
  if (!payment) throw NotFoundError("Payment");
  if (payment.isRefund) throw BadRequestError("Cannot refund a refund");

  const alreadyRefunded = payment.refundedAmount ?? 0;
  const maxRefund = payment.amount - alreadyRefunded;
  if (input.amount > maxRefund) {
    throw BadRequestError(`Refund amount exceeds refundable balance of ${maxRefund}`);
  }

  const now = new Date();
  const refundNumber = await generatePaymentNumber(orgId);
  const refundId = uuid();

  const refund = await db.create<Payment>("payments", {
    id: refundId,
    orgId,
    clientId: payment.clientId,
    paymentNumber: refundNumber,
    date: now,
    amount: input.amount,
    method: payment.method,
    notes: input.reason ?? `Refund for ${payment.paymentNumber}`,
    isRefund: true,
    refundedAmount: 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Update original payment refunded amount
  await db.update("payments", paymentId, {
    refundedAmount: alreadyRefunded + input.amount,
    updatedAt: now,
  }, orgId);

  // Reverse client balances
  await db.increment("clients", payment.clientId, "total_paid", -input.amount);
  await db.increment("clients", payment.clientId, "outstanding_balance", input.amount);
  await db.update("clients", payment.clientId, { updatedAt: now }, orgId);

  return refund;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePayment(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const payment = await db.findById<Payment>("payments", id, orgId);
  if (!payment) throw NotFoundError("Payment");
  if (payment.isRefund) throw BadRequestError("Cannot delete a refund record directly");

  // Reverse allocations
  const allocations = await db.findMany<{ invoiceId: string; amount: number }>(
    "payment_allocations",
    { where: { payment_id: id } }
  );

  for (const alloc of allocations) {
    const invoice = await db.findById<Invoice>("invoices", alloc.invoiceId);
    if (invoice) {
      const newAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
      const newAmountDue = invoice.total - newAmountPaid;
      const newStatus =
        newAmountPaid === 0
          ? InvoiceStatus.SENT
          : InvoiceStatus.PARTIALLY_PAID;

      await db.update("invoices", alloc.invoiceId, {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        paidAt: null,
        updatedAt: new Date(),
      }, orgId);
    }
  }

  await db.deleteMany("payment_allocations", { payment_id: id });

  // Reverse client
  await db.increment("clients", payment.clientId, "total_paid", -payment.amount);
  await db.increment("clients", payment.clientId, "outstanding_balance", payment.amount);
  await db.update("clients", payment.clientId, { updatedAt: new Date() }, orgId);

  await db.delete("payments", id, orgId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generatePaymentNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const count = await db.count("payments", { org_id: orgId });
  const year = new Date().getFullYear();
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function generateCreditNoteNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const count = await db.count("credit_notes", { org_id: orgId });
  const year = new Date().getFullYear();
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── Receipt PDF ──────────────────────────────────────────────────────────────

export async function getPaymentReceiptPdf(orgId: string, id: string): Promise<Buffer> {
  const db = await getDB();
  const payment = await getPayment(orgId, id);
  const org = await db.findById<Record<string, unknown>>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");
  const client = await db.findById<Record<string, unknown>>("clients", payment.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON fields
  if (typeof org.address === "string") org.address = JSON.parse(org.address);
  if (typeof client.billingAddress === "string") client.billingAddress = JSON.parse(client.billingAddress);
  if (typeof org.brandColors === "string") org.brandColors = JSON.parse(org.brandColors);

  // Optionally fetch the linked invoice
  let invoice: Record<string, unknown> | undefined;
  if (payment.invoiceId) {
    const inv = await db.findById<Record<string, unknown>>("invoices", payment.invoiceId, orgId);
    if (inv) invoice = inv;
  }

  // Derive currency from invoice, org, or default to INR
  const currency = (invoice?.currency as string)
    ?? (org.defaultCurrency as string)
    ?? "INR";

  // Map payment fields to the names expected by the receipt template
  const paymentData: Record<string, unknown> = {
    ...(payment as unknown as Record<string, unknown>),
    paymentDate: payment.date,
    referenceNumber: payment.reference ?? null,
    currency,
  };

  return generateReceiptPdf({ payment: paymentData, org, client, invoice });
}
