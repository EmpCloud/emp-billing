"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayments = listPayments;
exports.getPayment = getPayment;
exports.recordPayment = recordPayment;
exports.refundPayment = refundPayment;
exports.deletePayment = deletePayment;
exports.getPaymentReceiptPdf = getPaymentReceiptPdf;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const pdf_1 = require("../../utils/pdf");
// ============================================================================
// PAYMENT SERVICE
// ============================================================================
// ── List ─────────────────────────────────────────────────────────────────────
async function listPayments(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId, is_refund: false };
    if (opts.clientId)
        where.client_id = opts.clientId;
    if (opts.method)
        where.method = opts.method;
    const result = await db.findPaginated("payments", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "date", direction: "desc" }],
    });
    let data = result.data;
    if (opts.from || opts.to) {
        data = data.filter((p) => {
            const d = new Date(p.date);
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    return { ...result, data };
}
// ── Get ───────────────────────────────────────────────────────────────────────
async function getPayment(orgId, id) {
    const db = await (0, index_1.getDB)();
    const payment = await db.findById("payments", id, orgId);
    if (!payment)
        throw (0, AppError_1.NotFoundError)("Payment");
    return payment;
}
// ── Record ────────────────────────────────────────────────────────────────────
async function recordPayment(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", input.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    let invoiceToAllocate = null;
    if (input.invoiceId) {
        invoiceToAllocate = await db.findById("invoices", input.invoiceId, orgId);
        if (!invoiceToAllocate)
            throw (0, AppError_1.NotFoundError)("Invoice");
        if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF].includes(invoiceToAllocate.status)) {
            throw (0, AppError_1.BadRequestError)("Cannot record payment against a voided or written-off invoice");
        }
    }
    const paymentNumber = await generatePaymentNumber(orgId);
    const paymentId = (0, uuid_1.v4)();
    const now = new Date();
    // Store the full amount paid on the payment record
    const payment = await db.create("payments", {
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
    let creditNote;
    // Allocate to invoice
    if (invoiceToAllocate && input.invoiceId) {
        const amountDue = invoiceToAllocate.amountDue;
        const allocatedAmount = Math.min(input.amount, amountDue);
        const overpayment = input.amount - allocatedAmount;
        await db.create("payment_allocations", {
            id: (0, uuid_1.v4)(),
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
        const newStatus = newAmountDue === 0
            ? shared_1.InvoiceStatus.PAID
            : shared_1.InvoiceStatus.PARTIALLY_PAID;
        await db.update("invoices", input.invoiceId, {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            paidAt: newStatus === shared_1.InvoiceStatus.PAID ? now : null,
            updatedAt: now,
        }, orgId);
        // If there is an overpayment, create a credit note for the excess
        if (overpayment > 0) {
            const creditNoteNumber = await generateCreditNoteNumber(orgId);
            const creditNoteId = (0, uuid_1.v4)();
            creditNote = await db.create("credit_notes", {
                id: creditNoteId,
                orgId,
                clientId: input.clientId,
                creditNoteNumber,
                status: shared_1.CreditNoteStatus.OPEN,
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
                id: (0, uuid_1.v4)(),
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
    await db.update("clients", input.clientId, {
        totalPaid: await db.increment("clients", input.clientId, "total_paid", input.amount),
        outstandingBalance: await db.increment("clients", input.clientId, "outstanding_balance", -input.amount),
        updatedAt: now,
    }, orgId);
    return { ...payment, creditNote };
}
// ── Refund ────────────────────────────────────────────────────────────────────
async function refundPayment(orgId, paymentId, userId, input) {
    const db = await (0, index_1.getDB)();
    const payment = await db.findById("payments", paymentId, orgId);
    if (!payment)
        throw (0, AppError_1.NotFoundError)("Payment");
    if (payment.isRefund)
        throw (0, AppError_1.BadRequestError)("Cannot refund a refund");
    const alreadyRefunded = payment.refundedAmount ?? 0;
    const maxRefund = payment.amount - alreadyRefunded;
    if (input.amount > maxRefund) {
        throw (0, AppError_1.BadRequestError)(`Refund amount exceeds refundable balance of ${maxRefund}`);
    }
    const now = new Date();
    const refundNumber = await generatePaymentNumber(orgId);
    const refundId = (0, uuid_1.v4)();
    const refund = await db.create("payments", {
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
    await db.update("clients", payment.clientId, {
        totalPaid: await db.increment("clients", payment.clientId, "total_paid", -input.amount),
        outstandingBalance: await db.increment("clients", payment.clientId, "outstanding_balance", input.amount),
        updatedAt: now,
    }, orgId);
    return refund;
}
// ── Delete ────────────────────────────────────────────────────────────────────
async function deletePayment(orgId, id) {
    const db = await (0, index_1.getDB)();
    const payment = await db.findById("payments", id, orgId);
    if (!payment)
        throw (0, AppError_1.NotFoundError)("Payment");
    if (payment.isRefund)
        throw (0, AppError_1.BadRequestError)("Cannot delete a refund record directly");
    // Reverse allocations
    const allocations = await db.findMany("payment_allocations", { where: { payment_id: id } });
    for (const alloc of allocations) {
        const invoice = await db.findById("invoices", alloc.invoiceId);
        if (invoice) {
            const newAmountPaid = Math.max(0, invoice.amountPaid - alloc.amount);
            const newAmountDue = invoice.total - newAmountPaid;
            const newStatus = newAmountPaid === 0
                ? shared_1.InvoiceStatus.SENT
                : shared_1.InvoiceStatus.PARTIALLY_PAID;
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
    await db.update("clients", payment.clientId, {
        totalPaid: await db.increment("clients", payment.clientId, "total_paid", -payment.amount),
        outstandingBalance: await db.increment("clients", payment.clientId, "outstanding_balance", payment.amount),
        updatedAt: new Date(),
    }, orgId);
    await db.delete("payments", id, orgId);
}
// ── Helpers ───────────────────────────────────────────────────────────────────
async function generatePaymentNumber(orgId) {
    const db = await (0, index_1.getDB)();
    const count = await db.count("payments", { org_id: orgId });
    const year = new Date().getFullYear();
    return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
}
async function generateCreditNoteNumber(orgId) {
    const db = await (0, index_1.getDB)();
    const count = await db.count("credit_notes", { org_id: orgId });
    const year = new Date().getFullYear();
    return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}
// ── Receipt PDF ──────────────────────────────────────────────────────────────
async function getPaymentReceiptPdf(orgId, id) {
    const db = await (0, index_1.getDB)();
    const payment = await getPayment(orgId, id);
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const client = await db.findById("clients", payment.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Parse JSON fields
    if (typeof org.address === "string")
        org.address = JSON.parse(org.address);
    if (typeof client.billingAddress === "string")
        client.billingAddress = JSON.parse(client.billingAddress);
    if (typeof org.brandColors === "string")
        org.brandColors = JSON.parse(org.brandColors);
    // Optionally fetch the linked invoice
    let invoice;
    if (payment.invoiceId) {
        const inv = await db.findById("invoices", payment.invoiceId, orgId);
        if (inv)
            invoice = inv;
    }
    return (0, pdf_1.generateReceiptPdf)({ payment: payment, org, client, invoice });
}
//# sourceMappingURL=payment.service.js.map