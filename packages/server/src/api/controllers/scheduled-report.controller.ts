import type { Request, Response } from "express";
import * as scheduledReportService from "../../services/report/scheduled-report.service";

// ============================================================================
// SCHEDULED REPORT CONTROLLER
// ============================================================================

export async function listScheduledReports(req: Request, res: Response): Promise<void> {
  const reports = await scheduledReportService.listScheduledReports(req.user!.orgId);
  res.json({ success: true, data: reports });
}

export async function createScheduledReport(req: Request, res: Response): Promise<void> {
  const report = await scheduledReportService.createScheduledReport(
    req.user!.orgId,
    req.user!.id,
    req.body,
  );
  res.status(201).json({ success: true, data: report });
}

export async function updateScheduledReport(req: Request, res: Response): Promise<void> {
  const report = await scheduledReportService.updateScheduledReport(
    req.user!.orgId,
    req.params.id as string,
    req.body,
  );
  res.json({ success: true, data: report });
}

export async function deleteScheduledReport(req: Request, res: Response): Promise<void> {
  await scheduledReportService.deleteScheduledReport(
    req.user!.orgId,
    req.params.id as string,
  );
  res.json({ success: true, data: null });
}
