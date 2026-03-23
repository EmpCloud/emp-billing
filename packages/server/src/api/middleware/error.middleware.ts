import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import type { ApiResponse } from "@emp-billing/shared";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      details[key] = details[key] || [];
      details[key].push(issue.message);
    }
    const body: ApiResponse<never> = {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details },
    };
    res.status(422).json(body);
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    if (err.statusCode >= 500) {
      logger.error(`[AppError] ${err.code}: ${err.message}`, { stack: err.stack });
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown errors
  const errMsg = err instanceof Error ? err.message : String(err);
  const errStack = err instanceof Error ? err.stack : undefined;
  logger.error("[Unhandled error]", { message: errMsg, stack: errStack });
  const body: ApiResponse<never> = {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  };
  res.status(500).json(body);
}

// Catch async route handler errors and forward to errorMiddleware
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
