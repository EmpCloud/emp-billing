import type { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { logger } from "../../utils/logger";

interface AuditOptions {
  action: string; // e.g. "invoice.created", "client.updated"
  entityType: string; // e.g. "invoice", "client"
  getEntityId?: (req: Request) => string; // defaults to req.params.id
}

export function auditLog(options: AuditOptions) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Capture the original res.json to intercept after response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Log asynchronously — don't block response
      setImmediate(async () => {
        try {
          const db = await getDB();
          const entityId = options.getEntityId
            ? options.getEntityId(req)
            : (req.params?.id as string) ||
              ((body as Record<string, unknown>)?.data as Record<string, unknown>)?.id as string ||
              "";

          await db.create("audit_logs", {
            id: uuid(),
            orgId: req.user?.orgId || "",
            userId: req.user?.id || null,
            action: options.action,
            entityType: options.entityType,
            entityId: entityId || "",
            before: null, // could capture before-state for updates
            after: JSON.stringify(req.body || null),
            ipAddress:
              req.ip || req.headers["x-forwarded-for"] || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (err) {
          logger.warn("Audit log failed", {
            action: options.action,
            err,
          });
        }
      });
      return originalJson(body);
    } as typeof res.json;

    next();
  };
}
