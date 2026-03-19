import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError, ConflictError } from "../../utils/AppError";
import { CouponType, CouponAppliesTo, InvoiceStatus } from "@emp-billing/shared";
import type { Coupon, CouponRedemption, Invoice } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateCouponSchema, UpdateCouponSchema, CouponFilterSchema } from "@emp-billing/shared";
import { emit } from "../../events/index";

// ============================================================================
// COUPON SERVICE
// Manages coupon/promo codes: CRUD, validation, redemption.
// All monetary values are in smallest unit (paise/cents).
// ============================================================================

// ── List ─────────────────────────────────────────────────────────────────────

export async function listCoupons(
  orgId: string,
  opts: z.infer<typeof CouponFilterSchema>
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.isActive !== undefined) where.is_active = opts.isActive;
  if (opts.appliesTo) where.applies_to = opts.appliesTo;

  const result = await db.findPaginated<Coupon>("coupons", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  // Client-side search filter
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result.data = result.data.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }

  return result;
}

// ── Get ──────────────────────────────────────────────────────────────────────

export async function getCoupon(orgId: string, id: string): Promise<Coupon> {
  const db = await getDB();
  const coupon = await db.findById<Coupon>("coupons", id, orgId);
  if (!coupon) throw NotFoundError("Coupon");
  return coupon;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createCoupon(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateCouponSchema>
): Promise<Coupon> {
  const db = await getDB();

  // Check for duplicate code within org
  const existing = await db.findOne("coupons", { org_id: orgId, code: input.code });
  if (existing) throw ConflictError(`A coupon with code '${input.code}' already exists`);

  // Validate percentage range
  if (input.type === CouponType.PERCENTAGE && (input.value < 0 || input.value > 100)) {
    throw BadRequestError("Percentage value must be between 0 and 100");
  }

  const now = new Date();
  const coupon = await db.create<Coupon>("coupons", {
    id: uuid(),
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

export async function updateCoupon(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateCouponSchema>
): Promise<Coupon> {
  const db = await getDB();
  const existing = await db.findById<Coupon>("coupons", id, orgId);
  if (!existing) throw NotFoundError("Coupon");

  // Check unique code if changed
  if (input.code && input.code.toUpperCase() !== existing.code) {
    const conflict = await db.findOne("coupons", { org_id: orgId, code: input.code.toUpperCase() });
    if (conflict && (conflict as Coupon).id !== id) {
      throw ConflictError(`A coupon with code '${input.code}' already exists`);
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.code !== undefined) updateData.code = input.code.toUpperCase();
  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.value !== undefined) updateData.value = input.value;
  if (input.currency !== undefined) updateData.currency = input.currency ?? null;
  if (input.appliesTo !== undefined) updateData.appliesTo = input.appliesTo;
  if (input.productId !== undefined) updateData.productId = input.productId ?? null;
  if (input.maxRedemptions !== undefined) updateData.maxRedemptions = input.maxRedemptions ?? null;
  if (input.maxRedemptionsPerClient !== undefined) updateData.maxRedemptionsPerClient = input.maxRedemptionsPerClient ?? null;
  if (input.minAmount !== undefined) updateData.minAmount = input.minAmount;
  if (input.validFrom !== undefined) updateData.validFrom = input.validFrom;
  if (input.validUntil !== undefined) updateData.validUntil = input.validUntil ?? null;

  return db.update<Coupon>("coupons", id, updateData, orgId);
}

// ── Delete (deactivate) ──────────────────────────────────────────────────────

export async function deleteCoupon(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById<Coupon>("coupons", id, orgId);
  if (!existing) throw NotFoundError("Coupon");

  await db.update("coupons", id, {
    isActive: false,
    updatedAt: new Date(),
  }, orgId);
}

// ── Validate ─────────────────────────────────────────────────────────────────

export async function validateCoupon(
  orgId: string,
  code: string,
  amount?: number,
  clientId?: string
): Promise<{ valid: boolean; coupon: Coupon; discountAmount: number; message?: string }> {
  const db = await getDB();

  const coupon = await db.findOne<Coupon>("coupons", {
    org_id: orgId,
    code: code.toUpperCase(),
  });

  if (!coupon) {
    throw BadRequestError("Invalid coupon code");
  }

  // Check active
  if (!coupon.isActive) {
    throw BadRequestError("This coupon is no longer active");
  }

  // Check date validity
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validFrom = new Date(coupon.validFrom);
  validFrom.setHours(0, 0, 0, 0);
  if (today < validFrom) {
    throw BadRequestError("This coupon is not yet valid");
  }

  if (coupon.validUntil) {
    const validUntil = new Date(coupon.validUntil);
    validUntil.setHours(23, 59, 59, 999);
    if (today > validUntil) {
      throw BadRequestError("This coupon has expired");
    }
  }

  // Check max redemptions
  if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    throw BadRequestError("This coupon has reached its maximum redemptions");
  }

  // Check per-client redemption limit
  if (coupon.maxRedemptionsPerClient != null && clientId) {
    const clientRedemptions = await db.raw<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND client_id = ? AND org_id = ?`,
      [coupon.id, clientId, orgId]
    );
    const clientCount = Number(clientRedemptions[0]?.count ?? 0);
    if (clientCount >= coupon.maxRedemptionsPerClient) {
      throw BadRequestError("You have already used this coupon the maximum number of times");
    }
  }

  // Check minimum amount
  if (amount !== undefined && coupon.minAmount > 0 && amount < coupon.minAmount) {
    throw BadRequestError(
      `Minimum order amount of ${coupon.minAmount} is required to use this coupon`
    );
  }

  // Calculate discount preview
  let discountAmount = 0;
  if (amount !== undefined && amount > 0) {
    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = Math.round(amount * coupon.value / 100);
    } else {
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

export async function applyCoupon(
  orgId: string,
  code: string,
  invoiceId: string,
  clientId: string
): Promise<CouponRedemption> {
  const db = await getDB();

  // Get the invoice
  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if ([InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF, InvoiceStatus.PAID].includes(invoice.status)) {
    throw BadRequestError("Cannot apply coupon to this invoice");
  }

  // Validate the coupon
  const { coupon, discountAmount } = await validateCoupon(orgId, code, invoice.total, clientId);

  if (discountAmount <= 0) {
    throw BadRequestError("Coupon discount amount is zero");
  }

  const now = new Date();

  // Create redemption record
  const redemption = await db.create<CouponRedemption>("coupon_redemptions", {
    id: uuid(),
    couponId: coupon.id,
    orgId,
    clientId,
    invoiceId,
    subscriptionId: null,
    discountAmount,
    redeemedAt: now,
  });

  emit("coupon.redeemed", {
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

export async function getRedemptions(
  orgId: string,
  couponId: string
): Promise<CouponRedemption[]> {
  const db = await getDB();

  // Verify coupon exists
  const coupon = await db.findById("coupons", couponId, orgId);
  if (!coupon) throw NotFoundError("Coupon");

  return db.findMany<CouponRedemption>("coupon_redemptions", {
    where: { coupon_id: couponId, org_id: orgId },
    orderBy: [{ column: "redeemed_at", direction: "desc" }],
  });
}

// ── Apply Coupon to Subscription ────────────────────────────────────────────

export async function applyCouponToSubscription(
  orgId: string,
  code: string,
  subscriptionId: string,
  clientId: string
): Promise<CouponRedemption> {
  const db = await getDB();

  // Get subscription
  const subscription = await db.findById<any>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  // Can't apply if subscription already has a coupon
  if (subscription.couponId) {
    throw BadRequestError("This subscription already has a coupon applied. Remove it first.");
  }

  // Get the plan to know the price
  const plan = await db.findById<any>("plans", subscription.planId, orgId);
  if (!plan) throw NotFoundError("Plan");

  const total = plan.price * (subscription.quantity || 1);

  // Validate the coupon
  const { coupon, discountAmount } = await validateCoupon(orgId, code, total, clientId);

  // Ensure coupon is applicable to subscriptions
  if (coupon.appliesTo !== CouponAppliesTo.SUBSCRIPTION && coupon.appliesTo !== CouponAppliesTo.INVOICE) {
    throw BadRequestError("This coupon cannot be applied to subscriptions");
  }

  if (discountAmount <= 0) {
    throw BadRequestError("Coupon discount amount is zero for this subscription");
  }

  const now = new Date();

  // Create redemption record
  const redemption = await db.create<CouponRedemption>("coupon_redemptions", {
    id: uuid(),
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
  emit("coupon.redeemed", {
    orgId,
    couponId: coupon.id,
    clientId,
    subscriptionId,
    discountAmount,
  });

  return redemption;
}

// ── Remove Coupon from Subscription ─────────────────────────────────────────

export async function removeCouponFromSubscription(
  orgId: string,
  subscriptionId: string
): Promise<void> {
  const db = await getDB();
  const subscription = await db.findById<any>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  if (!subscription.couponId) {
    throw BadRequestError("This subscription has no coupon applied");
  }

  await db.update("subscriptions", subscriptionId, {
    couponId: null,
    couponDiscountAmount: 0,
    updatedAt: new Date(),
  }, orgId);
}
