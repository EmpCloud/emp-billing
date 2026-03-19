import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";
import type {
  MRRMetrics,
  ARRMetrics,
  ChurnMetrics,
  LTVMetrics,
  RevenueBreakdownMonth,
  SubscriptionStats,
  CohortRow,
} from "@emp-billing/shared";

const METRICS_KEY = "metrics";

export function useMRR() {
  return useQuery({
    queryKey: [METRICS_KEY, "mrr"],
    queryFn: () => apiGet<MRRMetrics>("/metrics/mrr"),
  });
}

export function useARR() {
  return useQuery({
    queryKey: [METRICS_KEY, "arr"],
    queryFn: () => apiGet<ARRMetrics>("/metrics/arr"),
  });
}

export function useChurnMetrics(from?: string, to?: string) {
  return useQuery({
    queryKey: [METRICS_KEY, "churn", from, to],
    queryFn: () => apiGet<ChurnMetrics>("/metrics/churn", { from, to }),
  });
}

export function useLTV() {
  return useQuery({
    queryKey: [METRICS_KEY, "ltv"],
    queryFn: () => apiGet<LTVMetrics>("/metrics/ltv"),
  });
}

export function useRevenueBreakdown(months?: number) {
  return useQuery({
    queryKey: [METRICS_KEY, "revenue-breakdown", months],
    queryFn: () =>
      apiGet<RevenueBreakdownMonth[]>("/metrics/revenue-breakdown", {
        months,
      }),
  });
}

export function useSubscriptionStats() {
  return useQuery({
    queryKey: [METRICS_KEY, "subscription-stats"],
    queryFn: () => apiGet<SubscriptionStats>("/metrics/subscription-stats"),
  });
}

export function useCohortAnalysis(months?: number) {
  return useQuery({
    queryKey: [METRICS_KEY, "cohort", months],
    queryFn: () => apiGet<CohortRow[]>("/metrics/cohort", { months }),
  });
}
