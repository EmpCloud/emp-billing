import type { Request, Response } from "express";
import * as domainService from "../../services/domain/domain.service";

export async function listDomains(req: Request, res: Response): Promise<void> {
  const domains = await domainService.listCustomDomains(req.user!.orgId);
  res.json({ success: true, data: domains });
}

export async function addDomain(req: Request, res: Response): Promise<void> {
  const domain = await domainService.addCustomDomain(req.user!.orgId, req.body.domain);
  res.status(201).json({ success: true, data: domain });
}

export async function removeDomain(req: Request, res: Response): Promise<void> {
  await domainService.removeCustomDomain(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function verifyDomain(req: Request, res: Response): Promise<void> {
  const domain = await domainService.verifyDomain(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: domain });
}
