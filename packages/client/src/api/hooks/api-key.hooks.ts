import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiDelete } from "../client";
import type { ApiKey, ApiKeyCreateResult } from "@emp-billing/shared";

const API_KEYS_KEY = "api-keys";

export function useApiKeys() {
  return useQuery({
    queryKey: [API_KEYS_KEY],
    queryFn: () => apiGet<ApiKey[]>("/api-keys"),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; scopes?: string[]; expiresAt?: string }) =>
      apiPost<ApiKeyCreateResult>("/api-keys", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [API_KEYS_KEY] });
      toast.success("API key created");
    },
    onError: () => toast.error("Failed to create API key"),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [API_KEYS_KEY] });
      toast.success("API key revoked");
    },
    onError: () => toast.error("Failed to revoke API key"),
  });
}
