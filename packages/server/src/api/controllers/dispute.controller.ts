import type { Request, Response } from "express";
import * as disputeService from "../../services/dispute/dispute.service";

// ── List Disputes (admin) ────────────────────────────────────────────────────

export async function listDisputes(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: (query.sortOrder || "desc") as "asc" | "desc",
    status: query.status as Parameters<typeof disputeService.listDisputes>[1]["status"],
    clientId: query.clientId,
  };
  const result = await disputeService.listDisputes(req.user!.orgId, opts);
  res.json({
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
}

// ── Get Dispute (admin) ──────────────────────────────────────────────────────

export async function getDispute(req: Request, res: Response): Promise<void> {
  const dispute = await disputeService.getDispute(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: dispute });
}

// ── Update Dispute (admin) ───────────────────────────────────────────────────

export async function updateDispute(req: Request, res: Response): Promise<void> {
  const dispute = await disputeService.updateDispute(
    req.user!.orgId,
    req.params.id as string,
    req.body,
    req.user!.id
  );
  res.json({ success: true, data: dispute });
}
