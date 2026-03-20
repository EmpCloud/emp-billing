"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../../config/index");
const AppError_1 = require("../../utils/AppError");
function authenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        throw (0, AppError_1.UnauthorizedError)("Missing or malformed Authorization header");
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            orgId: payload.orgId,
            orgName: payload.orgName,
            firstName: payload.firstName,
            lastName: payload.lastName,
        };
        next();
    }
    catch {
        throw (0, AppError_1.UnauthorizedError)("Invalid or expired token");
    }
}
// Optional auth — attaches user if token present, does not block if absent
function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return next();
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            orgId: payload.orgId,
            orgName: payload.orgName,
            firstName: payload.firstName,
            lastName: payload.lastName,
        };
    }
    catch {
        // ignore — token invalid, proceed without user
    }
    next();
}
//# sourceMappingURL=auth.middleware.js.map