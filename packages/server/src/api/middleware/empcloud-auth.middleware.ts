import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/index";
import { UnauthorizedError } from "../../utils/AppError";

/**
 * Validates requests from EmpCloud using a shared API key.
 * Checks `X-EmpCloud-API-Key` header or `Authorization: Bearer <key>`.
 */
export function authenticateEmpCloud(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expectedKey = config.empcloud.apiKey;

  if (!expectedKey) {
    throw UnauthorizedError("EmpCloud webhook integration not configured");
  }

  // Check X-EmpCloud-API-Key header first
  const empcloudHeader = req.headers["x-empcloud-api-key"] as string | undefined;
  if (empcloudHeader && empcloudHeader === expectedKey) {
    return next();
  }

  // Fall back to Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === expectedKey) {
      return next();
    }
  }

  throw UnauthorizedError("Invalid or missing EmpCloud API key");
}
