import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import { usePortalStore } from "@/store/portal.store";
import type { ApiResponse, Invoice, Quote, Payment, CreditNote, Dispute, Subscription, Plan, SubscriptionEvent } from "@emp-billing/shared";

// ── Portal-specific axios instance ──────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const portalApi = axios.create({
  baseURL: `${API_BASE}/portal`,
  headers: { "Content-Type": "application/json" },
});

portalApi.interceptors.request.use((config) => {
  const { portalToken } = usePortalStore.getState();
  if (portalToken) config.headers.Authorization = `Bearer ${portalToken}`;
  return config;
});

portalApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      usePortalStore.getState().clearPortalAuth();
      window.location.href = "/portal/login";
    }
    return Promise.reject(err);
  }
);

async function portalGet<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  return (await portalApi.get<ApiResponse<T>>(url, { params })).data;
}

async function portalPost<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return (await portalApi.post<ApiResponse<T>>(url, body)).data;
}

async function portalPut<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  return (await portalApi.put<ApiResponse<T>>(url, body)).data;
}

async function portalDelete<T>(url: string): Promise<ApiResponse<T>> {
  return (await portalApi.delete<ApiResponse<T>>(url)).data;
}

// ── Query keys ──────────────────────────────────────────────────────────────

const PORTAL_DASHBOARD_KEY = "portal-dashboard";
const PORTAL_INVOICES_KEY = "portal-invoices";
const PORTAL_QUOTES_KEY = "portal-quotes";
const PORTAL_PAYMENTS_KEY = "portal-payments";
const PORTAL_CREDIT_NOTES_KEY = "portal-credit-notes";
const PORTAL_STATEMENT_KEY = "portal-statement";
const PORTAL_DISPUTES_KEY = "portal-disputes";

// ── Login ───────────────────────────────────────────────────────────────────

interface PortalLoginResponse {
  token: string;
  clientId: string;
  clientName: string;
  orgId: string;
  orgName: string;
  brandPrimary?: string;
  logoUrl?: string;
}

export function usePortalLogin() {
  const { setPortalAuth } = usePortalStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; token: string }) =>
      portalPost<PortalLoginResponse>("/login", data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        const d = res.data as PortalLoginResponse;
        setPortalAuth(d.token, d.clientId, d.orgName, d.clientName, d.brandPrimary, d.logoUrl);
        navigate("/portal");
      }
    },
    onError: () => toast.error("Invalid email or access token"),
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────

interface PortalDashboardData {
  outstandingBalance: number;
  currency: string;
  recentInvoices: Invoice[];
  recentPayments: Payment[];
  pendingQuotesCount: number;
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: [PORTAL_DASHBOARD_KEY],
    queryFn: () => portalGet<PortalDashboardData>("/dashboard"),
  });
}

// ── Invoices ────────────────────────────────────────────────────────────────

export function usePortalInvoices(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [PORTAL_INVOICES_KEY, params],
    queryFn: () => portalGet<Invoice[]>("/invoices", params as Record<string, unknown>),
  });
}

export function usePortalInvoice(id: string) {
  return useQuery({
    queryKey: [PORTAL_INVOICES_KEY, id],
    queryFn: () => portalGet<Invoice & { items: unknown[] }>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useDownloadPortalInvoicePdf(id: string) {
  return async () => {
    const res = await portalApi.get(`/invoices/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// ── Quotes ──────────────────────────────────────────────────────────────────

export function usePortalQuotes() {
  return useQuery({
    queryKey: [PORTAL_QUOTES_KEY],
    queryFn: () => portalGet<Quote[]>("/quotes"),
  });
}

export function useAcceptPortalQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalPost<Quote>(`/quotes/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_QUOTES_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_DASHBOARD_KEY] });
      toast.success("Quote accepted");
    },
    onError: () => toast.error("Failed to accept quote"),
  });
}

export function useDeclinePortalQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalPost<Quote>(`/quotes/${id}/decline`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_QUOTES_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_DASHBOARD_KEY] });
      toast.success("Quote declined");
    },
    onError: () => toast.error("Failed to decline quote"),
  });
}

// ── Payments ────────────────────────────────────────────────────────────────

export function usePortalPayments() {
  return useQuery({
    queryKey: [PORTAL_PAYMENTS_KEY],
    queryFn: () => portalGet<Payment[]>("/payments"),
  });
}

// ── Credit Notes ───────────────────────────────────────────────────────────

export function usePortalCreditNotes() {
  return useQuery({
    queryKey: [PORTAL_CREDIT_NOTES_KEY],
    queryFn: () => portalGet<CreditNote[]>("/credit-notes"),
  });
}

// ── Statement ──────────────────────────────────────────────────────────────

interface StatementEntry {
  date: string;
  type: "invoice" | "payment" | "credit_note";
  number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementData {
  client: Record<string, unknown>;
  entries: StatementEntry[];
  openingBalance: number;
  closingBalance: number;
  currency: string;
}

export function usePortalStatement(from?: string, to?: string) {
  return useQuery({
    queryKey: [PORTAL_STATEMENT_KEY, from, to],
    queryFn: () => portalGet<StatementData>("/statement", { from, to } as Record<string, unknown>),
  });
}

// ── Disputes ────────────────────────────────────────────────────────────────

export function usePortalDisputes(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [PORTAL_DISPUTES_KEY, params],
    queryFn: () => portalGet<Dispute[]>("/disputes", params as Record<string, unknown>),
  });
}

