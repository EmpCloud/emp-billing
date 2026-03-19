import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiPut, apiPost } from "../client";
import type { Notification, ApiResponse } from "@emp-billing/shared";

const NOTIFICATIONS_KEY = "notifications";
const UNREAD_COUNT_KEY = "notifications-unread-count";

export function useNotifications(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, params],
    queryFn: () => apiGet<Notification[]>("/notifications", params as Record<string, unknown>),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [UNREAD_COUNT_KEY],
    queryFn: () => apiGet<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30 * 1000, // poll every 30 seconds
  });
}

export function useMarkNotificationAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPut<Notification>(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
    },
    onError: () => toast.error("Failed to mark notification as read"),
  });
}

export function useMarkAllNotificationsAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/notifications/mark-all-read"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
      toast.success("All notifications marked as read");
    },
    onError: () => toast.error("Failed to mark all as read"),
  });
}
