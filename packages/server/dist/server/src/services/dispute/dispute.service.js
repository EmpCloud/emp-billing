"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDisputes = listDisputes;
exports.getDispute = getDispute;
exports.createDispute = createDispute;
exports.updateDispute = updateDispute;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
// ============================================================================
// DISPUTE SERVICE
// ============================================================================
// ── List ─────────────────────────────────────────────────────────────────────
async function listDisputes(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.status)
        where.status = opts.status;
    if (opts.clientId)
        where.client_id = opts.clientId;
    const result = await db.findPaginated("disputes", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return result;
}
// ── Get ──────────────────────────────────────────────────────────────────────
async function getDispute(orgId, id) {
    const db = await (0, index_1.getDB)();
    const dispute = await db.findById("disputes", id, orgId);
    if (!dispute)
        throw (0, AppError_1.NotFoundError)("Dispute");
    return dispute;
}
// ── Create (Portal — client-facing) ─────────────────────────────────────────
async function createDispute(orgId, clientId, data) {
    const db = await (0, index_1.getDB)();
    // If invoiceId is provided, verify it belongs to this client + org
    if (data.invoiceId) {
        const invoice = await db.findById("invoices", data.invoiceId, orgId);
        if (!invoice)
            throw (0, AppError_1.NotFoundError)("Invoice");
        if (invoice.clientId !== clientId) {
            throw (0, AppError_1.ForbiddenError)("You do not have access to this invoice");
        }
    }
    const id = (0, uuid_1.v4)();
    const now = new Date();
    const dispute = await db.create("disputes", {
        id,
        orgId,
        clientId,
        invoiceId: data.invoiceId || null,
        reason: data.reason,
        status: shared_1.DisputeStatus.OPEN,
        resolution: null,
        adminNotes: null,
        attachments: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
    });
    return dispute;
}
// ── Update (Admin — change status, add resolution) ──────────────────────────
async function updateDispute(orgId, id, data, userId) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("disputes", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Dispute");
    const now = new Date();
    const updates = { updatedAt: now };
    if (data.status !== undefined)
        updates.status = data.status;
    if (data.resolution !== undefined)
        updates.resolution = data.resolution;
    if (data.adminNotes !== undefined)
        updates.adminNotes = data.adminNotes;
    // If resolving or closing, record who and when
    if (data.status === shared_1.DisputeStatus.RESOLVED || data.status === shared_1.DisputeStatus.CLOSED) {
        updates.resolvedBy = userId;
        updates.resolvedAt = now;
    }
    return db.update("disputes", id, updates, orgId);
}
//# sourceMappingURL=dispute.service.js.map