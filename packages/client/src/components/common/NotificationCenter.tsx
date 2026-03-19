import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, FileText, CreditCard, Receipt, TrendingUp, CheckCheck,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/api/hooks/notification.hooks";
import type { Notification } from "@emp-billing/shared";

dayjs.extend(relativeTime);

const NOTIFICATION_ICON: Record<string, typeof FileText> = {
  invoice_created: FileText,
  invoice_sent: FileText,
  invoice_paid: FileText,
  invoice_overdue: FileText,
  payment_received: CreditCard,
  quote_accepted: Receipt,
  quote_expired: Receipt,
  expense_approved: TrendingUp,
};

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  invoice: (id) => `/invoices/${id}`,
  payment: (id) => `/payments/${id}`,
  quote: (id) => `/quotes/${id}`,
  expense: (id) => `/expenses/${id}`,
  client: (id) => `/clients/${id}`,
  product: (id) => `/products/${id}`,
  vendor: (id) => `/vendors/${id}`,
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: countData } = useUnreadNotificationCount();
  const unreadCount = countData?.data?.count ?? 0;

  const { data: notifData, isLoading } = useNotifications({ page: 1, limit: 20 });
  const notifications = notifData?.data ?? [];

  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read
      if (!notification.isRead) {
        markAsRead.mutate(notification.id);
      }
      // Navigate to entity
      if (notification.entityType && notification.entityId) {
        const routeFn = ENTITY_ROUTES[notification.entityType];
        if (routeFn) {
          navigate(routeFn(notification.entityId));
          setIsOpen(false);
        }
      }
    },
    [markAsRead, navigate]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[28rem] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            )}

            {!isLoading &&
              notifications.map((notification: Notification) => {
                const Icon =
                  NOTIFICATION_ICON[notification.type] || FileText;
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      !notification.isRead ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${
                        !notification.isRead
                          ? "bg-brand-100 text-brand-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm truncate ${
                            !notification.isRead
                              ? "font-semibold text-gray-900"
                              : "font-medium text-gray-700"
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="flex-shrink-0 w-2 h-2 bg-brand-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {dayjs(notification.createdAt).fromNow()}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
