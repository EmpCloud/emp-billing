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

router.get("/",              asyncHandler(paymentController.listPayments));
router.get("/:id",           asyncHandler(paymentController.getPayment));
router.post("/",             requireAccountant, validateBody(CreatePaymentSchema), asyncHandler(paymentController.recordPayment));
router.delete("/:id",        requireAccountant, asyncHandler(paymentController.deletePayment));
router.post("/:id/refund",   requireAccountant, validateBody(RefundSchema), asyncHandler(paymentController.refundPayment));

// Receipt PDF
router.get("/:id/receipt",   asyncHandler(paymentController.downloadReceipt));

// Online payment (gateway checkout) — accessible via API key from EMP Cloud
router.get("/online/gateways",   asyncHandler(onlinePaymentController.listGateways));
router.post("/online/create-order", asyncHandler(onlinePaymentController.createOrder));
router.post("/online/verify",    asyncHandler(onlinePaymentController.verifyPayment));

export { router as paymentRoutes };
