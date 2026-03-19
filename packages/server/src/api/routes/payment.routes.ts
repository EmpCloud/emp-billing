import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreatePaymentSchema, RefundSchema } from "@emp-billing/shared";
import * as paymentController from "../controllers/payment.controller";

const router = Router();
router.use(authenticate);

router.get("/",              asyncHandler(paymentController.listPayments));
router.get("/:id",           asyncHandler(paymentController.getPayment));
router.post("/",             requireAccountant, validateBody(CreatePaymentSchema), asyncHandler(paymentController.recordPayment));
router.delete("/:id",        requireAccountant, asyncHandler(paymentController.deletePayment));
router.post("/:id/refund",   requireAccountant, validateBody(RefundSchema), asyncHandler(paymentController.refundPayment));

// Receipt PDF
router.get("/:id/receipt",   asyncHandler(paymentController.downloadReceipt));

export { router as paymentRoutes };
