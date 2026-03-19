import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPost, apiPut, apiDelete } from "../client";
import type { Webhook, WebhookDelivery, ApiResponse } from "@emp-billing/shared";

const WEBHOOKS_KEY = "webhooks";
const DELIVERIES_KEY = "webhook-deliveries";

export function useWebhooks() {
  return useQuery({
    queryKey: [WEBHOOKS_KEY],
    queryFn: () => apiGet<Webhook[]>("/webhooks"),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Webhook>("/webhooks", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      toast.success("Webhook created");
    },
    onError: () => toast.error("Failed to create webhook"),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiPut<Webhook>(`/webhooks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      toast.success("Webhook updated");
    },
    onError: () => toast.error("Failed to update webhook"),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/webhooks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      toast.success("Webhook deleted");
    },
    onError: () => toast.error("Failed to delete webhook"),
  });
}

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/webhooks/${id}/test`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
      qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      toast.success("Test event sent");
    },
    onError: () => toast.error("Failed to send test event"),
  });
}

export function useWebhookDeliveries(webhookId: string | null) {
  return useQuery({
    queryKey: [DELIVERIES_KEY, webhookId],
    queryFn: () => apiGet<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`),
    enabled: !!webhookId,
  });
}

export function useRetryDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, deliveryId }: { webhookId: string; deliveryId: string }) =>
      apiPost(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
      qc.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      toast.success("Delivery retried");
    },
    onError: () => toast.error("Failed to retry delivery"),
  });
}
