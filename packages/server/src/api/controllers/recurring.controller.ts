import type { Request, Response } from "express";
import * as recurringService from "../../services/recurring/recurring.service";

export async function listProfiles(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    status: query.status,
    clientId: query.clientId,
  };
  const result = await recurringService.listProfiles(req.user!.orgId, opts);
  res.json({
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const profile = await recurringService.getProfile(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: profile });
}

export async function createProfile(req: Request, res: Response): Promise<void> {
  const profile = await recurringService.createProfile(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const profile = await recurringService.updateProfile(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: profile });
}

export async function deleteProfile(req: Request, res: Response): Promise<void> {
  await recurringService.deleteProfile(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function pauseProfile(req: Request, res: Response): Promise<void> {
  const profile = await recurringService.pauseProfile(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: profile });
}

export async function resumeProfile(req: Request, res: Response): Promise<void> {
  const profile = await recurringService.resumeProfile(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: profile });
}

export async function getExecutions(req: Request, res: Response): Promise<void> {
  const executions = await recurringService.getExecutions(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: executions });
}
