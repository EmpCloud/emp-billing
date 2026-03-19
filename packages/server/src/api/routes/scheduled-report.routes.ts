import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateScheduledReportSchema, UpdateScheduledReportSchema } from "@emp-billing/shared";
import * as scheduledReportController from "../controllers/scheduled-report.controller";

const router = Router();
router.use(authenticate);

// LIST
router.get("/", asyncHandler(scheduledReportController.listScheduledReports));

// CREATE
router.post(
  "/",
  requireAccountant,
  validateBody(CreateScheduledReportSchema),
  asyncHandler(scheduledReportController.createScheduledReport),
);

// UPDATE
router.put(
  "/:id",
  requireAccountant,
  validateBody(UpdateScheduledReportSchema),
  asyncHandler(scheduledReportController.updateScheduledReport),
);

// DELETE
router.delete(
  "/:id",
  requireAccountant,
  asyncHandler(scheduledReportController.deleteScheduledReport),
);

export { router as scheduledReportRoutes };
