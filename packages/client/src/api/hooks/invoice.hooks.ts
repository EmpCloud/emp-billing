import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, api } from "../client";
import type { Invoice, ApiResponse } from "@emp-billing/shared";

const INVOICES_KEY = "invoices";

export function useInvoices(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [INVOICES_KEY, params],
    queryFn: () => apiGet<Invoice[]>("/invoices", params as Record<string, unknown>),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, id],
    queryFn: () => apiGet<Invoice & { items: unknown[] }>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useInvoicePayments(id: string) {
  return useQuery({
    queryKey: [INVOICES_KEY, id, "payments"],
    queryFn: () => apiGet(`/invoices/${id}/payments`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Invoice>("/invoices", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice created");
      if (res.data) navigate(`/invoices/${(res.data as Invoice).id}`);
    },
    onError: () => toast.error("Failed to create invoice"),
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Invoice>(`/invoices/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice updated");
    },
    onError: () => toast.error("Failed to update invoice"),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice deleted");
      navigate("/invoices");
    },
    onError: () => toast.error("Failed to delete invoice"),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/send`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY, id] });
      toast.success("Invoice sent");
    },
    onError: () => toast.error("Failed to send invoice"),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/void`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY, id] });
      toast.success("Invoice voided");
    },
    onError: () => toast.error("Failed to void invoice"),
  });
}

export function useWriteOffInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/write-off`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY, id] });
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice written off");
    },
    onError: () => toast.error("Failed to write off invoice"),
  });
}

export function useDuplicateInvoice() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiPost<Invoice>(`/invoices/${id}/duplicate`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Invoice duplicated");
      if (res.data) navigate(`/invoices/${(res.data as Invoice).id}`);
    },
    onError: () => toast.error("Failed to duplicate invoice"),
  });
}

export function useDownloadInvoicePdf(id: string) {
  return async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };
}

// ─── Attachment Upload ────────────────────────────────────────────────────────

export interface InvoiceAttachment {
  name: string;
  url: string;
  size: number;
}

/**
 * Upload a file as an invoice attachment.
 * Reads the file as a base64 data URI and POSTs to /uploads/attachments.
 * Returns the attachment object { name, url, size }.
 */
export async function uploadInvoiceAttachment(file: File): Promise<InvoiceAttachment> {
  const dataUri = await fileToDataUri(file);
  const res = await api.post("/uploads/attachments", {
    file: dataUri,
    filename: file.name,
  });
  const data = res.data?.data ?? res.data;
  return {
    name: data.originalName || file.name,
    url: data.url,
    size: data.size,
  };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file as an expense receipt.
 * Uses the /uploads/receipts endpoint.
 * Returns { name, url, size }.
 */
export async function uploadReceiptFile(file: File): Promise<InvoiceAttachment> {
  const dataUri = await fileToDataUri(file);
  const res = await api.post("/uploads/receipts", {
    file: dataUri,
    filename: file.name,
  });
  const data = res.data?.data ?? res.data;
  return {
    name: data.originalName || file.name,
    url: data.url,
    size: data.size,
  };
}

/**
 * Format file size to a human-readable string (KB / MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
