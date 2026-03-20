"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_1 = require("./config/index");
const logger_1 = require("./utils/logger");
const index_2 = require("./db/adapters/index");
const error_middleware_1 = require("./api/middleware/error.middleware");
const rate_limit_middleware_1 = require("./api/middleware/rate-limit.middleware");
const upload_routes_1 = require("./api/routes/upload.routes");
const gateway_routes_1 = require("./api/routes/gateway.routes");
const index_3 = require("./services/payment/gateways/index");
const auth_routes_1 = require("./api/routes/auth.routes");
const org_routes_1 = require("./api/routes/org.routes");
const client_routes_1 = require("./api/routes/client.routes");
const product_routes_1 = require("./api/routes/product.routes");
const invoice_routes_1 = require("./api/routes/invoice.routes");
const quote_routes_1 = require("./api/routes/quote.routes");
const payment_routes_1 = require("./api/routes/payment.routes");
const credit_note_routes_1 = require("./api/routes/credit-note.routes");
const vendor_routes_1 = require("./api/routes/vendor.routes");
const expense_routes_1 = require("./api/routes/expense.routes");
const recurring_routes_1 = require("./api/routes/recurring.routes");
const report_routes_1 = require("./api/routes/report.routes");
const dispute_routes_1 = require("./api/routes/dispute.routes");
const portal_routes_1 = require("./api/routes/portal.routes");
const webhook_routes_1 = require("./api/routes/webhook.routes");
const settings_routes_1 = require("./api/routes/settings.routes");
const currency_routes_1 = require("./api/routes/currency.routes");
const search_routes_1 = require("./api/routes/search.routes");
const notification_routes_1 = require("./api/routes/notification.routes");
const scheduled_report_routes_1 = require("./api/routes/scheduled-report.routes");
const subscription_routes_1 = require("./api/routes/subscription.routes");
const usage_routes_1 = require("./api/routes/usage.routes");
const coupon_routes_1 = require("./api/routes/coupon.routes");
const dunning_routes_1 = require("./api/routes/dunning.routes");
const metrics_routes_1 = require("./api/routes/metrics.routes");
const listeners_1 = require("./events/listeners");
const index_4 = require("./jobs/index");
const swagger_1 = require("./api/docs/swagger");
const app = (0, express_1.default)();
exports.app = app;
// ── Global middleware ─────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: index_1.config.corsOrigin, credentials: true }));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)(index_1.config.env === "production" ? "combined" : "dev"));
// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "emp-billing", version: "0.1.0", env: index_1.config.env });
});
// ── Static file serving for uploads ──────────────────────────────────────────
app.use("/uploads", express_1.default.static(index_1.config.upload.uploadDir));
// ── API Documentation (Swagger UI) ──────────────────────────────────────────
(0, swagger_1.setupSwagger)(app);
// ── Gateway webhooks — raw body needed, no auth ─────────────────────────────
app.use("/webhooks/gateway", gateway_routes_1.gatewayRoutes);
// ── API v1 ────────────────────────────────────────────────────────────────────
const v1 = express_1.default.Router();
v1.use((0, rate_limit_middleware_1.rateLimit)());
v1.use("/auth", auth_routes_1.authRoutes);
v1.use("/organizations", org_routes_1.orgRoutes);
v1.use("/clients", client_routes_1.clientRoutes);
v1.use("/products", product_routes_1.productRoutes);
v1.use("/invoices", invoice_routes_1.invoiceRoutes);
v1.use("/quotes", quote_routes_1.quoteRoutes);
v1.use("/payments", payment_routes_1.paymentRoutes);
v1.use("/credit-notes", credit_note_routes_1.creditNoteRoutes);
v1.use("/vendors", vendor_routes_1.vendorRoutes);
v1.use("/expenses", expense_routes_1.expenseRoutes);
v1.use("/recurring", recurring_routes_1.recurringRoutes);
v1.use("/reports", report_routes_1.reportRoutes);
v1.use("/disputes", dispute_routes_1.disputeRoutes);
v1.use("/portal", portal_routes_1.portalRoutes);
v1.use("/webhooks", webhook_routes_1.webhookRoutes);
v1.use("/settings", settings_routes_1.settingsRoutes);
v1.use("/currency", currency_routes_1.currencyRoutes);
v1.use("/uploads", upload_routes_1.uploadRoutes);
v1.use("/search", search_routes_1.searchRoutes);
v1.use("/notifications", notification_routes_1.notificationRoutes);
v1.use("/scheduled-reports", scheduled_report_routes_1.scheduledReportRoutes);
v1.use("/subscriptions", subscription_routes_1.subscriptionRoutes);
v1.use("/usage", usage_routes_1.usageRoutes);
v1.use("/coupons", coupon_routes_1.couponRoutes);
v1.use("/dunning", dunning_routes_1.dunningRoutes);
v1.use("/metrics", metrics_routes_1.metricsRoutes);
app.use("/api/v1", v1);
// ── Error handler for API routes ─────────────────────────────────────────────
app.use(error_middleware_1.errorMiddleware);
// ── Serve client SPA in production ──────────────────────────────────────────
const path_1 = __importDefault(require("path"));
if (index_1.config.env === "production") {
    const clientDist = path_1.default.resolve(__dirname, "../../../../client/dist");
    app.use(express_1.default.static(clientDist));
    app.use((_req, res) => {
        res.sendFile(path_1.default.join(clientDist, "index.html"));
    });
}
// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await (0, index_2.getDB)(); // connect + verify
        (0, listeners_1.registerListeners)(); // wire up event system
        (0, index_3.initializeGateways)(); // register configured payment gateways
        await (0, index_4.startWorkers)(); // start BullMQ workers + scheduled jobs
        app.listen(index_1.config.port, () => {
            logger_1.logger.info(`emp-billing server running on http://localhost:${index_1.config.port} [${index_1.config.env}]`);
        });
    }
    catch (err) {
        logger_1.logger.error("Failed to start server", { err });
        process.exit(1);
    }
}
bootstrap();
// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
    logger_1.logger.info(`${signal} received — shutting down gracefully`);
    await (0, index_2.closeDB)();
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
//# sourceMappingURL=index.js.map