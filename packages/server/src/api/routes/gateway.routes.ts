import { Router } from "express";
import express from "express";
import { asyncHandler } from "../middleware/error.middleware";
import * as onlinePaymentService from "../../services/payment/online-payment.service";
import type { Request, Response } from "express";

const router = Router();

// Stripe webhook -- needs raw body for signature verification
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await onlinePaymentService.handleGatewayWebhook(
      "stripe",
      req.headers as Record<string, string>,
      req.body,
      req.body // raw buffer when express.raw is used
    );
    res.json(result);
  })
);

// Razorpay webhook
router.post(
  "/razorpay",
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = Buffer.from(JSON.stringify(req.body));
    const result = await onlinePaymentService.handleGatewayWebhook(
      "razorpay",
      req.headers as Record<string, string>,
      req.body,
      rawBody
    );
    res.json(result);
  })
);

export { router as gatewayRoutes };
