import type { Request, Response } from "express";
import * as pricingService from "../../services/pricing/pricing.service";
import { processUsageBilling } from "../../jobs/usage-billing.worker";
import type { ApiResponse } from "@emp-billing/shared";

export async function recordUsage(req: Request, res: Response): Promise<void> {
  const record = await pricingService.recordUsage(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: record });
}

export async function listUsageRecords(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", productId, clientId, periodStart, periodEnd } = req.query as Record<string, string>;
  const result = await pricingService.listUsageRecords(req.user!.orgId, {
    page: parseInt(page),
    limit: parseInt(limit),
    sortOrder: "desc" as const,
    productId,
    clientId,
    periodStart: periodStart ? new Date(periodStart) : undefined,
    periodEnd: periodEnd ? new Date(periodEnd) : undefined,
  });
  const body: ApiResponse<typeof result.data> = {
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  };
  res.json(body);
}

export async function getUsageSummary(req: Request, res: Response): Promise<void> {
  const { productId, clientId, periodStart, periodEnd } = req.query as Record<string, string>;
  if (!productId || !clientId || !periodStart || !periodEnd) {
    res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "productId, clientId, periodStart, and periodEnd are required" } });
    return;
  }
  const summary = await pricingService.getUsageSummary(
    req.user!.orgId,
    productId,
    clientId,
    new Date(periodStart),
    new Date(periodEnd)
  );
  res.json({ success: true, data: summary });
}

export async function reportUsage(req: Request, res: Response): Promise<void> {
  const record = await pricingService.reportUsage(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: record });
}

export async function generateUsageInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await pricingService.generateUsageInvoice(
    req.user!.orgId,
    req.user!.id,
    req.body
  );
  res.status(201).json({ success: true, data: invoice });
}

/**
 * Admin-only: manually trigger usage billing for all clients/subscriptions.
 * Runs the same logic as the scheduled daily job.
 */
export async function generateAllUsageInvoices(req: Request, res: Response): Promise<void> {
  const result = await processUsageBilling();

  res.status(200).json({
    success: true,
    data: {
      invoicesGenerated: result.invoicesGenerated,
      subscriptionsProcessed: result.subscriptionsProcessed,
      standaloneClientsProcessed: result.standaloneClientsProcessed,
      errors: result.errors,
    },
  });
}
