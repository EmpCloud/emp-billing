"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayGateway = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../utils/logger");
class RazorpayGateway {
    name = "razorpay";
    displayName = "Razorpay";
    razorpay;
    keySecret;
    webhookSecret;
    constructor(config) {
        this.razorpay = new razorpay_1.default({
            key_id: config.keyId,
            key_secret: config.keySecret,
        });
        this.keySecret = config.keySecret;
        this.webhookSecret = config.webhookSecret;
        logger_1.logger.info("Razorpay payment gateway initialized");
    }
    async createOrder(input) {
        const order = (await this.razorpay.orders.create({
            amount: input.amount,
            currency: input.currency.toUpperCase(),
            receipt: input.invoiceNumber,
            notes: {
                invoiceId: input.invoiceId,
                invoiceNumber: input.invoiceNumber,
                clientName: input.clientName,
                clientEmail: input.clientEmail,
                ...(input.metadata || {}),
            },
        }));
        logger_1.logger.info(`Razorpay order created: ${order.id} for invoice ${input.invoiceNumber}`);
        return {
            gatewayOrderId: order.id,
            // No checkoutUrl — Razorpay uses client-side SDK for checkout UI
            metadata: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
            },
        };
    }
    async verifyPayment(input) {
        const expectedSignature = crypto_1.default
            .createHmac("sha256", this.keySecret)
            .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
            .digest("hex");
        const verified = expectedSignature === input.gatewaySignature;
        logger_1.logger.info(`Razorpay payment verification for order ${input.gatewayOrderId}: ` +
            `verified=${verified}, paymentId=${input.gatewayPaymentId}`);
        if (!verified) {
            return {
                verified: false,
                gatewayTransactionId: input.gatewayPaymentId,
                amount: 0,
                currency: "",
                status: "failed",
                metadata: {
                    reason: "Signature verification failed",
                },
            };
        }
        // Fetch payment details from Razorpay to get amount and currency
        const payment = (await this.razorpay.payments.fetch(input.gatewayPaymentId));
        return {
            verified: true,
            gatewayTransactionId: input.gatewayPaymentId,
            amount: payment.amount,
            currency: payment.currency,
            status: "success",
            metadata: {
                method: payment.method,
                email: payment.email,
                orderId: input.gatewayOrderId,
            },
        };
    }
    async chargeCustomer(input) {
        try {
            // Razorpay recurring charges use the Subscriptions API or the
            // Payment Links / Emandate flow. For saved tokens we create a
            // recurring payment via the payments.createRecurringPayment endpoint.
            const paymentData = {
                email: input.metadata?.clientEmail || "customer@example.com",
                contact: input.metadata?.clientPhone || "",
                amount: input.amount,
                currency: input.currency.toUpperCase(),
                order_id: undefined,
                token: input.paymentMethodId,
                recurring: "1",
                description: input.description || `Payment for invoice ${input.invoiceNumber}`,
                notes: {
                    invoiceId: input.invoiceId,
                    invoiceNumber: input.invoiceNumber,
                    ...(input.metadata || {}),
                },
            };
            // First create an order, then charge against it with the saved token
            const order = (await this.razorpay.orders.create({
                amount: input.amount,
                currency: input.currency.toUpperCase(),
                receipt: input.invoiceNumber,
                notes: {
                    invoiceId: input.invoiceId,
                    invoiceNumber: input.invoiceNumber,
                    ...(input.metadata || {}),
                },
            }));
            paymentData.order_id = order.id;
            const payment = (await this.razorpay.payments
                .createRecurringPayment(paymentData));
            const success = payment.status === "captured";
            logger_1.logger.info(`Razorpay chargeCustomer for invoice ${input.invoiceNumber}: ` +
                `status=${payment.status}, paymentId=${payment.id}`);
            return {
                success,
                gatewayTransactionId: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                error: success ? undefined : `Payment status: ${payment.status}`,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Razorpay charge failed";
            logger_1.logger.error("Razorpay chargeCustomer failed", { error: message, invoiceId: input.invoiceId });
            return {
                success: false,
                gatewayTransactionId: "",
                amount: input.amount,
                currency: input.currency.toUpperCase(),
                error: message,
            };
        }
    }
    async refund(input) {
        try {
            const refund = (await this.razorpay.payments.refund(input.gatewayTransactionId, {
                amount: input.amount,
                notes: {
                    reason: input.reason || "Refund requested",
                },
            }));
            logger_1.logger.info(`Razorpay refund created: ${refund.id}, amount=${input.amount}, ` +
                `status=${refund.status}`);
            const statusMap = {
                processed: "success",
                pending: "pending",
                failed: "failed",
            };
            return {
                gatewayRefundId: refund.id,
                amount: refund.amount,
                status: statusMap[refund.status] || "pending",
            };
        }
        catch (error) {
            logger_1.logger.error("Razorpay refund failed", error);
            return {
                gatewayRefundId: "",
                amount: input.amount,
                status: "failed",
            };
        }
    }
    async handleWebhook(payload) {
        // Verify webhook signature
        const expectedSignature = crypto_1.default
            .createHmac("sha256", this.webhookSecret)
            .update(payload.rawBody)
            .digest("hex");
        const receivedSignature = payload.headers["x-razorpay-signature"];
        if (expectedSignature !== receivedSignature) {
            logger_1.logger.warn("Razorpay webhook signature verification failed");
            throw new Error("Invalid webhook signature");
        }
        const body = payload.body;
        const event = body.event;
        logger_1.logger.info(`Razorpay webhook received: ${event}`);
        switch (event) {
            case "payment.captured": {
                const payment = body.payload.payment.entity;
                return {
                    event: "payment.completed",
                    gatewayTransactionId: payment.id,
                    gatewayOrderId: payment.order_id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: "success",
                    metadata: {
                        method: payment.method,
                        email: payment.email,
                    },
                };
            }
            case "payment.failed": {
                const payment = body.payload.payment.entity;
                return {
                    event: "payment.failed",
                    gatewayTransactionId: payment.id,
                    gatewayOrderId: payment.order_id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: "failed",
                    metadata: {
                        method: payment.method,
                        email: payment.email,
                    },
                };
            }
            case "refund.created": {
                const refund = body.payload.refund.entity;
                return {
                    event: "payment.refunded",
                    gatewayTransactionId: refund.payment_id,
                    amount: refund.amount,
                    currency: refund.currency,
                    status: "refunded",
                    metadata: {
                        refundId: refund.id,
                        refundStatus: refund.status,
                    },
                };
            }
            default:
                logger_1.logger.warn(`Unhandled Razorpay webhook event: ${event}`);
                return {
                    event,
                    gatewayTransactionId: "",
                    amount: 0,
                    currency: "",
                    status: "pending",
                    metadata: { raw: body },
                };
        }
    }
}
exports.RazorpayGateway = RazorpayGateway;
//# sourceMappingURL=razorpay.gateway.js.map