export function usePortalDispute(id: string) {
  return useQuery({
    queryKey: [PORTAL_DISPUTES_KEY, id],
    queryFn: () => portalGet<Dispute>(`/disputes/${id}`),
    enabled: !!id,
  });
}

export function useCreatePortalDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceId?: string; reason: string }) =>
      portalPost<Dispute>("/disputes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_DISPUTES_KEY] });
      toast.success("Dispute raised successfully");
    },
    onError: () => toast.error("Failed to raise dispute"),
  });
}

// ── Online Payments ─────────────────────────────────────────────────────────

const PORTAL_PAYMENT_GATEWAYS_KEY = "portal-payment-gateways";

interface PaymentGateway {
  name: string;
  displayName: string;
}

interface CreatePaymentOrderResult {
  gatewayOrderId: string;
  checkoutUrl?: string;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
}

export function usePortalPaymentGateways() {
  return useQuery({
    queryKey: [PORTAL_PAYMENT_GATEWAYS_KEY],
    queryFn: () => portalGet<PaymentGateway[]>("/payment-gateways"),
  });
}

export function usePortalCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceId: string; gateway: string }) =>
      portalPost<CreatePaymentOrderResult>("/pay", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_INVOICES_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_PAYMENTS_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_DASHBOARD_KEY] });
    },
    onError: () => toast.error("Failed to initiate payment"),
  });
}

/**
 * Convenience hook for the portal "Pay Online" flow.
 * Calls POST /portal/pay and handles the redirect to the gateway checkout URL.
 * Returns { pay, isPending } for binding to a pay button.
 */
export function usePortalPay() {
  const createPayment = usePortalCreatePayment();

  const pay = async (invoiceId: string, gateway: string): Promise<CreatePaymentOrderResult | null> => {
    try {
      const res = await createPayment.mutateAsync({ invoiceId, gateway });
      const order = res.data as CreatePaymentOrderResult;

      if (order.checkoutUrl) {
        // Stripe / PayPal hosted checkout: redirect the browser
        window.location.href = order.checkoutUrl;
        return order;
      }

      // Return order data for client-side gateways (e.g. Razorpay popup)
      return order;
    } catch {
      // Error toast already fired by mutation onError
      return null;
    }
  };

  return { pay, isPending: createPayment.isPending };
}

// ── Subscriptions ────────────────────────────────────────────────────────

const PORTAL_SUBSCRIPTIONS_KEY = "portal-subscriptions";
const PORTAL_PLANS_KEY = "portal-plans";

export function usePortalSubscriptions() {
  return useQuery({
    queryKey: [PORTAL_SUBSCRIPTIONS_KEY],
    queryFn: () => portalGet<(Subscription & { plan?: Plan })[]>("/subscriptions"),
  });
}

export function usePortalSubscription(id: string) {
  return useQuery({
    queryKey: [PORTAL_SUBSCRIPTIONS_KEY, id],
    queryFn: () => portalGet<Subscription & { plan?: Plan; events?: SubscriptionEvent[] }>(`/subscriptions/${id}`),
    enabled: !!id,
  });
}

export function usePortalPlans() {
  return useQuery({
    queryKey: [PORTAL_PLANS_KEY],
    queryFn: () => portalGet<Plan[]>("/plans"),
  });
}

export function usePortalChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, newPlanId }: { subscriptionId: string; newPlanId: string }) =>
      portalPost<Subscription & { plan?: Plan }>(`/subscriptions/${subscriptionId}/change-plan`, { newPlanId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_SUBSCRIPTIONS_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_DASHBOARD_KEY] });
      toast.success("Plan changed successfully");
    },
    onError: () => toast.error("Failed to change plan"),
  });
}

export function usePortalCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, reason }: { subscriptionId: string; reason?: string }) =>
      portalPost<Subscription>(`/subscriptions/${subscriptionId}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_SUBSCRIPTIONS_KEY] });
      qc.invalidateQueries({ queryKey: [PORTAL_DASHBOARD_KEY] });
      toast.success("Subscription cancelled");
    },
    onError: () => toast.error("Failed to cancel subscription"),
  });
}

// ── Payment Method ─────────────────────────────────────────────────────────

const PORTAL_PAYMENT_METHOD_KEY = "portal-payment-method";

export interface PortalPaymentMethodInfo {
  hasPaymentMethod: boolean;
  paymentGateway: string | null;
  last4: string | null;
  brand: string | null;
}

export function usePortalPaymentMethod() {
  return useQuery({
    queryKey: [PORTAL_PAYMENT_METHOD_KEY],
    queryFn: () => portalGet<PortalPaymentMethodInfo>("/payment-method"),
  });
}

export function useUpdatePortalPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { paymentGateway: string; paymentMethodId: string; last4: string; brand: string }) =>
      portalPut<PortalPaymentMethodInfo>("/payment-method", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_PAYMENT_METHOD_KEY] });
      toast.success("Payment method updated");
    },
    onError: () => toast.error("Failed to update payment method"),
  });
}

export function useRemovePortalPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => portalDelete<PortalPaymentMethodInfo>("/payment-method"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTAL_PAYMENT_METHOD_KEY] });
      toast.success("Payment method removed");
    },
    onError: () => toast.error("Failed to remove payment method"),
  });
}
