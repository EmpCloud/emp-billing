"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const couponController = __importStar(require("../controllers/coupon.controller"));
const router = (0, express_1.Router)();
exports.couponRoutes = router;
router.use(auth_middleware_1.authenticate);
// Validate & Apply (before /:id to avoid route conflicts)
router.post("/validate", (0, validate_middleware_1.validateBody)(shared_1.ValidateCouponSchema), (0, error_middleware_1.asyncHandler)(couponController.validateCoupon));
router.post("/apply", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.ApplyCouponSchema), (0, error_middleware_1.asyncHandler)(couponController.applyCoupon));
// Subscription coupon
router.post("/apply-to-subscription", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(couponController.applyCouponToSubscription));
router.delete("/subscription/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(couponController.removeCouponFromSubscription));
// CRUD
router.get("/", (0, error_middleware_1.asyncHandler)(couponController.listCoupons));
router.get("/:id", (0, error_middleware_1.asyncHandler)(couponController.getCoupon));
router.post("/", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.CreateCouponSchema), (0, error_middleware_1.asyncHandler)(couponController.createCoupon));
router.put("/:id", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.UpdateCouponSchema), (0, error_middleware_1.asyncHandler)(couponController.updateCoupon));
router.delete("/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(couponController.deleteCoupon));
// Redemptions
router.get("/:id/redemptions", (0, error_middleware_1.asyncHandler)(couponController.getRedemptions));
//# sourceMappingURL=coupon.routes.js.map