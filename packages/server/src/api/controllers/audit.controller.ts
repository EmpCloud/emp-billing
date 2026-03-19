import type { Request, Response } from "express";
import * as auditService from "../../services/audit/audit.service";

export async function listAuditLogs(
  req: Request,
  res: Response
): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "50"),
    entityType: query.entityType,
    entityId: query.entityId,
    userId: query.userId,
    action: query.action,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
  const result = await auditService.listAuditLogs(
    req.user!.orgId,
    opts
  );
  res.json({
    success: true,
    data: result.data,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}
