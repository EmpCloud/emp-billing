"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNextSendAt = computeNextSendAt;
exports.listScheduledReports = listScheduledReports;
exports.createScheduledReport = createScheduledReport;
exports.updateScheduledReport = updateScheduledReport;
exports.deleteScheduledReport = deleteScheduledReport;
exports.getDueReports = getDueReports;
exports.markReportSent = markReportSent;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const index_1 = require("../../db/adapters/index");
// ============================================================================
// SCHEDULED REPORT SERVICE
// ============================================================================
// ── Compute next send time ──────────────────────────────────────────────────
function computeNextSendAt(frequency, fromDate) {
    const base = fromDate ? (0, dayjs_1.default)(fromDate) : (0, dayjs_1.default)();
    switch (frequency) {
        case "daily":
            // Next day at 8:00 AM UTC
            return base.add(1, "day").hour(8).minute(0).second(0).millisecond(0).toDate();
        case "weekly":
            // Next Monday at 8:00 AM UTC
            // dayjs().day() returns 0=Sunday, 1=Monday, ..., 6=Saturday
            {
                let nextMonday = base.add(1, "day");
                while (nextMonday.day() !== 1) {
                    nextMonday = nextMonday.add(1, "day");
                }
                return nextMonday.hour(8).minute(0).second(0).millisecond(0).toDate();
            }
        case "monthly":
            // 1st of next month at 8:00 AM UTC
            return base
                .add(1, "month")
                .date(1)
                .hour(8)
                .minute(0)
                .second(0)
                .millisecond(0)
                .toDate();
        default:
            return base.add(1, "day").hour(8).minute(0).second(0).millisecond(0).toDate();
    }
}
// ── List scheduled reports for an org ───────────────────────────────────────
async function listScheduledReports(orgId) {
    const db = await (0, index_1.getDB)();
    const rows = await db.findMany("scheduled_reports", {
        where: { org_id: orgId },
    });
    return rows;
}
// ── Create ──────────────────────────────────────────────────────────────────
async function createScheduledReport(orgId, userId, data) {
    const db = await (0, index_1.getDB)();
    const now = new Date();
    const id = (0, uuid_1.v4)();
    const nextSendAt = computeNextSendAt(data.frequency);
    const record = {
        id,
        orgId,
        reportType: data.reportType,
        frequency: data.frequency,
        recipientEmail: data.recipientEmail,
        isActive: data.isActive ?? true,
        lastSentAt: null,
        nextSendAt,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
    };
    await db.create("scheduled_reports", record);
    return record;
}
// ── Update ──────────────────────────────────────────────────────────────────
async function updateScheduledReport(orgId, id, data) {
    const db = await (0, index_1.getDB)();
    const now = new Date();
    const updates = {
        ...data,
        updatedAt: now,
    };
    // If frequency changed, recompute next_send_at
    if (data.frequency) {
        updates.nextSendAt = computeNextSendAt(data.frequency);
    }
    await db.update("scheduled_reports", id, updates, orgId);
    const updated = await db.findById("scheduled_reports", id, orgId);
    return updated;
}
// ── Delete ──────────────────────────────────────────────────────────────────
async function deleteScheduledReport(orgId, id) {
    const db = await (0, index_1.getDB)();
    await db.delete("scheduled_reports", id, orgId);
}
// ── Get due reports ─────────────────────────────────────────────────────────
async function getDueReports() {
    const db = await (0, index_1.getDB)();
    const now = new Date();
    const rows = await db.raw(`SELECT * FROM scheduled_reports
     WHERE is_active = true AND next_send_at <= ?
     ORDER BY next_send_at ASC`, [now]);
    return rows;
}
// ── Mark report as sent ─────────────────────────────────────────────────────
async function markReportSent(report) {
    const db = await (0, index_1.getDB)();
    const now = new Date();
    const nextSendAt = computeNextSendAt(report.frequency, now);
    await db.update("scheduled_reports", report.id, {
        lastSentAt: now,
        nextSendAt,
        updatedAt: now,
    }, report.orgId);
}
//# sourceMappingURL=scheduled-report.service.js.map