import type { Request, Response } from "express";
import * as vendorService from "../../services/vendor/vendor.service";

export async function listVendors(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", search, isActive } = req.query as Record<string, string>;
  const result = await vendorService.listVendors(req.user!.orgId, {
    search,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
  });
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getVendor(req: Request, res: Response): Promise<void> {
  const vendor = await vendorService.getVendor(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: vendor });
}

export async function createVendor(req: Request, res: Response): Promise<void> {
  const vendor = await vendorService.createVendor(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: vendor });
}

export async function updateVendor(req: Request, res: Response): Promise<void> {
  const vendor = await vendorService.updateVendor(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: vendor });
}

export async function deleteVendor(req: Request, res: Response): Promise<void> {
  await vendorService.deleteVendor(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}
