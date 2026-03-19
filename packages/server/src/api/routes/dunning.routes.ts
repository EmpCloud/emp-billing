import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import type { Request, Response } from "express";
import * as dunningService from "../../services/dunning/dunning.service";

const router = Router();
router.use(authenticate);

// GET /config — get dunning config
router.get(
  "/config",
  asyncHandler(async (req: Request, res: Response) => {
    const config = await dunningService.getDunningConfig(req.user!.orgId);
    res.json({ success: true, data: config });
  }),
);

// PUT /config — update dunning config
router.put(
  "/config",
  asyncHandler(async (req: Request, res: Response) => {
    const config = await dunningService.updateDunningConfig(req.user!.orgId, req.body);
    res.json({ success: true, data: config });
  }),
);

// GET /attempts — list dunning attempts (filterable)
router.get(
  "/attempts",
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const result = await dunningService.listDunningAttempts(req.user!.orgId, {
      page: q.page ? parseInt(q.page as string, 10) : 1,
      limit: q.limit ? parseInt(q.limit as string, 10) : 20,
      status: q.status as any,
      invoiceId: q.invoiceId as string,
    });
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  }),
);

// GET /summary — get dunning summary stats
router.get(
  "/summary",
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await dunningService.getDunningSummary(req.user!.orgId);
    res.json({ success: true, data: summary });
  }),
);

// POST /attempts/:id/retry — manual retry
router.post(
  "/attempts/:id/retry",
  asyncHandler(async (req: Request, res: Response) => {
    const attemptId = req.params.id as string;
    await dunningService.processDunningAttempt(attemptId);
    res.json({ success: true, data: { message: "Retry processed" } });
  }),
);

export { router as dunningRoutes };
