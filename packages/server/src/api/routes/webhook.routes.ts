import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateWebhookSchema, UpdateWebhookSchema } from "@emp-billing/shared";
import * as webhookController from "../controllers/webhook.controller";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/",                asyncHandler(webhookController.listWebhooks));
router.post("/",               requireAdmin, validateBody(CreateWebhookSchema), asyncHandler(webhookController.createWebhook));
router.put("/:id",             requireAdmin, validateBody(UpdateWebhookSchema), asyncHandler(webhookController.updateWebhook));
router.delete("/:id",          requireAdmin, asyncHandler(webhookController.deleteWebhook));

// Actions
router.post("/:id/test",      requireAdmin, asyncHandler(webhookController.testWebhook));

// Deliveries
router.get("/:id/deliveries",  asyncHandler(webhookController.getDeliveries));
router.post("/:id/deliveries/:deliveryId/retry", requireAdmin, asyncHandler(webhookController.retryDelivery));

export { router as webhookRoutes };
