import type { Request, Response } from "express";
import * as couponService from "../../services/coupon/coupon.service";
import type { ApiResponse } from "@emp-billing/shared";

export async function listCoupons(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", search, isActive, appliesTo } = req.query as Record<string, string>;
  const result = await couponService.listCoupons(req.user!.orgId, {
    page: parseInt(page),
    limit: parseInt(limit),
    sortOrder: "desc" as const,
    search,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    appliesTo: appliesTo as any,
  });
  const body: ApiResponse<typeof result.data> = {
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  };
  res.json(body);
}

export async function getCoupon(req: Request, res: Response): Promise<void> {
  const coupon = await couponService.getCoupon(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: coupon });
}

export async function createCoupon(req: Request, res: Response): Promise<void> {
  const coupon = await couponService.createCoupon(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: coupon });
}

export async function updateCoupon(req: Request, res: Response): Promise<void> {
  const coupon = await couponService.updateCoupon(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: coupon });
}

export async function deleteCoupon(req: Request, res: Response): Promise<void> {
  await couponService.deleteCoupon(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function validateCoupon(req: Request, res: Response): Promise<void> {
  const { code, amount, clientId } = req.body;
  const result = await couponService.validateCoupon(
    req.user!.orgId,
    code,
    amount ? Number(amount) : undefined,
    clientId
  );
  res.json({ success: true, data: result });
}

export async function applyCoupon(req: Request, res: Response): Promise<void> {
  const { code, invoiceId, clientId } = req.body;
  const redemption = await couponService.applyCoupon(req.user!.orgId, code, invoiceId, clientId);
  res.status(201).json({ success: true, data: redemption });
}

export async function getRedemptions(req: Request, res: Response): Promise<void> {
  const redemptions = await couponService.getRedemptions(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: redemptions });
}

export async function applyCouponToSubscription(req: Request, res: Response): Promise<void> {
  const { code, subscriptionId, clientId } = req.body;
  const redemption = await couponService.applyCouponToSubscription(
    req.user!.orgId,
    code,
    subscriptionId,
    clientId
  );
  res.status(201).json({ success: true, data: redemption });
}

export async function removeCouponFromSubscription(req: Request, res: Response): Promise<void> {
  await couponService.removeCouponFromSubscription(
    req.user!.orgId,
    req.params.id as string
  );
  res.json({ success: true, data: null });
}
