import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as notificationController from "../controllers/notification.controller";

const router = Router();
router.use(authenticate);

router.get("/",              asyncHandler(notificationController.listNotifications));
router.get("/unread-count",  asyncHandler(notificationController.getUnreadCount));
router.put("/:id/read",     asyncHandler(notificationController.markAsRead));
router.post("/mark-all-read", asyncHandler(notificationController.markAllAsRead));

export { router as notificationRoutes };
