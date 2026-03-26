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
    const rawBody = req.body as Buffer;
    const parsedBody = JSON.parse(rawBody.toString());
    const result = await onlinePaymentService.handleGatewayWebhook(
      "stripe",
      req.headers as Record<string, string>,
      parsedBody,
      rawBody
    );
    res.json(result);
  })
);

// Razorpay webhook -- needs raw body for signature verification (like Stripe)
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const parsedBody = JSON.parse(rawBody.toString());
    const result = await onlinePaymentService.handleGatewayWebhook(
      "razorpay",
      req.headers as Record<string, string>,
      parsedBody,
      rawBody
    );
    res.json(result);
  })
);

// PayPal webhook -- needs raw body for signature verification
router.post(
  "/paypal",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await onlinePaymentService.handleGatewayWebhook(
      "paypal",
      req.headers as Record<string, string>,
      JSON.parse(req.body.toString()),
      req.body // raw buffer
    );
    res.json(result);
  })
);

export { router as gatewayRoutes };
