import type { Request, Response } from "express";
import * as settingsService from "../../services/settings/settings.service";

export async function getOrgSettings(req: Request, res: Response): Promise<void> {
  const org = await settingsService.getOrgSettings(req.user!.orgId);
  res.json({ success: true, data: org });
}

export async function updateOrgSettings(req: Request, res: Response): Promise<void> {
  const org = await settingsService.updateOrgSettings(req.user!.orgId, req.body);
  res.json({ success: true, data: org });
}

export async function updateBranding(req: Request, res: Response): Promise<void> {
  const org = await settingsService.updateBranding(req.user!.orgId, req.body);
  res.json({ success: true, data: org });
}

export async function getNumberingConfig(req: Request, res: Response): Promise<void> {
  const result = await settingsService.getNumberingConfig(req.user!.orgId);
  res.json({ success: true, data: result.data });
}

export async function updateNumberingConfig(req: Request, res: Response): Promise<void> {
  const org = await settingsService.updateNumberingConfig(req.user!.orgId, req.body);
  res.json({ success: true, data: org });
}

export async function getEmailTemplates(req: Request, res: Response): Promise<void> {
  const templates = await settingsService.getEmailTemplates();
  res.json({ success: true, data: templates });
}

export async function updateEmailTemplate(req: Request, res: Response): Promise<void> {
  const { name } = req.params;
  const template = await settingsService.updateEmailTemplate(name as string, req.body);
  res.json({ success: true, data: template });
}
