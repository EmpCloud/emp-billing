"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
const notificationService = __importStar(require("../../services/notification/notification.service"));
async function listNotifications(req, res) {
    const { page = "1", limit = "20", unread } = req.query;
    const result = await notificationService.listNotifications(req.user.orgId, req.user.id, {
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
async function getUnreadCount(req, res) {
    const count = await notificationService.getUnreadCount(req.user.orgId, req.user.id);
    res.json({ success: true, data: { count } });
}
async function markAsRead(req, res) {
    const notification = await notificationService.markAsRead(req.user.orgId, req.params.id);
    res.json({ success: true, data: notification });
}
async function markAllAsRead(req, res) {
    await notificationService.markAllAsRead(req.user.orgId, req.user.id);
    res.json({ success: true, data: null });
}
//# sourceMappingURL=notification.controller.js.map