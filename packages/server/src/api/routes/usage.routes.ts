import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateUsageRecordSchema, ReportUsageSchema, GenerateUsageInvoiceSchema } from "@emp-billing/shared";
import * as usageController from "../controllers/usage.controller";

const router = Router();
router.use(authenticate);

// Usage records
router.post("/",                 requireAccountant, validateBody(CreateUsageRecordSchema), asyncHandler(usageController.recordUsage));
router.get("/",                  asyncHandler(usageController.listUsageRecords));
router.get("/summary",           asyncHandler(usageController.getUsageSummary));

// Simplified usage reporting for SaaS integrations
router.post("/report",           requireAccountant, validateBody(ReportUsageSchema),              asyncHandler(usageController.reportUsage));
router.post("/generate-invoice", requireAccountant, validateBody(GenerateUsageInvoiceSchema),     asyncHandler(usageController.generateUsageInvoice));

export { router as usageRoutes };
