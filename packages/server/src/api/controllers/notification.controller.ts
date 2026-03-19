import type { Request, Response } from "express";
import * as notificationService from "../../services/notification/notification.service";

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", unread } = req.query as Record<string, string>;
  const result = await notificationService.listNotifications(req.user!.orgId, req.user!.id, {
    page: parseInt(page),
    limit: parseInt(limit),
    unread: unread === "true" ? true : undefined,
  });
  res.json({
    success: true,
    data: result.data,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await notificationService.getUnreadCount(req.user!.orgId, req.user!.id);
  res.json({ success: true, data: { count } });
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const notification = await notificationService.markAsRead(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: notification });
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllAsRead(req.user!.orgId, req.user!.id);
  res.json({ success: true, data: null });
}
