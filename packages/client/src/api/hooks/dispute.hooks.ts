import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPut } from "../client";
import type { Dispute, ApiResponse } from "@emp-billing/shared";

const DISPUTES_KEY = "disputes";

export function useDisputes(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [DISPUTES_KEY, params],
    queryFn: () => apiGet<Dispute[]>("/disputes", params as Record<string, unknown>),
  });
}

export function useDispute(id: string) {
  return useQuery({
    queryKey: [DISPUTES_KEY, id],
    queryFn: () => apiGet<Dispute>(`/disputes/${id}`),
    enabled: !!id,
  });
}

export function useUpdateDispute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Dispute>(`/disputes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DISPUTES_KEY] });
      qc.invalidateQueries({ queryKey: [DISPUTES_KEY, id] });
      toast.success("Dispute updated");
    },
    onError: () => toast.error("Failed to update dispute"),
  });
}
