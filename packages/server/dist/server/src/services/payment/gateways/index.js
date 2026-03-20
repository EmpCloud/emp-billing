"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalGateway = exports.RazorpayGateway = exports.StripeGateway = void 0;
exports.registerGateway = registerGateway;
exports.getGateway = getGateway;
exports.listGateways = listGateways;
exports.initializeGateways = initializeGateways;
const logger_1 = require("../../../utils/logger");
const config_1 = require("../../../config");
const stripe_gateway_1 = require("./stripe.gateway");
const razorpay_gateway_1 = require("./razorpay.gateway");
const paypal_gateway_1 = require("./paypal.gateway");
// ── Gateway Registry ────────────────────────────────────────────────────────
const gateways = new Map();
/**
 * Register a payment gateway in the registry.
 * Overwrites any existing gateway with the same name.
 */
function registerGateway(gateway) {
    gateways.set(gateway.name, gateway);
    logger_1.logger.info(`Payment gateway registered: ${gateway.displayName} (${gateway.name})`);
}
/**
 * Retrieve a registered payment gateway by name.
 * @throws Error if the gateway is not registered.
 */
function getGateway(name) {
    const gateway = gateways.get(name);
    if (!gateway) {
        throw new Error(`Payment gateway "${name}" is not registered. ` +
            `Available gateways: ${[...gateways.keys()].join(", ") || "(none)"}`);
    }
    return gateway;
}
/**
 * List all registered payment gateways.
 */
function listGateways() {
    return [...gateways.values()];
}
/**
 * Read environment configuration and initialize all configured gateways.
 * Call this once at application startup.
 */
function initializeGateways() {
    const configured = [];
    // Stripe
    if (config_1.config.gateways.stripe.secretKey) {
        const stripe = new stripe_gateway_1.StripeGateway({
            secretKey: config_1.config.gateways.stripe.secretKey,
            webhookSecret: config_1.config.gateways.stripe.webhookSecret,
        });
        registerGateway(stripe);
        configured.push("Stripe");
    }
    // Razorpay
    if (config_1.config.gateways.razorpay.keyId) {
        const razorpay = new razorpay_gateway_1.RazorpayGateway({
            keyId: config_1.config.gateways.razorpay.keyId,
            keySecret: config_1.config.gateways.razorpay.keySecret,
            webhookSecret: config_1.config.gateways.razorpay.webhookSecret,
        });
        registerGateway(razorpay);
        configured.push("Razorpay");
    }
    // PayPal
    if (config_1.config.gateways.paypal.clientId) {
        const paypal = new paypal_gateway_1.PayPalGateway({
            clientId: config_1.config.gateways.paypal.clientId,
            clientSecret: config_1.config.gateways.paypal.clientSecret,
            webhookId: config_1.config.gateways.paypal.webhookId,
            sandbox: config_1.config.gateways.paypal.sandbox,
        });
        registerGateway(paypal);
        configured.push("PayPal");
    }
    if (configured.length === 0) {
        logger_1.logger.warn("No payment gateways configured. Set STRIPE_SECRET_KEY, RAZORPAY_KEY_ID, or PAYPAL_CLIENT_ID in env.");
    }
    else {
        logger_1.logger.info(`Payment gateways initialized: ${configured.join(", ")}`);
    }
}
var stripe_gateway_2 = require("./stripe.gateway");
Object.defineProperty(exports, "StripeGateway", { enumerable: true, get: function () { return stripe_gateway_2.StripeGateway; } });
var razorpay_gateway_2 = require("./razorpay.gateway");
Object.defineProperty(exports, "RazorpayGateway", { enumerable: true, get: function () { return razorpay_gateway_2.RazorpayGateway; } });
var paypal_gateway_2 = require("./paypal.gateway");
Object.defineProperty(exports, "PayPalGateway", { enumerable: true, get: function () { return paypal_gateway_2.PayPalGateway; } });
//# sourceMappingURL=index.js.map