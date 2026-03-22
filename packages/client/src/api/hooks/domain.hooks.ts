import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiDelete } from "../client";
import type { CustomDomain } from "@emp-billing/shared";

const DOMAINS_KEY = "custom-domains";

export function useListDomains() {
  return useQuery({
    queryKey: [DOMAINS_KEY],
    queryFn: () => apiGet<CustomDomain[]>("/domains"),
  });
}

export function useAddDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { domain: string }) => apiPost<CustomDomain>("/domains", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOMAINS_KEY] });
      toast.success("Domain added");
    },
    onError: () => toast.error("Failed to add domain"),
  });
}

export function useRemoveDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/domains/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOMAINS_KEY] });
      toast.success("Domain removed");
    },
    onError: () => toast.error("Failed to remove domain"),
  });
}

export function useVerifyDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<CustomDomain>(`/domains/${id}/verify`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [DOMAINS_KEY] });
      if (data.data?.verified) {
        toast.success("Domain verified successfully");
      } else {
        toast.error("DNS verification failed — CNAME record not found");
      }
    },
    onError: () => toast.error("Failed to verify domain"),
  });
}
