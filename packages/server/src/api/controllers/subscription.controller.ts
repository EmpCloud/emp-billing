import type { Request, Response } from "express";
import * as subscriptionService from "../../services/subscription/subscription.service";

// ============================================================================
// PLAN CONTROLLERS
// ============================================================================

export async function listPlans(req: Request, res: Response): Promise<void> {
  const plans = await subscriptionService.listPlans(req.user!.orgId);
  res.json({ success: true, data: plans });
}

export async function getPlan(req: Request, res: Response): Promise<void> {
  const plan = await subscriptionService.getPlan(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: plan });
}

export async function createPlan(req: Request, res: Response): Promise<void> {
  const plan = await subscriptionService.createPlan(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: plan });
}

export async function updatePlan(req: Request, res: Response): Promise<void> {
  const plan = await subscriptionService.updatePlan(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: plan });
}

export async function deletePlan(req: Request, res: Response): Promise<void> {
  await subscriptionService.deletePlan(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

// ============================================================================
// SUBSCRIPTION CONTROLLERS
// ============================================================================

export async function listSubscriptions(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: "desc" as const,
    status: query.status as any,
    clientId: query.clientId,
  };
  const result = await subscriptionService.listSubscriptions(req.user!.orgId, opts);
  res.json({
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
}

export async function getSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.getSubscription(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: subscription });
}

export async function createSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.createSubscription(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: subscription });
}

export async function changePlan(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.changePlan(
    req.user!.orgId,
    req.params.id as string,
    req.body
  );
  res.json({ success: true, data: subscription });
}

export async function cancelSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.cancelSubscription(
    req.user!.orgId,
    req.params.id as string,
    req.body
  );
  res.json({ success: true, data: subscription });
}

export async function pauseSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.pauseSubscription(
    req.user!.orgId,
    req.params.id as string
  );
  res.json({ success: true, data: subscription });
}

export async function resumeSubscription(req: Request, res: Response): Promise<void> {
  const subscription = await subscriptionService.resumeSubscription(
    req.user!.orgId,
    req.params.id as string
  );
  res.json({ success: true, data: subscription });
}

export async function getSubscriptionEvents(req: Request, res: Response): Promise<void> {
  const events = await subscriptionService.getSubscriptionEvents(
    req.user!.orgId,
    req.params.id as string
  );
  res.json({ success: true, data: events });
}
