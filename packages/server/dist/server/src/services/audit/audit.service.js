"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogs = listAuditLogs;
const index_1 = require("../../db/adapters/index");
async function listAuditLogs(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.entityType)
        where.entity_type = opts.entityType;
    if (opts.entityId)
        where.entity_id = opts.entityId;
    if (opts.userId)
        where.user_id = opts.userId;
    const result = await db.findPaginated("audit_logs", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    let data = result.data;
    // Date range filter
    if (opts.from || opts.to) {
        data = data.filter((log) => {
            const d = new Date(log.createdAt);
            if (opts.from && d < opts.from)
                return false;
            if (opts.to && d > opts.to)
                return false;
            return true;
        });
    }
    return { ...result, data };
}
//# sourceMappingURL=audit.service.js.map