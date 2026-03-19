import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateVendorSchema, UpdateVendorSchema } from "@emp-billing/shared";
import * as vendorController from "../controllers/vendor.controller";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/",            asyncHandler(vendorController.listVendors));
router.get("/:id",         asyncHandler(vendorController.getVendor));
router.post("/",           requireSales, validateBody(CreateVendorSchema), asyncHandler(vendorController.createVendor));
router.put("/:id",         requireSales, validateBody(UpdateVendorSchema), asyncHandler(vendorController.updateVendor));
router.delete("/:id",      requireAccountant, asyncHandler(vendorController.deleteVendor));

export { router as vendorRoutes };
