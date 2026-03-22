import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { AddDomainSchema } from "@emp-billing/shared";
import * as domainController from "../controllers/domain.controller";

const router = Router();
router.use(authenticate);

// All domain management routes require admin role
router.get("/",              requireAdmin, asyncHandler(domainController.listDomains));
router.post("/",             requireAdmin, validateBody(AddDomainSchema), asyncHandler(domainController.addDomain));
router.delete("/:id",        requireAdmin, asyncHandler(domainController.removeDomain));
router.post("/:id/verify",   requireAdmin, asyncHandler(domainController.verifyDomain));

export { router as domainRoutes };
