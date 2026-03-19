import type { Request, Response } from "express";
import * as settingsService from "../../services/settings/settings.service";

export async function getOrg(req: Request, res: Response): Promise<void> {
  const org = await settingsService.getOrgSettings(req.user!.orgId);
  res.json({ success: true, data: org });
}

export async function updateOrg(req: Request, res: Response): Promise<void> {
  const org = await settingsService.updateOrgSettings(req.user!.orgId, req.body);
  res.json({ success: true, data: org });
}
