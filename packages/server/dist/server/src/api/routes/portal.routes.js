"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalRoutes = void 0;
const express_1 = require("express");
const portal_auth_middleware_1 = require("../middleware/portal-auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const portalController = __importStar(require("../controllers/portal.controller"));
const onlinePaymentController = __importStar(require("../controllers/online-payment.controller"));
const router = (0, express_1.Router)();
exports.portalRoutes = router;
// Public — no auth
router.post("/login", (0, error_middleware_1.asyncHandler)(portalController.portalLogin));
// Protected — portal auth required
router.get("/dashboard", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalDashboard));
router.get("/invoices", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalInvoices));
router.get("/invoices/:id/pdf", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalInvoicePdf));
router.get("/invoices/:id", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalInvoice));
router.get("/quotes", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalQuotes));
router.post("/quotes/:id/accept", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.acceptPortalQuote));
router.post("/quotes/:id/decline", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.declinePortalQuote));
router.get("/credit-notes", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalCreditNotes));
router.get("/payments", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalPayments));
router.get("/statement", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalStatement));
// Disputes (portal auth required)
router.get("/disputes", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalDisputes));
router.post("/disputes", portal_auth_middleware_1.portalAuth, (0, validate_middleware_1.validateBody)(shared_1.CreateDisputeSchema), (0, error_middleware_1.asyncHandler)(portalController.createPortalDispute));
router.get("/disputes/:id", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalDispute));
// Subscriptions (portal auth required)
router.get("/subscriptions", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalSubscriptions));
router.get("/subscriptions/:id", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalSubscription));
router.get("/plans", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalPlans));
router.post("/subscriptions/:id/change-plan", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.portalChangePlan));
router.post("/subscriptions/:id/cancel", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.portalCancelSubscription));
// Payment method management
router.get("/payment-method", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.getPortalPaymentMethod));
router.put("/payment-method", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.updatePortalPaymentMethod));
router.delete("/payment-method", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(portalController.removePortalPaymentMethod));
// Online payment routes (portal auth required)
router.get("/payment-gateways", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(onlinePaymentController.listGateways));
router.post("/pay", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(onlinePaymentController.createOrder));
router.post("/verify-payment", portal_auth_middleware_1.portalAuth, (0, error_middleware_1.asyncHandler)(onlinePaymentController.verifyPayment));
//# sourceMappingURL=portal.routes.js.map