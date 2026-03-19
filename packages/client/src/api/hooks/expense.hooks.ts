import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { Expense, ExpenseCategory, Invoice, InvoiceItem, ApiResponse } from "@emp-billing/shared";

const EXPENSES_KEY = "expenses";
const INVOICES_KEY = "invoices";
const EXPENSE_CATEGORIES_KEY = "expense-categories";

export function useExpenses(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [EXPENSES_KEY, params],
    queryFn: () => apiGet<Expense[]>("/expenses", params as Record<string, unknown>),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: [EXPENSES_KEY, id],
    queryFn: () => apiGet<Expense>(`/expenses/${id}`),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Expense>("/expenses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      toast.success("Expense created");
      navigate("/expenses");
    },
    onError: () => toast.error("Failed to create expense"),
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Expense>(`/expenses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      toast.success("Expense updated");
    },
    onError: () => toast.error("Failed to update expense"),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      toast.success("Expense deleted");
      navigate("/expenses");
    },
    onError: () => toast.error("Failed to delete expense"),
  });
}

export function useBillExpense() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ expense: Expense; invoice: Invoice & { items: InvoiceItem[] } }>(`/expenses/${id}/bill`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: [EXPENSES_KEY] });
      qc.invalidateQueries({ queryKey: [INVOICES_KEY] });
      toast.success("Expense converted to invoice");
      const invoiceId = res.data?.invoice?.id;
      if (invoiceId) {
        navigate(`/invoices/${invoiceId}`);
      }
    },
    onError: () => toast.error("Failed to convert expense to invoice"),
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: [EXPENSE_CATEGORIES_KEY],
    queryFn: () => apiGet<ExpenseCategory[]>("/expenses/categories"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<ExpenseCategory>("/expenses/categories", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSE_CATEGORIES_KEY] });
      toast.success("Category created");
    },
    onError: () => toast.error("Failed to create category"),
  });
}
