import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";

const AUDIT_LOGS_KEY = "audit-logs";

interface AuditLogFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
}

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: [AUDIT_LOGS_KEY, filters],
    queryFn: () =>
      apiGet("/organizations/audit-logs", filters as Record<string, unknown>),
  });
}
