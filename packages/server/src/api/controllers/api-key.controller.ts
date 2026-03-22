import type { Request, Response } from "express";
import * as apiKeyService from "../../services/auth/api-key.service";

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  const keys = await apiKeyService.listApiKeys(req.user!.orgId);
  res.json({ success: true, data: keys });
}

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const { name, scopes, expiresAt } = req.body;
  const result = await apiKeyService.createApiKey(
    req.user!.orgId,
    name,
    scopes,
    expiresAt ? new Date(expiresAt) : undefined
  );
  res.status(201).json({ success: true, data: result });
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  await apiKeyService.revokeApiKey(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}
