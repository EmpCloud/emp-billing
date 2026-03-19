import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiPost } from "../client";
import type { DunningConfig, DunningAttempt, DunningAttemptStatus } from "@emp-billing/shared";
import toast from "react-hot-toast";

const DUNNING_KEY = "dunning";

// ── Config ──────────────────────────────────────────────────────────────────

export function useDunningConfig() {
  return useQuery({
    queryKey: [DUNNING_KEY, "config"],
    queryFn: () => apiGet<DunningConfig>("/dunning/config"),
  });
}

export function useUpdateDunningConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DunningConfig>) =>
      apiPut<DunningConfig>("/dunning/config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DUNNING_KEY, "config"] });
      toast.success("Dunning config updated");
    },
    onError: () => {
      toast.error("Failed to update dunning config");
    },
  });
}

// ── Attempts ────────────────────────────────────────────────────────────────

export function useDunningAttempts(params?: {
  page?: number;
  limit?: number;
  status?: DunningAttemptStatus;
  invoiceId?: string;
}) {
  return useQuery({
    queryKey: [DUNNING_KEY, "attempts", params],
    queryFn: () =>
      apiGet<DunningAttempt[]>("/dunning/attempts", params as Record<string, any>),
  });
}

// ── Summary ─────────────────────────────────────────────────────────────────

export function useDunningSummary() {
  return useQuery({
    queryKey: [DUNNING_KEY, "summary"],
    queryFn: () =>
      apiGet<{
        totalPending: number;
        failedThisMonth: number;
        recoveredAmount: number;
      }>("/dunning/summary"),
  });
}

// ── Manual Retry ────────────────────────────────────────────────────────────

export function useRetryDunning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) =>
      apiPost<{ message: string }>(`/dunning/attempts/${attemptId}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DUNNING_KEY] });
      toast.success("Retry processed");
    },
    onError: () => {
      toast.error("Retry failed");
    },
  });
}
