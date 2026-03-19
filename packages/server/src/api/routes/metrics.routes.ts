import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import type { Request, Response } from "express";
import * as metricsService from "../../services/metrics/metrics.service";

const router = Router();
router.use(authenticate);

// GET /mrr — Monthly Recurring Revenue
router.get(
  "/mrr",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await metricsService.getMRR(req.user!.orgId);
    res.json({ success: true, data });
  }),
);

// GET /arr — Annual Recurring Revenue
router.get(
  "/arr",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await metricsService.getARR(req.user!.orgId);
    res.json({ success: true, data });
  }),
);

// GET /churn — Churn metrics
router.get(
  "/churn",
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const from = q.from || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10);
    const to = q.to || new Date().toISOString().slice(0, 10);
    const data = await metricsService.getChurnMetrics(req.user!.orgId, { from, to });
    res.json({ success: true, data });
  }),
);

// GET /ltv — Lifetime Value
router.get(
  "/ltv",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await metricsService.getLTV(req.user!.orgId);
    res.json({ success: true, data });
  }),
);

// GET /revenue-breakdown — Monthly revenue breakdown
router.get(
  "/revenue-breakdown",
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const months = q.months ? parseInt(q.months as string, 10) : 12;
    const data = await metricsService.getRevenueBreakdown(req.user!.orgId, months);
    res.json({ success: true, data });
  }),
);

// GET /subscription-stats — Subscription statistics
router.get(
  "/subscription-stats",
  asyncHandler(async (req: Request, res: Response) => {
    const data = await metricsService.getSubscriptionStats(req.user!.orgId);
    res.json({ success: true, data });
  }),
);

// GET /cohort — Cohort retention analysis
router.get(
  "/cohort",
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const months = q.months ? parseInt(q.months as string, 10) : 12;
    const data = await metricsService.getCohortAnalysis(req.user!.orgId, months);
    res.json({ success: true, data });
  }),
);

export { router as metricsRoutes };
