import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config/index";
import { UnauthorizedError } from "../../utils/AppError";
import type { AuthUser } from "@emp-billing/shared";
import { UserRole } from "@emp-billing/shared";
import { validateApiKey } from "../../services/auth/api-key.service";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface AccessTokenPayload {
  sub: string;       // user id
  email: string;
  role: string;
  orgId: string;
  orgName: string;
  firstName: string;
  lastName: string;
}

const API_KEY_PREFIX = "empb_";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);

  // Check if this is an API key (starts with empb_)
  if (token.startsWith(API_KEY_PREFIX)) {
    // API key auth — async path
    validateApiKey(token)
      .then((result) => {
        req.user = {
          id: result.keyId,
          email: "api-key@system",
          role: UserRole.ADMIN as AuthUser["role"],
          orgId: result.orgId,
          orgName: "",
          firstName: "API",
          lastName: "Key",
          apiKeyId: result.keyId,
          apiKeyScopes: result.scopes,
        };
        next();
      })
      .catch((err: unknown) => {
        next(err);
      });
    return;
  }

  // JWT auth
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser["role"],
      orgId: payload.orgId,
      orgName: payload.orgName,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
    next();
  } catch {
    throw UnauthorizedError("Invalid or expired token");
  }
}

// Optional auth — attaches user if token present, does not block if absent
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);

  // Check if this is an API key
  if (token.startsWith(API_KEY_PREFIX)) {
    validateApiKey(token)
      .then((result) => {
        req.user = {
          id: result.keyId,
          email: "api-key@system",
          role: UserRole.ADMIN as AuthUser["role"],
          orgId: result.orgId,
          orgName: "",
          firstName: "API",
          lastName: "Key",
          apiKeyId: result.keyId,
          apiKeyScopes: result.scopes,
        };
        next();
      })
      .catch(() => {
        // ignore — key invalid, proceed without user
        next();
      });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser["role"],
      orgId: payload.orgId,
      orgName: payload.orgName,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
  } catch {
    // ignore — token invalid, proceed without user
  }
  next();
}
