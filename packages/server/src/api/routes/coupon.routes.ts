import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateCouponSchema, UpdateCouponSchema, ValidateCouponSchema, ApplyCouponSchema } from "@emp-billing/shared";
import * as couponController from "../controllers/coupon.controller";

const router = Router();
router.use(authenticate);

// Validate & Apply (before /:id to avoid route conflicts)
router.post("/validate",   validateBody(ValidateCouponSchema), asyncHandler(couponController.validateCoupon));
router.post("/apply",      requireAccountant, validateBody(ApplyCouponSchema), asyncHandler(couponController.applyCoupon));

// Subscription coupon
router.post("/apply-to-subscription", requireAccountant, asyncHandler(couponController.applyCouponToSubscription));
router.delete("/subscription/:id",   requireAccountant, asyncHandler(couponController.removeCouponFromSubscription));

// CRUD
router.get("/",            asyncHandler(couponController.listCoupons));
router.get("/:id",         asyncHandler(couponController.getCoupon));
router.post("/",           requireAccountant, validateBody(CreateCouponSchema), asyncHandler(couponController.createCoupon));
router.put("/:id",         requireAccountant, validateBody(UpdateCouponSchema), asyncHandler(couponController.updateCoupon));
router.delete("/:id",      requireAccountant, asyncHandler(couponController.deleteCoupon));

// Redemptions
router.get("/:id/redemptions", asyncHandler(couponController.getRedemptions));

export { router as couponRoutes };
