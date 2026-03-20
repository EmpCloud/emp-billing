"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAvailableGateways = listAvailableGateways;
exports.createPaymentOrder = createPaymentOrder;
exports.verifyPayment = verifyPayment;
exports.handleGatewayWebhook = handleGatewayWebhook;
exports.chargeSubscriptionRenewal = chargeSubscriptionRenewal;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const index_2 = require("./gateways/index");
const logger_1 = require("../../utils/logger");
// ============================================================================
// ONLINE PAYMENT SERVICE
// Handles gateway-based payments: create order, verify, and webhooks.
// ============================================================================
// ── List available gateways ─────────────────────────────────────────────────
function listAvailableGateways() {
    return (0, index_2.listGateways)().map((gw) => ({
        name: gw.name,
        displayName: gw.displayName,
    }));
}
// ── Create payment order ────────────────────────────────────────────────────
async function createPaymentOrder(orgId, invoiceId, gatewayName) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF, shared_1.InvoiceStatus.PAID].includes(invoice.status)) {
        throw (0, AppError_1.BadRequestError)(`Cannot create payment for invoice with status '${invoice.status}'.`);
    }
    if (invoice.amountDue <= 0) {
        throw (0, AppError_1.BadRequestError)("Invoice has no outstanding balance.");
    }
    const client = await db.findById("clients", invoice.clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    const gateway = (0, index_2.getGateway)(gatewayName);
    const result = await gateway.createOrder({
        amount: invoice.amountDue,
        currency: invoice.currency,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: client.email,
        clientName: client.name,
        description: `Payment for invoice ${invoice.invoiceNumber}`,
        metadata: {
            orgId,
            invoiceId: invoice.id,
            clientId: client.id,
        },
    });
    return result;
}
// ── Verify payment ──────────────────────────────────────────────────────────
async function verifyPayment(orgId, invoiceId, gatewayName, payload) {
    const db = await (0, index_1.getDB)();
    const gateway = (0, index_2.getGateway)(gatewayName);
    const verification = await gateway.verifyPayment({
        gatewayOrderId: payload.gatewayOrderId,
        gatewayPaymentId: payload.gatewayPaymentId,
        gatewaySignature: payload.gatewaySignature,
    });
    if (!verification.verified || verification.status !== "success") {
        throw (0, AppError_1.BadRequestError)("Payment verification failed.");
    }
    // Record the payment
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    const paymentMethod = gatewayName === "stripe"
        ? shared_1.PaymentMethod.GATEWAY_STRIPE
        : gatewayName === "razorpay"
            ? shared_1.PaymentMethod.GATEWAY_RAZORPAY
            : shared_1.PaymentMethod.OTHER;
    const payment = await recordGatewayPayment(db, orgId, invoice, verification.amount, paymentMethod, verification.gatewayTransactionId);
    return payment;
}
// ── Handle gateway webhook ──────────────────────────────────────────────────
async function handleGatewayWebhook(gatewayName, headers, body, rawBody) {
    const gateway = (0, index_2.getGateway)(gatewayName);
    let result;
    try {
        result = await gateway.handleWebhook({ headers, body, rawBody });
    }
    catch (err) {
        logger_1.logger.error(`Webhook processing failed for ${gatewayName}`, { err });
        throw (0, AppError_1.BadRequestError)("Webhook signature verification failed.");
    }
    logger_1.logger.info(`Webhook received: ${gatewayName} event=${result.event} status=${result.status}`, {
        gatewayTransactionId: result.gatewayTransactionId,
        gatewayOrderId: result.gatewayOrderId,
        amount: result.amount,
        currency: result.currency,
    });
    if (result.status === "success" && result.metadata?.invoiceId && result.metadata?.orgId) {
        const orgId = result.metadata.orgId;
        const invoiceId = result.metadata.invoiceId;
        try {
            const db = await (0, index_1.getDB)();
            const invoice = await db.findById("invoices", invoiceId, orgId);
            if (invoice && invoice.amountDue > 0) {
                const paymentMethod = gatewayName === "stripe"
                    ? shared_1.PaymentMethod.GATEWAY_STRIPE
                    : gatewayName === "razorpay"
                        ? shared_1.PaymentMethod.GATEWAY_RAZORPAY
                        : shared_1.PaymentMethod.OTHER;
                await recordGatewayPayment(db, orgId, invoice, result.amount, paymentMethod, result.gatewayTransactionId);
                logger_1.logger.info(`Webhook payment recorded for invoice ${invoice.invoiceNumber}`, {
                    invoiceId,
                    amount: result.amount,
                });
            }
        }
        catch (err) {
            logger_1.logger.error("Failed to process webhook payment", { err, gatewayName, invoiceId });
        }
    }
    else if (result.status === "failed") {
        logger_1.logger.warn(`Payment failed via ${gatewayName} webhook`, {
            event: result.event,
            gatewayTransactionId: result.gatewayTransactionId,
        });
    }
    return { acknowledged: true };
}
// ── Charge subscription renewal ─────────────────────────────────────────────
async function chargeSubscriptionRenewal(orgId, invoiceId, clientId) {
    const db = await (0, index_1.getDB)();
    // Look up the client's saved payment method
    const client = await db.findById("clients", clientId, orgId);
    if (!client) {
        return { success: false, error: "Client not found" };
    }
    if (!client.paymentGateway || !client.paymentMethodId) {
        return { success: false, error: "No saved payment method" };
    }
    // Look up the invoice to get amount and currency
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice) {
        return { success: false, error: "Invoice not found" };
    }
    if (invoice.amountDue <= 0) {
        return { success: false, error: "Invoice has no outstanding balance" };
    }
    // Get the gateway and charge
    let gateway;
    try {
        gateway = (0, index_2.getGateway)(client.paymentGateway);
    }
    catch {
        return { success: false, error: `Payment gateway "${client.paymentGateway}" is not configured` };
    }
    const chargeResult = await gateway.chargeCustomer({
        paymentMethodId: client.paymentMethodId,
        amount: invoice.amountDue,
        currency: invoice.currency,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        description: `Subscription renewal - ${invoice.invoiceNumber}`,
        metadata: {
            orgId,
            invoiceId: invoice.id,
            clientId: client.id,
        },
    });
    if (!chargeResult.success) {
        logger_1.logger.warn("Subscription renewal charge failed", {
            invoiceId,
            clientId,
            gateway: client.paymentGateway,
            error: chargeResult.error,
        });
        return { success: false, error: chargeResult.error };
    }
    // Record the payment using existing pattern
    const paymentMethod = client.paymentGateway === "stripe"
        ? shared_1.PaymentMethod.GATEWAY_STRIPE
        : client.paymentGateway === "razorpay"
            ? shared_1.PaymentMethod.GATEWAY_RAZORPAY
            : shared_1.PaymentMethod.OTHER;
    const payment = await recordGatewayPayment(db, orgId, invoice, chargeResult.amount, paymentMethod, chargeResult.gatewayTransactionId);
    logger_1.logger.info("Subscription renewal charge succeeded", {
        invoiceId,
        clientId,
        paymentId: payment.id,
        amount: chargeResult.amount,
        gateway: client.paymentGateway,
    });
    return { success: true, paymentId: payment.id };
}
// ── Internal helper: record gateway payment ─────────────────────────────────
async function recordGatewayPayment(db, orgId, invoice, amount, method, gatewayTransactionId) {
    const now = new Date();
    const paymentId = (0, uuid_1.v4)();
    // Generate payment number
    const count = await db.count("payments", { org_id: orgId });
    const year = now.getFullYear();
    const paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
    // Create payment record
    const payment = await db.create("payments", {
        id: paymentId,
        orgId,
        clientId: invoice.clientId,
        paymentNumber,
        date: now,
        amount,
        method,
        reference: null,
        gatewayTransactionId,
        notes: `Online payment via ${method}`,
        isRefund: false,
        refundedAmount: 0,
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
    });
    // Create payment allocation
    await db.create("payment_allocations", {
        id: (0, uuid_1.v4)(),
        paymentId,
        invoiceId: invoice.id,
        orgId,
        amount,
        createdAt: now,
        updatedAt: now,
    });
    // Update invoice
    const newAmountPaid = invoice.amountPaid + amount;
    const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newAmountDue === 0 ? shared_1.InvoiceStatus.PAID : shared_1.InvoiceStatus.PARTIALLY_PAID;
    await db.update("invoices", invoice.id, {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        paidAt: newStatus === shared_1.InvoiceStatus.PAID ? now : null,
        updatedAt: now,
    }, orgId);
    // Update client balances
    await db.update("clients", invoice.clientId, {
        totalPaid: await db.increment("clients", invoice.clientId, "total_paid", amount),
        outstandingBalance: await db.increment("clients", invoice.clientId, "outstanding_balance", -amount),
        updatedAt: now,
    }, orgId);
    return payment;
}
//# sourceMappingURL=online-payment.service.js.map