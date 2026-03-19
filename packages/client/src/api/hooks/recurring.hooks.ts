import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { RecurringProfile, ApiResponse } from "@emp-billing/shared";

const RECURRING_KEY = "recurring";

export function useRecurringProfiles(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [RECURRING_KEY, params],
    queryFn: () => apiGet<RecurringProfile[]>("/recurring", params as Record<string, unknown>),
  });
}

export function useRecurringProfile(id: string) {
  return useQuery({
    queryKey: [RECURRING_KEY, id],
    queryFn: () => apiGet<RecurringProfile>(`/recurring/${id}`),
    enabled: !!id,
  });
}

export function useCreateRecurringProfile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<RecurringProfile>("/recurring", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success("Recurring profile created");
      if (res.data) navigate(`/recurring`);
    },
    onError: () => toast.error("Failed to create recurring profile"),
  });
}

export function useUpdateRecurringProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<RecurringProfile>(`/recurring/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success("Recurring profile updated");
    },
    onError: () => toast.error("Failed to update recurring profile"),
  });
}

export function useDeleteRecurringProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/recurring/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success("Recurring profile deleted");
    },
    onError: () => toast.error("Failed to delete recurring profile"),
  });
}

export function usePauseRecurringProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/recurring/${id}/pause`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [RECURRING_KEY, id] });
      qc.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success("Recurring profile paused");
    },
    onError: () => toast.error("Failed to pause recurring profile"),
  });
}

export function useResumeRecurringProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/recurring/${id}/resume`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [RECURRING_KEY, id] });
      qc.invalidateQueries({ queryKey: [RECURRING_KEY] });
      toast.success("Recurring profile resumed");
    },
    onError: () => toast.error("Failed to resume recurring profile"),
  });
}

export interface RecurringExecution {
  id: string;
  profileId: string;
  orgId: string;
  generatedId: string | null;
  executionDate: string;
  status: "success" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useRecurringExecutions(profileId: string) {
  return useQuery({
    queryKey: [RECURRING_KEY, profileId, "executions"],
    queryFn: () => apiGet<RecurringExecution[]>(`/recurring/${profileId}/executions`),
    enabled: !!profileId,
  });
}
