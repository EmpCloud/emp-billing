import type { Request, Response } from "express";
import * as webhookService from "../../services/webhook/webhook.service";

export async function listWebhooks(req: Request, res: Response): Promise<void> {
  const webhooks = await webhookService.listWebhooks(req.user!.orgId);
  res.json({ success: true, data: webhooks });
}

export async function createWebhook(req: Request, res: Response): Promise<void> {
  const webhook = await webhookService.createWebhook(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: webhook });
}

export async function updateWebhook(req: Request, res: Response): Promise<void> {
  const webhook = await webhookService.updateWebhook(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: webhook });
}

export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  await webhookService.deleteWebhook(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function testWebhook(req: Request, res: Response): Promise<void> {
  const result = await webhookService.testWebhook(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: result });
}

export async function getDeliveries(req: Request, res: Response): Promise<void> {
  const deliveries = await webhookService.getDeliveries(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: deliveries });
}

export async function retryDelivery(req: Request, res: Response): Promise<void> {
  const result = await webhookService.retryDelivery(
    req.user!.orgId,
    req.params.id as string,
    req.params.deliveryId as string
  );
  res.json({ success: true, data: result });
}
