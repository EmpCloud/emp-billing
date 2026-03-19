import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config/index";
import { UnauthorizedError } from "../../utils/AppError";

// Extend Express Request with portal client info
declare global {
  namespace Express {
    interface Request {
      portalClient?: {
        clientId: string;
        orgId: string;
      };
    }
  }
}

interface PortalTokenPayload {
  sub: string;   // clientId
  orgId: string;
  type: "portal";
}

export function portalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as PortalTokenPayload;

    // Ensure this is a portal token, not a regular user token
    if (payload.type !== "portal") {
      throw UnauthorizedError("Invalid portal token");
    }

    req.portalClient = {
      clientId: payload.sub,
      orgId: payload.orgId,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      throw UnauthorizedError("Invalid or expired portal token");
    }
    throw err;
  }
}
