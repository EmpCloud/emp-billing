"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSales = exports.requireAccountant = exports.requireAdmin = exports.requireOwner = void 0;
exports.requireRole = requireRole;
const shared_1 = require("@emp-billing/shared");
const AppError_1 = require("../../utils/AppError");
// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY = [
    shared_1.UserRole.VIEWER,
    shared_1.UserRole.SALES,
    shared_1.UserRole.ACCOUNTANT,
    shared_1.UserRole.ADMIN,
    shared_1.UserRole.OWNER,
];
function roleLevel(role) {
    return ROLE_HIERARCHY.indexOf(role);
}
// Require the authenticated user to have at least `minRole`
function requireRole(minRole) {
    return (req, _res, next) => {
        if (!req.user) {
            throw (0, AppError_1.UnauthorizedError)();
        }
        if (roleLevel(req.user.role) < roleLevel(minRole)) {
            throw (0, AppError_1.ForbiddenError)(`This action requires at least the '${minRole}' role`);
        }
        next();
    };
}
// Shorthand guards
exports.requireOwner = requireRole(shared_1.UserRole.OWNER);
exports.requireAdmin = requireRole(shared_1.UserRole.ADMIN);
exports.requireAccountant = requireRole(shared_1.UserRole.ACCOUNTANT);
exports.requireSales = requireRole(shared_1.UserRole.SALES);
//# sourceMappingURL=rbac.middleware.js.map