import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import { config } from "./config/index";
import { logger } from "./utils/logger";
import { getDB, closeDB } from "./db/adapters/index";
import { errorMiddleware } from "./api/middleware/error.middleware";
import { rateLimit } from "./api/middleware/rate-limit.middleware";
import { authenticate } from "./api/middleware/auth.middleware";

import { uploadRoutes } from "./api/routes/upload.routes";
import { gatewayRoutes } from "./api/routes/gateway.routes";
import { initializeGateways } from "./services/payment/gateways/index";
import { authRoutes } from "./api/routes/auth.routes";
import { orgRoutes } from "./api/routes/org.routes";
import { clientRoutes } from "./api/routes/client.routes";
import { productRoutes } from "./api/routes/product.routes";
import { invoiceRoutes } from "./api/routes/invoice.routes";
import { quoteRoutes } from "./api/routes/quote.routes";
import { paymentRoutes } from "./api/routes/payment.routes";
import { creditNoteRoutes } from "./api/routes/credit-note.routes";
import { vendorRoutes } from "./api/routes/vendor.routes";
import { expenseRoutes } from "./api/routes/expense.routes";
import { recurringRoutes } from "./api/routes/recurring.routes";
import { reportRoutes } from "./api/routes/report.routes";
import { disputeRoutes } from "./api/routes/dispute.routes";
import { portalRoutes } from "./api/routes/portal.routes";
import { webhookRoutes } from "./api/routes/webhook.routes";
import { settingsRoutes } from "./api/routes/settings.routes";
import { currencyRoutes } from "./api/routes/currency.routes";
import { searchRoutes } from "./api/routes/search.routes";
import { notificationRoutes } from "./api/routes/notification.routes";
import { scheduledReportRoutes } from "./api/routes/scheduled-report.routes";
import { subscriptionRoutes } from "./api/routes/subscription.routes";
import { usageRoutes } from "./api/routes/usage.routes";
import { couponRoutes } from "./api/routes/coupon.routes";
import { dunningRoutes } from "./api/routes/dunning.routes";
import { metricsRoutes } from "./api/routes/metrics.routes";
import { domainRoutes } from "./api/routes/domain.routes";
import { domainResolution } from "./api/middleware/domain.middleware";
import { registerListeners } from "./events/listeners";
import { startWorkers } from "./jobs/index";
import { setupSwagger } from "./api/docs/swagger";

const app = express();

// Trust first proxy (e.g. nginx, ALB) so rate limiting sees real client IPs
app.set("trust proxy", 1);

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(config.env === "production" ? "combined" : "dev"));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "emp-billing", version: "0.1.0", env: config.env });
});

// ── Static file serving for uploads (auth-protected) ────────────────────────
app.use("/uploads", authenticate, express.static(config.upload.uploadDir));

// ── API Documentation (Swagger UI) — disabled in production ─────────────────
if (config.env !== "production") {
  setupSwagger(app);
}

// ── Gateway webhooks — raw body needed, no auth ─────────────────────────────
app.use("/webhooks/gateway", rateLimit({ windowMs: 60 * 1000, max: 200 }), gatewayRoutes);

// ── API v1 ────────────────────────────────────────────────────────────────────
const v1 = express.Router();
v1.use(rateLimit());
v1.use("/auth",         authRoutes);
v1.use("/organizations", orgRoutes);
v1.use("/clients",      clientRoutes);
v1.use("/products",     productRoutes);
v1.use("/invoices",     invoiceRoutes);
v1.use("/quotes",       quoteRoutes);
v1.use("/payments",     paymentRoutes);
v1.use("/credit-notes", creditNoteRoutes);
v1.use("/vendors",      vendorRoutes);
v1.use("/expenses",     expenseRoutes);
v1.use("/recurring",    recurringRoutes);
v1.use("/reports",      reportRoutes);
v1.use("/disputes",     disputeRoutes);
v1.use("/domains",      domainRoutes);
v1.use("/portal",       domainResolution, portalRoutes);
v1.use("/webhooks",     webhookRoutes);
v1.use("/settings",     settingsRoutes);
v1.use("/currency",     currencyRoutes);
v1.use("/uploads",      uploadRoutes);
v1.use("/search",       searchRoutes);
v1.use("/notifications", notificationRoutes);
v1.use("/scheduled-reports", scheduledReportRoutes);
v1.use("/subscriptions", subscriptionRoutes);
v1.use("/usage",        usageRoutes);
v1.use("/coupons",      couponRoutes);
v1.use("/dunning",      dunningRoutes);
v1.use("/metrics",      metricsRoutes);

app.use("/api/v1", v1);

// ── Error handler for API routes ─────────────────────────────────────────────
app.use(errorMiddleware);

// ── Serve client SPA in production ──────────────────────────────────────────
import path from "path";
if (config.env === "production") {
  const clientDist = path.resolve(__dirname, "../../../../client/dist");
  app.use(express.static(clientDist));
  // SPA fallback — but skip /api/* and /health so they return proper 404s instead of index.html
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await getDB(); // connect + verify
    registerListeners(); // wire up event system
    initializeGateways(); // register configured payment gateways
    await startWorkers(); // start BullMQ workers + scheduled jobs
    app.listen(config.port, () => {
      logger.info(`emp-billing server running on http://localhost:${config.port} [${config.env}]`);
    });
  } catch (err) {
    logger.error("Failed to start server", { err });
    process.exit(1);
  }
}

bootstrap();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  await closeDB();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
