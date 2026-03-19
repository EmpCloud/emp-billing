import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "../client";
import type { UsageRecord } from "@emp-billing/shared";

const USAGE_KEY = "usage";

export function useUsageRecords(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [USAGE_KEY, params],
    queryFn: () => apiGet<UsageRecord[]>("/usage", params as Record<string, unknown>),
  });
}

export function useUsageSummary(params: {
  productId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return useQuery({
    queryKey: [USAGE_KEY, "summary", params],
    queryFn: () =>
      apiGet<{ totalQuantity: number; totalAmount: number; recordCount: number }>(
        "/usage/summary",
        params as Record<string, unknown>
      ),
    enabled: !!(params.productId && params.clientId && params.periodStart && params.periodEnd),
  });
}

export function useRecordUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<UsageRecord>("/usage", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [USAGE_KEY] });
      toast.success("Usage recorded");
    },
    onError: () => toast.error("Failed to record usage"),
  });
}
