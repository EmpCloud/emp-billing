import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { ScheduledReport, ApiResponse } from "@emp-billing/shared";

const SCHEDULED_REPORT_KEY = "scheduled-reports";

export function useScheduledReports() {
  return useQuery({
    queryKey: [SCHEDULED_REPORT_KEY],
    queryFn: () => apiGet<ScheduledReport[]>("/scheduled-reports"),
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<ScheduledReport>("/scheduled-reports", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCHEDULED_REPORT_KEY] });
      toast.success("Scheduled report created");
    },
    onError: () => toast.error("Failed to create scheduled report"),
  });
}

export function useUpdateScheduledReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPut<ScheduledReport>(`/scheduled-reports/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCHEDULED_REPORT_KEY] });
      toast.success("Scheduled report updated");
    },
    onError: () => toast.error("Failed to update scheduled report"),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/scheduled-reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCHEDULED_REPORT_KEY] });
      toast.success("Scheduled report deleted");
    },
    onError: () => toast.error("Failed to delete scheduled report"),
  });
}
