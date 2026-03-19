import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiDelete, api } from "../client";
import type { Payment } from "@emp-billing/shared";

const PAYMENTS_KEY = "payments";

export function usePayments(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, params],
    queryFn: () => apiGet<Payment[]>("/payments", params as Record<string, unknown>),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, id],
    queryFn: () => apiGet<Payment>(`/payments/${id}`),
    enabled: !!id,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Payment>("/payments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Payment recorded");
    },
    onError: () => toast.error("Failed to record payment"),
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; amount: number; reason?: string }) =>
      apiPost<Payment>(`/payments/${id}/refund`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      toast.success("Refund processed");
    },
    onError: () => toast.error("Failed to process refund"),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Payment deleted");
    },
    onError: () => toast.error("Failed to delete payment"),
  });
}

export function useDownloadPaymentReceipt(id: string) {
  return async () => {
    const res = await api.get(`/payments/${id}/receipt`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
