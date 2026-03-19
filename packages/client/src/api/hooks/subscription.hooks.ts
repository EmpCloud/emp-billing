import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { Plan, Subscription, SubscriptionEvent, ApiResponse } from "@emp-billing/shared";

const PLANS_KEY = "plans";
const SUBSCRIPTIONS_KEY = "subscriptions";

// ============================================================================
// PLAN HOOKS
// ============================================================================

export function usePlans() {
  return useQuery({
    queryKey: [PLANS_KEY],
    queryFn: () => apiGet<Plan[]>("/subscriptions/plans"),
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: [PLANS_KEY, id],
    queryFn: () => apiGet<Plan>(`/subscriptions/plans/${id}`),
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Plan>("/subscriptions/plans", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
      toast.success("Plan created");
      navigate("/subscriptions/plans");
    },
    onError: () => toast.error("Failed to create plan"),
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Plan>(`/subscriptions/plans/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
      toast.success("Plan updated");
      navigate("/subscriptions/plans");
    },
    onError: () => toast.error("Failed to update plan"),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/subscriptions/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PLANS_KEY] });
      toast.success("Plan deleted");
    },
    onError: () => toast.error("Failed to delete plan"),
  });
}

// ============================================================================
// SUBSCRIPTION HOOKS
// ============================================================================

export function useSubscriptions(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, params],
    queryFn: () => apiGet<Subscription[]>("/subscriptions", params as Record<string, unknown>),
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, id],
    queryFn: () => apiGet<Subscription & { plan?: Plan; events?: SubscriptionEvent[] }>(`/subscriptions/${id}`),
    enabled: !!id,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Subscription>("/subscriptions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      toast.success("Subscription created");
      navigate("/subscriptions");
    },
    onError: () => toast.error("Failed to create subscription"),
  });
}

export function useChangePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { newPlanId: string; prorate?: boolean }) =>
      apiPut<Subscription>(`/subscriptions/${id}/change-plan`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      toast.success("Plan changed successfully");
    },
    onError: () => toast.error("Failed to change plan"),
  });
}

export function useCancelSubscription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason?: string; cancelImmediately?: boolean }) =>
      apiPost<Subscription>(`/subscriptions/${id}/cancel`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      toast.success("Subscription cancelled");
    },
    onError: () => toast.error("Failed to cancel subscription"),
  });
}

export function usePauseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Subscription>(`/subscriptions/${id}/pause`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY, id] });
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      toast.success("Subscription paused");
    },
    onError: () => toast.error("Failed to pause subscription"),
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Subscription>(`/subscriptions/${id}/resume`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY, id] });
      qc.invalidateQueries({ queryKey: [SUBSCRIPTIONS_KEY] });
      toast.success("Subscription resumed");
    },
    onError: () => toast.error("Failed to resume subscription"),
  });
}

export function useSubscriptionEvents(subscriptionId: string) {
  return useQuery({
    queryKey: [SUBSCRIPTIONS_KEY, subscriptionId, "events"],
    queryFn: () => apiGet<SubscriptionEvent[]>(`/subscriptions/${subscriptionId}/events`),
    enabled: !!subscriptionId,
  });
}
