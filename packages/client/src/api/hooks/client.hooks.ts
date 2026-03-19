import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, api } from "../client";
import type { Client, ApiResponse } from "@emp-billing/shared";

const CLIENTS_KEY = "clients";

export function useClients(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [CLIENTS_KEY, params],
    queryFn: () => apiGet<Client[]>("/clients", params as Record<string, unknown>),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, id],
    queryFn: () => apiGet<Client & { contacts: unknown[] }>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useClientStatement(id: string, from?: string, to?: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, id, "statement", from, to],
    queryFn: () => apiGet(`/clients/${id}/statement`, { from, to }),
    enabled: !!id,
  });
}

export function useClientBalance(id: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, id, "balance"],
    queryFn: () => apiGet(`/clients/${id}/balance`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Client>("/clients", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      toast.success("Client created");
    },
    onError: () => toast.error("Failed to create client"),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Client>(`/clients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      toast.success("Client updated");
    },
    onError: () => toast.error("Failed to update client"),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      toast.success("Client deleted");
    },
    onError: () => toast.error("Failed to delete client"),
  });
}

export function useExportClientsCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await api.get("/clients/export/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "clients.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Clients exported successfully");
    } catch {
      toast.error("Failed to export clients");
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportCSV, isExporting };
}

export function useImportClientsCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post("/clients/import/csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      toast.success("Clients imported successfully");
    },
    onError: () => toast.error("Failed to import clients"),
  });
}
