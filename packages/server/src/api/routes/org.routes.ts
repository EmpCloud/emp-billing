import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { UpdateOrgSchema, InviteUserSchema, UpdateUserRoleSchema } from "@emp-billing/shared";
import * as orgController from "../controllers/org.controller";
import * as auditController from "../controllers/audit.controller";
import * as teamController from "../controllers/team.controller";

const router = Router();
router.use(authenticate);

router.get("/",   asyncHandler(orgController.getOrg));
router.put("/",   requireAdmin, validateBody(UpdateOrgSchema), asyncHandler(orgController.updateOrg));

// Audit logs
router.get("/audit-logs", requireAdmin, asyncHandler(auditController.listAuditLogs));

// Team management
router.get("/members", asyncHandler(teamController.listMembers));
router.post("/members", requireAdmin, validateBody(InviteUserSchema), asyncHandler(teamController.inviteMember));
router.put("/members/:userId/role", requireAdmin, validateBody(UpdateUserRoleSchema), asyncHandler(teamController.updateMemberRole));
router.delete("/members/:userId", requireAdmin, asyncHandler(teamController.removeMember));

export { router as orgRoutes };
