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

// ── Portal Access ───────────────────────────────────────────────────────────

export function usePortalAccessStatus(clientId: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, clientId, "portal-access"],
    queryFn: () => apiGet<{ portalEnabled: boolean; portalEmail: string | null; hasActiveAccess: boolean }>(`/clients/${clientId}/portal-access`),
    enabled: !!clientId,
  });
}

export function useRegeneratePortalToken(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ portalToken: string; portalUrl: string }>(`/clients/${clientId}/portal-access/regenerate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY, clientId] });
      toast.success("Portal token generated");
    },
    onError: () => toast.error("Failed to generate portal token"),
  });
}

export function useRevokePortalAccess(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/clients/${clientId}/portal-access`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY, clientId] });
      toast.success("Portal access revoked");
    },
    onError: () => toast.error("Failed to revoke portal access"),
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
    mutationFn: (csv: string) =>
      apiPost<{ imported: number; skipped: number; errors: string[] }>("/clients/import/csv", { csv }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      const data = res.data;
      if (data && data.imported > 0) {
        toast.success(`Imported ${data.imported} client${data.imported === 1 ? "" : "s"}${data.skipped ? ` (${data.skipped} skipped)` : ""}`);
      } else if (data && data.skipped > 0) {
        toast.error(`No clients imported — ${data.skipped} row${data.skipped === 1 ? "" : "s"} skipped. ${data.errors?.[0] ?? ""}`);
      } else {
        toast.success("Clients imported successfully");
      }
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || "Failed to import clients");
    },
  });
}
