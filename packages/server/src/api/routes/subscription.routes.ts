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
} from "@emp-billing/shared";
import * as subscriptionController from "../controllers/subscription.controller";

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
router.put("/:id/change-plan", requireSales, validateBody(ChangeSubscriptionPlanSchema), asyncHandler(subscriptionController.changePlan));
router.post("/:id/cancel", requireSales, validateBody(CancelSubscriptionSchema), asyncHandler(subscriptionController.cancelSubscription));
router.post("/:id/pause",  requireSales, asyncHandler(subscriptionController.pauseSubscription));
router.post("/:id/resume", requireSales, asyncHandler(subscriptionController.resumeSubscription));
router.get("/:id/events",  asyncHandler(subscriptionController.getSubscriptionEvents));

export { router as subscriptionRoutes };
