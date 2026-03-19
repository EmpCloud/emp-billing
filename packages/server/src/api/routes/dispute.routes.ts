import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { UpdateDisputeSchema } from "@emp-billing/shared";
import * as disputeController from "../controllers/dispute.controller";

const router = Router();
router.use(authenticate);

// Admin dispute routes
router.get("/",        asyncHandler(disputeController.listDisputes));
router.get("/:id",     asyncHandler(disputeController.getDispute));
router.put("/:id",     validateBody(UpdateDisputeSchema), asyncHandler(disputeController.updateDispute));

export { router as disputeRoutes };
