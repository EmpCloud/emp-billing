import { getDB } from "../../db/adapters/index";

interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

interface AuditFilterOpts {
  page: number;
  limit: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(
  orgId: string,
  opts: AuditFilterOpts
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.entityType) where.entity_type = opts.entityType;
  if (opts.entityId) where.entity_id = opts.entityId;
  if (opts.userId) where.user_id = opts.userId;

  const result = await db.findPaginated<AuditLogEntry>("audit_logs", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  let data = result.data;
  // Date range filter
  if (opts.from || opts.to) {
    data = data.filter((log) => {
      const d = new Date(log.createdAt);
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    });
  }

  return { ...result, data };
}
