import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateRecurringProfileSchema, UpdateRecurringProfileSchema } from "@emp-billing/shared";
import * as recurringController from "../controllers/recurring.controller";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/",                asyncHandler(recurringController.listProfiles));
router.get("/:id",             asyncHandler(recurringController.getProfile));
router.post("/",               requireSales, validateBody(CreateRecurringProfileSchema), asyncHandler(recurringController.createProfile));
router.put("/:id",             requireSales, validateBody(UpdateRecurringProfileSchema), asyncHandler(recurringController.updateProfile));
router.delete("/:id",          requireAccountant, asyncHandler(recurringController.deleteProfile));

// Actions
router.post("/:id/pause",     requireSales, asyncHandler(recurringController.pauseProfile));
router.post("/:id/resume",    requireSales, asyncHandler(recurringController.resumeProfile));

// Executions
router.get("/:id/executions",  asyncHandler(recurringController.getExecutions));

export { router as recurringRoutes };
