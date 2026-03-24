import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreatePaymentSchema, RefundSchema } from "@emp-billing/shared";
import * as paymentController from "../controllers/payment.controller";
import * as onlinePaymentController from "../controllers/online-payment.controller";

const router = Router();
router.use(authenticate);

// Online payment (gateway checkout) — MUST be before /:id routes
router.get("/online/gateways",      asyncHandler(onlinePaymentController.listGateways));
router.post("/online/create-order", asyncHandler(onlinePaymentController.createOrder));
router.post("/online/verify",       asyncHandler(onlinePaymentController.verifyPayment));

// Standard payment CRUD
router.get("/",              asyncHandler(paymentController.listPayments));
router.post("/",             requireAccountant, validateBody(CreatePaymentSchema), asyncHandler(paymentController.recordPayment));

// Receipt PDF
router.get("/:id/receipt",   asyncHandler(paymentController.downloadReceipt));

// Refund
router.post("/:id/refund",   requireAccountant, validateBody(RefundSchema), asyncHandler(paymentController.refundPayment));

// Single payment (must be last — /:id is a catch-all)
router.get("/:id",           asyncHandler(paymentController.getPayment));
router.delete("/:id",        requireAccountant, asyncHandler(paymentController.deletePayment));

export { router as paymentRoutes };
