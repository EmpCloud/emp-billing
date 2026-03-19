import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { Coupon, CouponRedemption } from "@emp-billing/shared";

const COUPONS_KEY = "coupons";

export function useCoupons(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [COUPONS_KEY, params],
    queryFn: () => apiGet<Coupon[]>("/coupons", params as Record<string, unknown>),
  });
}

export function useCoupon(id: string) {
  return useQuery({
    queryKey: [COUPONS_KEY, id],
    queryFn: () => apiGet<Coupon>(`/coupons/${id}`),
    enabled: !!id,
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Coupon>("/coupons", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COUPONS_KEY] });
      toast.success("Coupon created");
    },
    onError: () => toast.error("Failed to create coupon"),
  });
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<Coupon>(`/coupons/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COUPONS_KEY] });
      toast.success("Coupon updated");
    },
    onError: () => toast.error("Failed to update coupon"),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/coupons/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COUPONS_KEY] });
      toast.success("Coupon deactivated");
    },
    onError: () => toast.error("Failed to delete coupon"),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (data: { code: string; amount?: number; clientId?: string }) =>
      apiPost<{ valid: boolean; coupon: Coupon; discountAmount: number; message?: string }>(
        "/coupons/validate",
        data
      ),
    onError: () => toast.error("Invalid coupon code"),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; invoiceId: string; clientId: string }) =>
      apiPost<CouponRedemption>("/coupons/apply", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COUPONS_KEY] });
      toast.success("Coupon applied successfully");
    },
    onError: () => toast.error("Failed to apply coupon"),
  });
}

export function useCouponRedemptions(couponId: string) {
  return useQuery({
    queryKey: [COUPONS_KEY, couponId, "redemptions"],
    queryFn: () => apiGet<CouponRedemption[]>(`/coupons/${couponId}/redemptions`),
    enabled: !!couponId,
  });
}

export function useApplyCouponToSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; subscriptionId: string; clientId: string }) =>
      apiPost<CouponRedemption>("/coupons/apply-to-subscription", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: [COUPONS_KEY] });
      toast.success("Coupon applied to subscription");
    },
    onError: () => toast.error("Failed to apply coupon"),
  });
}

export function useRemoveCouponFromSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      apiDelete(`/coupons/subscription/${subscriptionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Coupon removed from subscription");
    },
    onError: () => toast.error("Failed to remove coupon"),
  });
}
