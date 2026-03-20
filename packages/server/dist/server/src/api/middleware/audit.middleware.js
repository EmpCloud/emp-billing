"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = auditLog;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const logger_1 = require("../../utils/logger");
function auditLog(options) {
    return async (req, res, next) => {
        // Capture the original res.json to intercept after response
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            // Log asynchronously — don't block response
            setImmediate(async () => {
                try {
                    const db = await (0, index_1.getDB)();
                    const entityId = options.getEntityId
                        ? options.getEntityId(req)
                        : req.params?.id ||
                            body?.data?.id ||
                            "";
                    await db.create("audit_logs", {
                        id: (0, uuid_1.v4)(),
                        orgId: req.user?.orgId || "",
                        userId: req.user?.id || null,
                        action: options.action,
                        entityType: options.entityType,
                        entityId: entityId || "",
                        before: null, // could capture before-state for updates
                        after: JSON.stringify(req.body || null),
                        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }
                catch (err) {
                    logger_1.logger.warn("Audit log failed", {
                        action: options.action,
                        err,
                    });
                }
            });
            return originalJson(body);
        };
        next();
    };
}
//# sourceMappingURL=audit.middleware.js.map