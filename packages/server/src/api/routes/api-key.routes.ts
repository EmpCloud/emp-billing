import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateApiKeySchema } from "@emp-billing/shared";
import * as apiKeyController from "../controllers/api-key.controller";

const router = Router();
router.use(authenticate);

router.get("/",       requireAdmin, asyncHandler(apiKeyController.listApiKeys));
router.post("/",      requireAdmin, validateBody(CreateApiKeySchema), asyncHandler(apiKeyController.createApiKey));
router.delete("/:id", requireAdmin, asyncHandler(apiKeyController.revokeApiKey));

export { router as apiKeyRoutes };
