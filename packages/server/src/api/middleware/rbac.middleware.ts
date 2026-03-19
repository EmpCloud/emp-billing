import type { Request, Response, NextFunction } from "express";
import { UserRole } from "@emp-billing/shared";
import { ForbiddenError, UnauthorizedError } from "../../utils/AppError";

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.VIEWER,
  UserRole.SALES,
  UserRole.ACCOUNTANT,
  UserRole.ADMIN,
  UserRole.OWNER,
];

function roleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

// Require the authenticated user to have at least `minRole`
export function requireRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw UnauthorizedError();
    }
    if (roleLevel(req.user.role) < roleLevel(minRole)) {
      throw ForbiddenError(
        `This action requires at least the '${minRole}' role`
      );
    }
    next();
  };
}

// Shorthand guards
export const requireOwner = requireRole(UserRole.OWNER);
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireAccountant = requireRole(UserRole.ACCOUNTANT);
export const requireSales = requireRole(UserRole.SALES);
