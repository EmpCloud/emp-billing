import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  CreatePlanSchema,
  UpdatePlanSchema,
  CreateSubscriptionSchema,
  ChangeSubscriptionPlanSchema,
  CancelSubscriptionSchema,
  PreviewPlanChangeSchema,
} from "@emp-billing/shared";
import * as subscriptionController from "../controllers/subscription.controller";
import * as subscriptionService from "../../services/subscription/subscription.service";
import { subscriptionQueue, dunningQueue } from "../../jobs/queue";
import { getDB } from "../../db/adapters/index";
import { logger } from "../../utils/logger";

const router = Router();
router.use(authenticate);

// ── Plans ───────────────────────────────────────────────────────────────────
router.get("/plans",       asyncHandler(subscriptionController.listPlans));
router.get("/plans/:id",   asyncHandler(subscriptionController.getPlan));
router.post("/plans",      requireSales, validateBody(CreatePlanSchema), asyncHandler(subscriptionController.createPlan));
router.put("/plans/:id",   requireSales, validateBody(UpdatePlanSchema), asyncHandler(subscriptionController.updatePlan));
router.delete("/plans/:id", requireAccountant, asyncHandler(subscriptionController.deletePlan));

// ── Subscriptions ───────────────────────────────────────────────────────────
router.get("/",            asyncHandler(subscriptionController.listSubscriptions));
router.get("/:id",         asyncHandler(subscriptionController.getSubscription));
router.post("/",           requireSales, validateBody(CreateSubscriptionSchema), asyncHandler(subscriptionController.createSubscription));
router.post("/:id/preview-change", requireSales, validateBody(PreviewPlanChangeSchema), asyncHandler(subscriptionController.previewPlanChange));
router.put("/:id/change-plan", requireSales, validateBody(ChangeSubscriptionPlanSchema), asyncHandler(subscriptionController.changePlan));
router.post("/:id/cancel", requireSales, validateBody(CancelSubscriptionSchema), asyncHandler(subscriptionController.cancelSubscription));
router.post("/:id/pause",  requireSales, asyncHandler(subscriptionController.pauseSubscription));
router.post("/:id/resume", requireSales, asyncHandler(subscriptionController.resumeSubscription));
router.get("/:id/events",  asyncHandler(subscriptionController.getSubscriptionEvents));

// ── Admin / Testing Endpoints ───────────────────────────────────────────────
// These allow E2E tests to exercise the full subscription lifecycle without
// waiting for real billing cycles. Protected by API key auth (EmpCloud key).

/** Force-renew a subscription: generates a new invoice and advances the period */
router.post("/:id/force-renew", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  logger.info(`[Admin] Force-renewing subscription ${id}`);
  const result = await subscriptionService.renewSubscription(id);
  res.json({ success: true, data: result });
}));

/** Time-shift a subscription's next billing date to trigger renewal on next worker run */
router.post("/:id/time-shift", asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const db = await getDB();
  await db.update("subscriptions", id, {
    nextBillingDate: new Date(Date.now() - 86400000), // yesterday
    currentPeriodEnd: new Date(Date.now() - 86400000),
  });
  logger.info(`[Admin] Time-shifted subscription ${id} billing date to yesterday`);
  res.json({ success: true, data: { message: "Billing date shifted to yesterday" } });
}));

/** Trigger subscription billing worker immediately (normally runs daily at midnight) */
router.post("/admin/trigger-billing-worker", asyncHandler(async (_req, res) => {
  await subscriptionQueue.add("process-subscriptions-manual", {}, { removeOnComplete: true });
  logger.info("[Admin] Manually triggered subscription billing worker");
  res.json({ success: true, data: { message: "Subscription billing worker triggered" } });
}));

/** Trigger dunning retry worker immediately (normally runs every 6 hours) */
router.post("/admin/trigger-dunning-worker", asyncHandler(async (_req, res) => {
  await dunningQueue.add("process-dunning-manual", {}, { removeOnComplete: true });
  logger.info("[Admin] Manually triggered dunning retry worker");
  res.json({ success: true, data: { message: "Dunning worker triggered" } });
}));

export { router as subscriptionRoutes };
