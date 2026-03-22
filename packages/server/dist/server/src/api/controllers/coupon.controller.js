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
exports.listCoupons = listCoupons;
exports.getCoupon = getCoupon;
exports.createCoupon = createCoupon;
exports.updateCoupon = updateCoupon;
exports.deleteCoupon = deleteCoupon;
exports.validateCoupon = validateCoupon;
exports.applyCoupon = applyCoupon;
exports.getRedemptions = getRedemptions;
exports.applyCouponToSubscription = applyCouponToSubscription;
exports.removeCouponFromSubscription = removeCouponFromSubscription;
const couponService = __importStar(require("../../services/coupon/coupon.service"));
async function listCoupons(req, res) {
    const { page = "1", limit = "20", search, isActive, appliesTo } = req.query;
    const result = await couponService.listCoupons(req.user.orgId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortOrder: "desc",
        search,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        appliesTo: appliesTo,
    });
    const body = {
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    };
    res.json(body);
}
async function getCoupon(req, res) {
    const coupon = await couponService.getCoupon(req.user.orgId, req.params.id);
    res.json({ success: true, data: coupon });
}
async function createCoupon(req, res) {
    const coupon = await couponService.createCoupon(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: coupon });
}
async function updateCoupon(req, res) {
    const coupon = await couponService.updateCoupon(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: coupon });
}
async function deleteCoupon(req, res) {
    await couponService.deleteCoupon(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function validateCoupon(req, res) {
    const { code, amount, clientId } = req.body;
    const result = await couponService.validateCoupon(req.user.orgId, code, amount != null ? Number(amount) : undefined, clientId);
    res.json({ success: true, data: result });
}
async function applyCoupon(req, res) {
    const { code, invoiceId, clientId } = req.body;
    const redemption = await couponService.applyCoupon(req.user.orgId, code, invoiceId, clientId);
    res.status(201).json({ success: true, data: redemption });
}
async function getRedemptions(req, res) {
    const redemptions = await couponService.getRedemptions(req.user.orgId, req.params.id);
    res.json({ success: true, data: redemptions });
}
async function applyCouponToSubscription(req, res) {
    const { code, subscriptionId, clientId } = req.body;
    const redemption = await couponService.applyCouponToSubscription(req.user.orgId, code, subscriptionId, clientId);
    res.status(201).json({ success: true, data: redemption });
}
async function removeCouponFromSubscription(req, res) {
    await couponService.removeCouponFromSubscription(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
//# sourceMappingURL=coupon.controller.js.map