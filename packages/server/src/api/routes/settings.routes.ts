import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { UpdateOrgSchema, UpdateBrandingSchema, UpdateNumberingSchema, UpdateEmailTemplateSchema } from "@emp-billing/shared";
import * as settingsController from "../controllers/settings.controller";

const router = Router();
router.use(authenticate);

router.get("/",           asyncHandler(settingsController.getOrgSettings));
router.put("/",           requireAdmin, validateBody(UpdateOrgSchema), asyncHandler(settingsController.updateOrgSettings));
router.put("/branding",   requireAdmin, validateBody(UpdateBrandingSchema), asyncHandler(settingsController.updateBranding));
router.get("/numbering",  asyncHandler(settingsController.getNumberingConfig));
router.put("/numbering",  requireAdmin, validateBody(UpdateNumberingSchema), asyncHandler(settingsController.updateNumberingConfig));
router.get("/email-templates",       asyncHandler(settingsController.getEmailTemplates));
router.put("/email-templates/:name", requireAdmin, validateBody(UpdateEmailTemplateSchema), asyncHandler(settingsController.updateEmailTemplate));

export { router as settingsRoutes };
