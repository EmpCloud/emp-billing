import { Router } from "express";
import { portalAuth } from "../middleware/portal-auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateDisputeSchema, PortalLoginSchema, PortalPaySchema, PortalVerifyPaymentSchema, PortalChangePlanSchema, PortalCancelSubscriptionSchema, PortalUpdatePaymentMethodSchema } from "@emp-billing/shared";
import * as portalController from "../controllers/portal.controller";
import * as onlinePaymentController from "../controllers/online-payment.controller";

const router = Router();

// Public — no auth
router.post("/login", validateBody(PortalLoginSchema), asyncHandler(portalController.portalLogin));

// Protected — portal auth required
router.get("/dashboard",           portalAuth, asyncHandler(portalController.getPortalDashboard));
router.get("/invoices",             portalAuth, asyncHandler(portalController.getPortalInvoices));
router.get("/invoices/:id/pdf",     portalAuth, asyncHandler(portalController.getPortalInvoicePdf));
router.get("/invoices/:id",         portalAuth, asyncHandler(portalController.getPortalInvoice));
router.get("/quotes",               portalAuth, asyncHandler(portalController.getPortalQuotes));
router.post("/quotes/:id/accept",   portalAuth, asyncHandler(portalController.acceptPortalQuote));
router.post("/quotes/:id/decline",  portalAuth, asyncHandler(portalController.declinePortalQuote));
router.get("/credit-notes",          portalAuth, asyncHandler(portalController.getPortalCreditNotes));
router.get("/payments",             portalAuth, asyncHandler(portalController.getPortalPayments));
router.get("/statement",            portalAuth, asyncHandler(portalController.getPortalStatement));

// Disputes (portal auth required)
router.get("/disputes",             portalAuth, asyncHandler(portalController.getPortalDisputes));
router.post("/disputes",            portalAuth, validateBody(CreateDisputeSchema), asyncHandler(portalController.createPortalDispute));
router.get("/disputes/:id",         portalAuth, asyncHandler(portalController.getPortalDispute));

// Subscriptions (portal auth required)
router.get("/subscriptions",              portalAuth, asyncHandler(portalController.getPortalSubscriptions));
router.get("/subscriptions/:id",          portalAuth, asyncHandler(portalController.getPortalSubscription));
router.get("/plans",                      portalAuth, asyncHandler(portalController.getPortalPlans));
router.post("/subscriptions/:id/change-plan", portalAuth, validateBody(PortalChangePlanSchema), asyncHandler(portalController.portalChangePlan));
router.post("/subscriptions/:id/cancel",  portalAuth, validateBody(PortalCancelSubscriptionSchema), asyncHandler(portalController.portalCancelSubscription));

// Payment method management
router.get("/payment-method",     portalAuth, asyncHandler(portalController.getPortalPaymentMethod));
router.put("/payment-method",     portalAuth, validateBody(PortalUpdatePaymentMethodSchema), asyncHandler(portalController.updatePortalPaymentMethod));
router.delete("/payment-method",  portalAuth, asyncHandler(portalController.removePortalPaymentMethod));

// Online payment routes (portal auth required)
router.get("/payment-gateways",     portalAuth, asyncHandler(onlinePaymentController.listGateways));
router.post("/pay",                 portalAuth, validateBody(PortalPaySchema), asyncHandler(onlinePaymentController.createOrder));
router.post("/verify-payment",      portalAuth, validateBody(PortalVerifyPaymentSchema), asyncHandler(onlinePaymentController.verifyPayment));

export { router as portalRoutes };
