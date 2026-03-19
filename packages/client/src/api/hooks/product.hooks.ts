import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete, api } from "../client";
import type { Product, TaxRate } from "@emp-billing/shared";

const PRODUCTS_KEY = "products";
const TAX_RATES_KEY = "tax-rates";

export function useProducts(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, params],
    queryFn: () => apiGet<Product[]>("/products", params as Record<string, unknown>),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, id],
    queryFn: () => apiGet<Product>(`/products/${id}`),
    enabled: !!id,
  });
}

export function useTaxRates() {
  return useQuery({
    queryKey: [TAX_RATES_KEY],
    queryFn: () => apiGet<TaxRate[]>("/products/tax-rates"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<TaxRate>("/products/tax-rates", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAX_RATES_KEY] });
      toast.success("Tax rate created");
    },
    onError: () => toast.error("Failed to create tax rate"),
  });
}

export function useUpdateTaxRate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<TaxRate>(`/products/tax-rates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAX_RATES_KEY] });
      toast.success("Tax rate updated");
    },
    onError: () => toast.error("Failed to update tax rate"),
  });
}

export function useDeleteTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/products/tax-rates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAX_RATES_KEY] });
      toast.success("Tax rate deleted");
    },
    onError: () => toast.error("Failed to delete tax rate"),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Product>("/products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
      toast.success("Product created");
    },
    onError: () => toast.error("Failed to create product"),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Product>(`/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
      toast.success("Product updated");
    },
    onError: () => toast.error("Failed to update product"),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
      toast.success("Product deleted");
    },
    onError: () => toast.error("Failed to delete product"),
  });
}

export function useExportProductsCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await api.get("/products/export/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "products.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Products exported successfully");
    } catch {
      toast.error("Failed to export products");
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportCSV, isExporting };
}

export function useImportProductsCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post("/products/import/csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
      toast.success("Products imported successfully");
    },
    onError: () => toast.error("Failed to import products"),
  });
}
