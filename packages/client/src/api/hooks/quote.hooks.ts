import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, api } from "../client";
import type { Quote, Invoice, ApiResponse } from "@emp-billing/shared";

const QUOTES_KEY = "quotes";

export function useQuotes(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [QUOTES_KEY, params],
    queryFn: () => apiGet<Quote[]>("/quotes", params as Record<string, unknown>),
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: [QUOTES_KEY, id],
    queryFn: () => apiGet<Quote & { items: unknown[] }>(`/quotes/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Quote>("/quotes", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [QUOTES_KEY] });
      toast.success("Quote created");
      if (res.data) navigate(`/quotes/${(res.data as Quote).id}`);
    },
    onError: () => toast.error("Failed to create quote"),
  });
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Quote>(`/quotes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUOTES_KEY] });
      toast.success("Quote updated");
    },
    onError: () => toast.error("Failed to update quote"),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/quotes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUOTES_KEY] });
      toast.success("Quote deleted");
      navigate("/quotes");
    },
    onError: () => toast.error("Failed to delete quote"),
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/quotes/${id}/send`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [QUOTES_KEY, id] });
      toast.success("Quote sent");
    },
    onError: () => toast.error("Failed to send quote"),
  });
}

export function useConvertQuoteToInvoice() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiPost<Invoice>(`/quotes/${id}/convert`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [QUOTES_KEY] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Quote converted to invoice");
      if (res.data) navigate(`/invoices/${(res.data as Invoice).id}`);
    },
    onError: () => toast.error("Failed to convert quote to invoice"),
  });
}

export function useDownloadQuotePdf(id: string) {
  return async () => {
    const res = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `quote-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
