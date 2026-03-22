"use strict";
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
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const index_2 = require("../../events/index");
// ============================================================================
// COUPON SERVICE
// Manages coupon/promo codes: CRUD, validation, redemption.
// All monetary values are in smallest unit (paise/cents).
// ============================================================================
// ── List ─────────────────────────────────────────────────────────────────────
async function listCoupons(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.isActive !== undefined)
        where.is_active = opts.isActive;
    if (opts.appliesTo)
        where.applies_to = opts.appliesTo;
    const result = await db.findPaginated("coupons", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    // Client-side search filter
    if (opts.search) {
        const q = opts.search.toLowerCase();
        result.data = result.data.filter((c) => c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q));
    }
    return result;
}
// ── Get ──────────────────────────────────────────────────────────────────────
async function getCoupon(orgId, id) {
    const db = await (0, index_1.getDB)();
    const coupon = await db.findById("coupons", id, orgId);
    if (!coupon)
        throw (0, AppError_1.NotFoundError)("Coupon");
    return coupon;
}
// ── Create ───────────────────────────────────────────────────────────────────
async function createCoupon(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    // Check for duplicate code within org
    const existing = await db.findOne("coupons", { org_id: orgId, code: input.code.toUpperCase() });
    if (existing)
        throw (0, AppError_1.ConflictError)(`A coupon with code '${input.code}' already exists`);
    // Validate percentage range
    if (input.type === shared_1.CouponType.PERCENTAGE && (input.value < 0 || input.value > 100)) {
        throw (0, AppError_1.BadRequestError)("Percentage value must be between 0 and 100");
    }
    const now = new Date();
    const coupon = await db.create("coupons", {
        id: (0, uuid_1.v4)(),
        orgId,
        code: input.code.toUpperCase(),
        name: input.name,
        type: input.type,
        value: input.value,
        currency: input.currency ?? null,
        appliesTo: input.appliesTo,
        productId: input.productId ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        maxRedemptionsPerClient: input.maxRedemptionsPerClient ?? null,
        timesRedeemed: 0,
        minAmount: input.minAmount ?? 0,
        validFrom: input.validFrom,
        validUntil: input.validUntil ?? null,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    });
    return coupon;
}
// ── Update ───────────────────────────────────────────────────────────────────
async function updateCoupon(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("coupons", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Coupon");
    // Check unique code if changed
    if (input.code && input.code.toUpperCase() !== existing.code) {
        const conflict = await db.findOne("coupons", { org_id: orgId, code: input.code.toUpperCase() });
        if (conflict && conflict.id !== id) {
            throw (0, AppError_1.ConflictError)(`A coupon with code '${input.code}' already exists`);
        }
    }
    const updateData = { updatedAt: new Date() };
    if (input.code !== undefined)
        updateData.code = input.code.toUpperCase();
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.type !== undefined)
        updateData.type = input.type;
    if (input.value !== undefined)
        updateData.value = input.value;
    if (input.currency !== undefined)
        updateData.currency = input.currency ?? null;
    if (input.appliesTo !== undefined)
        updateData.appliesTo = input.appliesTo;
    if (input.productId !== undefined)
        updateData.productId = input.productId ?? null;
    if (input.maxRedemptions !== undefined)
        updateData.maxRedemptions = input.maxRedemptions ?? null;
    if (input.maxRedemptionsPerClient !== undefined)
        updateData.maxRedemptionsPerClient = input.maxRedemptionsPerClient ?? null;
    if (input.minAmount !== undefined)
        updateData.minAmount = input.minAmount;
    if (input.validFrom !== undefined)
        updateData.validFrom = input.validFrom;
    if (input.validUntil !== undefined)
        updateData.validUntil = input.validUntil ?? null;
    return db.update("coupons", id, updateData, orgId);
}
// ── Delete (deactivate) ──────────────────────────────────────────────────────
async function deleteCoupon(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("coupons", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Coupon");
    await db.update("coupons", id, {
        isActive: false,
        updatedAt: new Date(),
    }, orgId);
}
// ── Validate ─────────────────────────────────────────────────────────────────
async function validateCoupon(orgId, code, amount, clientId) {
    const db = await (0, index_1.getDB)();
    const coupon = await db.findOne("coupons", {
        org_id: orgId,
        code: code.toUpperCase(),
    });
    if (!coupon) {
        throw (0, AppError_1.BadRequestError)("Invalid coupon code");
    }
    // Check active
    if (!coupon.isActive) {
        throw (0, AppError_1.BadRequestError)("This coupon is no longer active");
    }
    // Check date validity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validFrom = new Date(coupon.validFrom);
    validFrom.setHours(0, 0, 0, 0);
    if (today < validFrom) {
        throw (0, AppError_1.BadRequestError)("This coupon is not yet valid");
    }
    if (coupon.validUntil) {
        const validUntil = new Date(coupon.validUntil);
        validUntil.setHours(23, 59, 59, 999);
        if (today > validUntil) {
            throw (0, AppError_1.BadRequestError)("This coupon has expired");
        }
    }
    // Check max redemptions
    if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
        throw (0, AppError_1.BadRequestError)("This coupon has reached its maximum redemptions");
    }
    // Check per-client redemption limit
    if (coupon.maxRedemptionsPerClient != null && clientId) {
        const clientRedemptions = await db.raw(`SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND client_id = ? AND org_id = ?`, [coupon.id, clientId, orgId]);
        const clientCount = Number(clientRedemptions[0]?.count ?? 0);
        if (clientCount >= coupon.maxRedemptionsPerClient) {
            throw (0, AppError_1.BadRequestError)("You have already used this coupon the maximum number of times");
        }
    }
    // Check minimum amount
    if (amount !== undefined && coupon.minAmount > 0 && amount < coupon.minAmount) {
        throw (0, AppError_1.BadRequestError)(`Minimum order amount of ${coupon.minAmount} is required to use this coupon`);
    }
    // Calculate discount preview
    let discountAmount = 0;
    if (amount !== undefined && amount > 0) {
        if (coupon.type === shared_1.CouponType.PERCENTAGE) {
            discountAmount = Math.round(amount * coupon.value / 100);
        }
        else {
            discountAmount = Math.min(coupon.value, amount);
        }
    }
    return {
        valid: true,
        coupon,
        discountAmount,
        message: "Coupon is valid",
    };
}
// ── Apply ────────────────────────────────────────────────────────────────────
async function applyCoupon(orgId, code, invoiceId, clientId) {
    const db = await (0, index_1.getDB)();
    // Get the invoice
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if ([shared_1.InvoiceStatus.VOID, shared_1.InvoiceStatus.WRITTEN_OFF, shared_1.InvoiceStatus.PAID].includes(invoice.status)) {
        throw (0, AppError_1.BadRequestError)("Cannot apply coupon to this invoice");
    }
    // Validate the coupon
    const { coupon, discountAmount } = await validateCoupon(orgId, code, invoice.total, clientId);
    if (discountAmount <= 0) {
        throw (0, AppError_1.BadRequestError)("Coupon discount amount is zero");
    }
    const now = new Date();
    // Create redemption record
    const redemption = await db.create("coupon_redemptions", {
        id: (0, uuid_1.v4)(),
        couponId: coupon.id,
        orgId,
        clientId,
        invoiceId,
        subscriptionId: null,
        discountAmount,
        redeemedAt: now,
    });
    (0, index_2.emit)("coupon.redeemed", {
        orgId,
        couponId: coupon.id,
        clientId,
        invoiceId,
        discountAmount,
    });
    // Increment times_redeemed
    await db.update("coupons", coupon.id, {
        timesRedeemed: coupon.timesRedeemed + 1,
        updatedAt: now,
    }, orgId);
    // Apply discount to invoice
    const newDiscountAmount = invoice.discountAmount + discountAmount;
    const newTotal = Math.max(0, invoice.total - discountAmount);
    const newAmountDue = Math.max(0, newTotal - invoice.amountPaid);
    await db.update("invoices", invoiceId, {
        discountAmount: newDiscountAmount,
        total: newTotal,
        amountDue: newAmountDue,
        updatedAt: now,
    }, orgId);
    return redemption;
}
// ── Redemptions ──────────────────────────────────────────────────────────────
async function getRedemptions(orgId, couponId) {
    const db = await (0, index_1.getDB)();
    // Verify coupon exists
    const coupon = await db.findById("coupons", couponId, orgId);
    if (!coupon)
        throw (0, AppError_1.NotFoundError)("Coupon");
    return db.findMany("coupon_redemptions", {
        where: { coupon_id: couponId, org_id: orgId },
        orderBy: [{ column: "redeemed_at", direction: "desc" }],
    });
}
// ── Apply Coupon to Subscription ────────────────────────────────────────────
async function applyCouponToSubscription(orgId, code, subscriptionId, clientId) {
    const db = await (0, index_1.getDB)();
    // Get subscription
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    // Can't apply if subscription already has a coupon
    if (subscription.couponId) {
        throw (0, AppError_1.BadRequestError)("This subscription already has a coupon applied. Remove it first.");
    }
    // Get the plan to know the price
    const plan = await db.findById("plans", subscription.planId, orgId);
    if (!plan)
        throw (0, AppError_1.NotFoundError)("Plan");
    const total = plan.price * (subscription.quantity || 1);
    // Validate the coupon
    const { coupon, discountAmount } = await validateCoupon(orgId, code, total, clientId);
    // Ensure coupon is applicable to subscriptions
    if (coupon.appliesTo !== shared_1.CouponAppliesTo.SUBSCRIPTION && coupon.appliesTo !== shared_1.CouponAppliesTo.INVOICE) {
        throw (0, AppError_1.BadRequestError)("This coupon cannot be applied to subscriptions");
    }
    if (discountAmount <= 0) {
        throw (0, AppError_1.BadRequestError)("Coupon discount amount is zero for this subscription");
    }
    const now = new Date();
    // Create redemption record
    const redemption = await db.create("coupon_redemptions", {
        id: (0, uuid_1.v4)(),
        couponId: coupon.id,
        orgId,
        clientId,
        invoiceId: null,
        subscriptionId,
        discountAmount,
        redeemedAt: now,
    });
    // Increment times_redeemed
    await db.update("coupons", coupon.id, {
        timesRedeemed: coupon.timesRedeemed + 1,
        updatedAt: now,
    }, orgId);
    // Store coupon on subscription
    await db.update("subscriptions", subscriptionId, {
        couponId: coupon.id,
        couponDiscountAmount: discountAmount,
        updatedAt: now,
    }, orgId);
    // Emit event
    (0, index_2.emit)("coupon.redeemed", {
        orgId,
        couponId: coupon.id,
        clientId,
        subscriptionId,
        discountAmount,
    });
    return redemption;
}
// ── Remove Coupon from Subscription ─────────────────────────────────────────
async function removeCouponFromSubscription(orgId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (!subscription.couponId) {
        throw (0, AppError_1.BadRequestError)("This subscription has no coupon applied");
    }
    await db.update("subscriptions", subscriptionId, {
        couponId: null,
        couponDiscountAmount: 0,
        updatedAt: new Date(),
    }, orgId);
}
//# sourceMappingURL=coupon.service.js.map