import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, api } from "../client";
import type { CreditNote, ApiResponse } from "@emp-billing/shared";

const CREDIT_NOTES_KEY = "credit-notes";
const INVOICES_KEY = "invoices";

export function useCreditNotes(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [CREDIT_NOTES_KEY, params],
    queryFn: () => apiGet<CreditNote[]>("/credit-notes", params as Record<string, unknown>),
  });
}

export function useCreditNote(id: string) {
  return useQuery({
    queryKey: [CREDIT_NOTES_KEY, id],
    queryFn: () => apiGet<CreditNote>(`/credit-notes/${id}`),
    enabled: !!id,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<CreditNote>("/credit-notes", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY] });
      toast.success("Credit note created");
      if (res.data) navigate(`/credit-notes/${(res.data as CreditNote).id}`);
    },
    onError: () => toast.error("Failed to create credit note"),
  });
}

export function useUpdateCreditNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<CreditNote>(`/credit-notes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY] });
      toast.success("Credit note updated");
    },
    onError: () => toast.error("Failed to update credit note"),
  });
}

export function useApplyCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; invoiceId: string; amount: number }) =>
      apiPost(`/credit-notes/${id}/apply`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY] });
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Credit note applied");
    },
    onError: () => toast.error("Failed to apply credit note"),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/credit-notes/${id}/void`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY, id] });
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY] });
      toast.success("Credit note voided");
    },
    onError: () => toast.error("Failed to void credit note"),
  });
}

export function useDeleteCreditNote() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/credit-notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CREDIT_NOTES_KEY] });
      toast.success("Credit note deleted");
      navigate("/credit-notes");
    },
    onError: () => toast.error("Failed to delete credit note"),
  });
}

export function useDownloadCreditNotePdf(id: string) {
  return async () => {
    const res = await api.get(`/credit-notes/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-note-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
