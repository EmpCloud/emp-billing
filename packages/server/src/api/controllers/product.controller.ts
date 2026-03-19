import type { Request, Response } from "express";
import * as productService from "../../services/product/product.service";
import type { ApiResponse } from "@emp-billing/shared";

export async function listProducts(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", search, type, isActive } = req.query as Record<string, string>;
  const result = await productService.listProducts(req.user!.orgId, {
    search,
    type,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
  });
  const body: ApiResponse<typeof result.data> = { success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } };
  res.json(body);
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.getProduct(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: product });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.createProduct(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.updateProduct(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  await productService.deleteProduct(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function listTaxRates(req: Request, res: Response): Promise<void> {
  const rates = await productService.listTaxRates(req.user!.orgId);
  res.json({ success: true, data: rates });
}

export async function createTaxRate(req: Request, res: Response): Promise<void> {
  const rate = await productService.createTaxRate(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: rate });
}

export async function updateTaxRate(req: Request, res: Response): Promise<void> {
  const rate = await productService.updateTaxRate(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: rate });
}

export async function deleteTaxRate(req: Request, res: Response): Promise<void> {
  await productService.deleteTaxRate(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}
