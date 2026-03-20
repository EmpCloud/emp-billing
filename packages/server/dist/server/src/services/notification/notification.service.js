"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchNotification = dispatchNotification;
exports.createNotification = createNotification;
exports.listNotifications = listNotifications;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.getUnreadCount = getUnreadCount;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const logger_1 = require("../../utils/logger");
const sms_service_1 = require("./sms.service");
const whatsapp_service_1 = require("./whatsapp.service");
/**
 * Dispatch a notification across multiple channels.
 * Failures on individual channels are logged but do not block other channels.
 */
async function dispatchNotification(input) {
    const channels = input.channels ?? ["in_app"];
    const promises = [];
    // In-app notification
    if (channels.includes("in_app")) {
        promises.push(createNotification(input.orgId, {
            userId: input.userId ?? null,
            type: input.type,
            title: input.title,
            message: input.message,
            entityType: input.entityType,
            entityId: input.entityId,
        }).then(() => undefined));
    }
    // SMS channel
    if (channels.includes("sms") && input.clientPhone) {
        const smsPromise = dispatchSMS(input).catch((err) => {
            logger_1.logger.error("SMS dispatch failed (non-blocking)", { type: input.type, phone: input.clientPhone, err });
        });
        promises.push(smsPromise);
    }
    // WhatsApp channel
    if (channels.includes("whatsapp") && input.clientPhone) {
        const waPromise = dispatchWhatsApp(input).catch((err) => {
            logger_1.logger.error("WhatsApp dispatch failed (non-blocking)", { type: input.type, phone: input.clientPhone, err });
        });
        promises.push(waPromise);
    }
    // Email channel is handled by existing email queue infrastructure.
    // Callers should continue to use queueInvoiceEmail / queuePaymentReceiptEmail
    // for email delivery. This dispatcher focuses on SMS + WhatsApp + in-app.
    await Promise.allSettled(promises);
}
async function dispatchSMS(input) {
    if (!input.clientPhone)
        return;
    switch (input.type) {
        case "invoice_sent":
        case "invoice_created":
            if (input.invoiceId) {
                await (0, sms_service_1.sendInvoiceSMS)(input.orgId, input.invoiceId, input.clientPhone);
            }
            break;
        case "payment_received":
        case "invoice_paid":
            if (input.paymentId) {
                await (0, sms_service_1.sendPaymentReceivedSMS)(input.orgId, input.paymentId, input.clientPhone);
            }
            break;
        case "invoice_overdue":
            if (input.invoiceId) {
                await (0, sms_service_1.sendPaymentReminderSMS)(input.orgId, input.invoiceId, input.clientPhone);
            }
            break;
        default:
            logger_1.logger.debug("No SMS template for notification type", { type: input.type });
    }
}
async function dispatchWhatsApp(input) {
    if (!input.clientPhone)
        return;
    switch (input.type) {
        case "invoice_sent":
        case "invoice_created":
            if (input.invoiceId) {
                await (0, whatsapp_service_1.sendInvoiceWhatsApp)(input.orgId, input.invoiceId, input.clientPhone);
            }
            break;
        case "payment_received":
        case "invoice_paid":
            if (input.paymentId) {
                await (0, whatsapp_service_1.sendPaymentReceivedWhatsApp)(input.orgId, input.paymentId, input.clientPhone);
            }
            break;
        case "invoice_overdue":
            if (input.invoiceId) {
                await (0, whatsapp_service_1.sendPaymentReminderWhatsApp)(input.orgId, input.invoiceId, input.clientPhone);
            }
            break;
        default:
            logger_1.logger.debug("No WhatsApp template for notification type", { type: input.type });
    }
}
async function createNotification(orgId, data) {
    const db = await (0, index_1.getDB)();
    const id = (0, uuid_1.v4)();
    const now = new Date();
    return db.create("notifications", {
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
async function listNotifications(orgId, userId, params) {
    const db = await (0, index_1.getDB)();
    // Build where clause: notifications for this user OR for all users in org (user_id IS NULL)
    // The adapter doesn't support OR, so we fetch both and merge
    const where = { org_id: orgId };
    if (params.unread) {
        where.is_read = false;
    }
    // Get user-specific notifications
    const userWhere = { ...where, user_id: userId };
    const orgWideWhere = { ...where, user_id: null };
    const [userNotifs, orgNotifs] = await Promise.all([
        db.findMany("notifications", {
            where: userWhere,
            orderBy: [{ column: "created_at", direction: "desc" }],
            limit: params.limit * params.page,
        }),
        db.findMany("notifications", {
            where: orgWideWhere,
            orderBy: [{ column: "created_at", direction: "desc" }],
            limit: params.limit * params.page,
        }),
    ]);
    // Merge and sort by created_at descending
    const all = [...userNotifs, ...orgNotifs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
async function markAsRead(orgId, id) {
    const db = await (0, index_1.getDB)();
    const notification = await db.findById("notifications", id, orgId);
    if (!notification)
        throw (0, AppError_1.NotFoundError)("Notification");
    return db.update("notifications", id, { isRead: true, updatedAt: new Date() }, orgId);
}
async function markAllAsRead(orgId, userId) {
    const db = await (0, index_1.getDB)();
    // Mark user-specific unread notifications as read
    await db.updateMany("notifications", { org_id: orgId, user_id: userId, is_read: false }, { is_read: true, updated_at: new Date() });
    // Also mark org-wide unread notifications as read
    await db.updateMany("notifications", { org_id: orgId, user_id: null, is_read: false }, { is_read: true, updated_at: new Date() });
}
async function getUnreadCount(orgId, userId) {
    const db = await (0, index_1.getDB)();
    const [userCount, orgCount] = await Promise.all([
        db.count("notifications", { org_id: orgId, user_id: userId, is_read: false }),
        db.count("notifications", { org_id: orgId, user_id: null, is_read: false }),
    ]);
    return userCount + orgCount;
}
//# sourceMappingURL=notification.service.js.map