import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import type { Notification } from "@emp-billing/shared";
import { sendInvoiceSMS, sendPaymentReceivedSMS, sendPaymentReminderSMS } from "./sms.service";
import { sendInvoiceWhatsApp, sendPaymentReceivedWhatsApp, sendPaymentReminderWhatsApp } from "./whatsapp.service";

// ============================================================================
// NOTIFICATION SERVICE
// In-app notification CRUD + multi-channel dispatch (email, SMS, WhatsApp).
// ============================================================================

export type NotificationType =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "payment_received"
  | "quote_accepted"
  | "quote_expired"
  | "expense_approved"
  | "subscription_created"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "payment_failed"
  | "trial_ending";

export type NotificationChannel = "email" | "sms" | "whatsapp" | "in_app";

export interface NotificationChannelPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  inApp: boolean;
}

export interface CreateNotificationInput {
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface DispatchNotificationInput {
  orgId: string;
  type: NotificationType;
  /** Channels to send on — defaults to ["in_app"] if not specified */
  channels?: NotificationChannel[];
  /** For in-app notification */
  userId?: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  /** For email/SMS/WhatsApp */
  clientEmail?: string;
  clientPhone?: string;
  /** Context IDs for domain-specific sends */
  invoiceId?: string;
  paymentId?: string;
  quoteId?: string;
}

/**
 * Dispatch a notification across multiple channels.
 * Failures on individual channels are logged but do not block other channels.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  const channels = input.channels ?? ["in_app"];

  const promises: Array<Promise<void>> = [];

  // In-app notification
  if (channels.includes("in_app")) {
    promises.push(
      createNotification(input.orgId, {
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
      }).then(() => undefined),
    );
  }

  // SMS channel
  if (channels.includes("sms") && input.clientPhone) {
    const smsPromise = dispatchSMS(input).catch((err) => {
      logger.error("SMS dispatch failed (non-blocking)", { type: input.type, phone: input.clientPhone, err });
    });
    promises.push(smsPromise);
  }

  // WhatsApp channel
  if (channels.includes("whatsapp") && input.clientPhone) {
    const waPromise = dispatchWhatsApp(input).catch((err) => {
      logger.error("WhatsApp dispatch failed (non-blocking)", { type: input.type, phone: input.clientPhone, err });
    });
    promises.push(waPromise);
  }

  // Email channel is handled by existing email queue infrastructure.
  // Callers should continue to use queueInvoiceEmail / queuePaymentReceiptEmail
  // for email delivery. This dispatcher focuses on SMS + WhatsApp + in-app.

  await Promise.allSettled(promises);
}

async function dispatchSMS(input: DispatchNotificationInput): Promise<void> {
  if (!input.clientPhone) return;

  switch (input.type) {
    case "invoice_sent":
    case "invoice_created":
      if (input.invoiceId) {
        await sendInvoiceSMS(input.orgId, input.invoiceId, input.clientPhone);
      }
      break;
    case "payment_received":
    case "invoice_paid":
      if (input.paymentId) {
        await sendPaymentReceivedSMS(input.orgId, input.paymentId, input.clientPhone);
      }
      break;
    case "invoice_overdue":
      if (input.invoiceId) {
        await sendPaymentReminderSMS(input.orgId, input.invoiceId, input.clientPhone);
      }
      break;
    default:
      logger.debug("No SMS template for notification type", { type: input.type });
  }
}

async function dispatchWhatsApp(input: DispatchNotificationInput): Promise<void> {
  if (!input.clientPhone) return;

  switch (input.type) {
    case "invoice_sent":
    case "invoice_created":
      if (input.invoiceId) {
        await sendInvoiceWhatsApp(input.orgId, input.invoiceId, input.clientPhone);
      }
      break;
    case "payment_received":
    case "invoice_paid":
      if (input.paymentId) {
        await sendPaymentReceivedWhatsApp(input.orgId, input.paymentId, input.clientPhone);
      }
      break;
    case "invoice_overdue":
      if (input.invoiceId) {
        await sendPaymentReminderWhatsApp(input.orgId, input.invoiceId, input.clientPhone);
      }
      break;
    default:
      logger.debug("No WhatsApp template for notification type", { type: input.type });
  }
}

export async function createNotification(
  orgId: string,
  data: CreateNotificationInput
): Promise<Notification> {
  const db = await getDB();
  const id = uuid();
  const now = new Date();

  return db.create<Notification>("notifications", {
    id,
    orgId,
    userId: data.userId ?? null,
    type: data.type,
    title: data.title,
    message: data.message,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    isRead: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listNotifications(
  orgId: string,
  userId: string,
  params: { page: number; limit: number; unread?: boolean }
) {
  const db = await getDB();

  // Build where clause: notifications for this user OR for all users in org (user_id IS NULL)
  // The adapter doesn't support OR, so we fetch both and merge
  const where: Record<string, unknown> = { org_id: orgId };
  if (params.unread) {
    where.is_read = false;
  }

  // Get user-specific notifications
  const userWhere = { ...where, user_id: userId };
  const orgWideWhere = { ...where, user_id: null };

  const [userNotifs, orgNotifs] = await Promise.all([
    db.findMany<Notification>("notifications", {
      where: userWhere,
      orderBy: [{ column: "created_at", direction: "desc" }],
      limit: params.limit * params.page,
    }),
    db.findMany<Notification>("notifications", {
      where: orgWideWhere,
      orderBy: [{ column: "created_at", direction: "desc" }],
      limit: params.limit * params.page,
    }),
  ]);

  // Merge and sort by created_at descending
  const all = [...userNotifs, ...orgNotifs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = all.length;
  const start = (params.page - 1) * params.limit;
  const data = all.slice(start, start + params.limit);

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function markAsRead(orgId: string, id: string): Promise<Notification> {
  const db = await getDB();
  const notification = await db.findById<Notification>("notifications", id, orgId);
  if (!notification) throw NotFoundError("Notification");

  return db.update<Notification>("notifications", id, { isRead: true, updatedAt: new Date() }, orgId);
}

export async function markAllAsRead(orgId: string, userId: string): Promise<void> {
  const db = await getDB();

  // Mark user-specific unread notifications as read
  await db.updateMany(
    "notifications",
    { org_id: orgId, user_id: userId, is_read: false },
    { is_read: true, updated_at: new Date() }
  );

  // Also mark org-wide unread notifications as read
  await db.updateMany(
    "notifications",
    { org_id: orgId, user_id: null, is_read: false },
    { is_read: true, updated_at: new Date() }
  );
}

export async function getUnreadCount(orgId: string, userId: string): Promise<number> {
  const db = await getDB();

  const [userCount, orgCount] = await Promise.all([
    db.count("notifications", { org_id: orgId, user_id: userId, is_read: false }),
    db.count("notifications", { org_id: orgId, user_id: null, is_read: false }),
  ]);

  return userCount + orgCount;
}
