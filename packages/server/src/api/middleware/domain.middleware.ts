import type { Request, Response, NextFunction } from "express";
import { resolveOrgByDomain, getDefaultDomain } from "../../services/domain/domain.service";

// Extend Express Request with domain org info
declare global {
  namespace Express {
    interface Request {
      domainOrg?: {
        orgId: string;
        domain: string;
      };
    }
  }
}

/**
 * Domain resolution middleware.
 *
 * Reads the Host header (or X-Forwarded-Host behind a reverse proxy) and
 * looks up the custom_domains table to find the owning org_id.
 *
 * If a verified custom domain matches, sets `req.domainOrg` with the resolved
 * org info. Falls back gracefully — if no custom domain matches, the request
 * continues without `req.domainOrg` and normal auth flows take over.
 */
export async function domainResolution(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";

    // Strip port if present (e.g. "billing.example.com:443" → "billing.example.com")
    const domain = host.split(":")[0].toLowerCase().trim();

    if (!domain) {
      return next();
    }

    // Skip resolution for the default domain and localhost
    const defaultDomain = getDefaultDomain().toLowerCase();
    if (
      domain === defaultDomain ||
      domain === "localhost" ||
      domain === "127.0.0.1" ||
      domain === "0.0.0.0"
    ) {
      return next();
    }

    const orgId = await resolveOrgByDomain(domain);
    if (orgId) {
      req.domainOrg = { orgId, domain };
    }
  } catch {
    // If domain resolution fails, proceed without it — don't block the request
  }
  next();
}
