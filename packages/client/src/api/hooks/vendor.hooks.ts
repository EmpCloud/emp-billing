import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { Vendor } from "@emp-billing/shared";

const VENDORS_KEY = "vendors";

export function useVendors(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [VENDORS_KEY, params],
    queryFn: () => apiGet<Vendor[]>("/vendors", params as Record<string, unknown>),
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: [VENDORS_KEY, id],
    queryFn: () => apiGet<Vendor>(`/vendors/${id}`),
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Vendor>("/vendors", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [VENDORS_KEY] });
      toast.success("Vendor created");
    },
    onError: () => toast.error("Failed to create vendor"),
  });
}

export function useUpdateVendor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Vendor>(`/vendors/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [VENDORS_KEY] });
      toast.success("Vendor updated");
    },
    onError: () => toast.error("Failed to update vendor"),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/vendors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [VENDORS_KEY] });
      toast.success("Vendor deleted");
    },
    onError: () => toast.error("Failed to delete vendor"),
  });
}
